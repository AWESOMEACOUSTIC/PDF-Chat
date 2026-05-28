import "server-only";

import { Document } from "@langchain/core/documents";
import pinecone from "../config/pinecone"; // 🔹 Imported pinecone client for the Inference API
import { buildQaChain, buildSummaryChain } from "./chains";
import {
  FALLBACK_LLM,
  getChatModel,
  useFallbackModel,
} from "./embeddings";
import { hybridSearch } from "./hybridSearch";
import {
  generateEmbeddingsInPineconeVectorStore,
  getVectorStoreForDoc,
  indexName,
} from "./vectorStore";

export type Citation = {
  documentName: string;
  pageNumber: number;
  chunkId: string;
  chunkText: string;
  sectionTitle?: string;
};

export { generateEmbeddingsInPineconeVectorStore, indexName };

const asNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const extractPageNumber = (metadata: Record<string, unknown>) => {
  const direct = asFiniteNumber(metadata.pageNumber ?? metadata.page);
  if (direct !== null) return direct;
  const loc = metadata.loc as { pageNumber?: unknown; page?: unknown } | undefined;
  const fromLoc = loc ? asFiniteNumber(loc.pageNumber ?? loc.page) : null;
  return fromLoc ?? 0;
};

const buildCitationForDoc = (doc: Document, docId: string): Citation => {
  const metadata = (doc.metadata ?? {}) as Record<string, unknown>;
  const documentName =
    asNonEmptyString(metadata.fileName) ??
    asNonEmptyString(metadata.documentName) ??
    "Unknown document";
  const sectionTitle =
    asNonEmptyString(metadata.sectionTitle) ??
    asNonEmptyString(metadata.heading) ??
    undefined;
  const chunkId =
    asNonEmptyString(doc.id) ??
    (metadata.chunkIndex !== undefined ? `${docId}-chunk-${metadata.chunkIndex}` : `${docId}-chunk-unknown`);

  return {
    documentName,
    pageNumber: extractPageNumber(metadata),
    chunkId,
    chunkText: doc.pageContent,
    sectionTitle,
  };
};

const buildCitations = (docs: Document[], docId: string) =>
  docs.map((doc) => buildCitationForDoc(doc, docId));

export async function createDocumentQAChain(docId: string) {
  const vectorStore = await getVectorStoreForDoc(docId);
  const retriever = vectorStore.asRetriever({
    k: 6,
    searchType: "mmr",
    searchKwargs: { lambda: 0.5 },
  });
  return { retriever, vectorStore };
}

export async function answerQuestionAboutDocument(
  gridFsId: string,
  docId: string,
  question: string
) {
  console.log(`QA request: docId=${docId} question="${question}"`);

  // 1. Ensure embeddings exist for dense + sparse indexes
  await generateEmbeddingsInPineconeVectorStore(gridFsId, docId);

  // 2. Determine the search query
  const wantsOverview = /\boverview|summary|summarize|what is this\b/i.test(question);
  const searchQuery = wantsOverview ? "document overview and summary" : question;

  // 3. STAGE 1: BROAD RETRIEVAL (HYBRID + RRF)
  let candidateDocs: Document[] = [];
  try {
    candidateDocs = await hybridSearch(searchQuery, docId, { topK: 15 });
  } catch (error) {
    console.warn("hybridSearch failed:", error);
  }

  if (!candidateDocs.length) {
    try {
      const vectorStore = await getVectorStoreForDoc(docId);
      const denseResults = await vectorStore.similaritySearchWithScore(searchQuery, 15);
      candidateDocs = denseResults.map(([doc]) => doc);
    } catch (error) {
      console.warn("similaritySearchWithScore failed:", error);
    }
  }

  if (!candidateDocs.length) {
    return {
      answer: "I couldn't read any text from this PDF. Try another file or enable OCR.",
      sourceDocuments: [],
      citations: [],
    };
  }

  // 4. STAGE 2: PRECISION RERANKING
  // Use Pinecone's native Inference API to rerank down to the top 5
  let docs: Document[] = [];
  try {
    // Extract just the plain text for the reranker model
    const docStrings = candidateDocs.map((doc) => doc.pageContent);

    // Call Pinecone's native bge-reranker model
    const rerankResponse = await pinecone.inference.rerank(
      "bge-reranker-v2-m3",
      searchQuery,
      docStrings,
      {
        topN: 5, // Only keep the 5 most strictly relevant chunks
        returnDocuments: false, // We already have the original objects in memory, no need to return text
      }
    );

    // Map the results back to the original LangChain Document objects using the returned indexes
    if (rerankResponse.data) {
      docs = rerankResponse.data.map((item) => {
        const originalDoc = candidateDocs[item.index];
        
        // 🔹 Server-side console logging for the reranked output
        console.log(`\n--- Retrieved Chunk (Reranked) ---`);
        console.log(`Vector ID:    ${originalDoc.id || "N/A"}`);
        console.log(`Rerank Score: ${item.score.toFixed(4)}`);
        console.log(`Chunk Index:  ${originalDoc.metadata?.chunkIndex ?? "N/A"}`);

        return originalDoc;
      });
    } else {
      throw new Error("Invalid response from Pinecone Inference API");
    }

  } catch (error) {
    console.warn("⚠️ Reranking failed, falling back to base vector search:", error);
    
    // Fallback: If the inference API is down, just take the top 5 from the original search
    docs = candidateDocs.slice(0, 5).map((doc, index) => {
      console.log(`\n--- Retrieved Chunk ${index + 1} (Fallback) ---`);
      console.log(`Vector ID:   ${doc.id || "N/A"}`);
      console.log("Base Score:  N/A (RRF order)");
      console.log(`Chunk Index: ${doc.metadata?.chunkIndex ?? "N/A"}`);
      return doc;
    });
  }

  const citations = buildCitations(docs, docId);

  // 5. Run the LLM Chains
  const runChain = async () => {
    const llm = getChatModel();
    const qaChain = await buildQaChain(llm);
    const summaryChain = await buildSummaryChain(llm);

    if (wantsOverview) {
      const out = await summaryChain.invoke({ context: docs });
      return String(out);
    }

    const out = await qaChain.invoke({ input: question, context: docs });
    return String(out);
  };

  try {
    const answer = await runChain();
    return { answer, sourceDocuments: docs, citations };
  } catch (error: any) {
    const msg = error?.message || "";
    if (/invalid model/i.test(msg)) {
      console.warn(`Primary Model invalid; retrying with ${FALLBACK_LLM}`);
      useFallbackModel();
      const answer = await runChain();
      return { answer, sourceDocuments: docs, citations };
    }
    throw error;
  }
}