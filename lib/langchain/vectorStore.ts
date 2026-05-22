import "server-only";

import type { Index, RecordMetadata } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import pinecone from "../config/pinecone";
import { embeddings } from "./embeddings";
import { generateDocs } from "./documentLoader";

export const indexName = "pdf-chat";

async function namespaceExists(index: Index<RecordMetadata>, namespace: string) {
  const stats = await index.describeIndexStats();
  const ns = (stats as any).namespaces?.[namespace];
  const count = ns?.recordCount ?? ns?.vectorCount ?? 0;
  console.log(`Namespace '${namespace}' exists=${!!ns} (count=${count})`);
  return !!ns;
}

export async function getVectorStoreForDoc(docId: string) {
  const index = pinecone.Index(indexName);
  return PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: docId,
  });
}

export async function generateEmbeddingsInPineconeVectorStore(
  gridFsId: string,
  docId: string
): Promise<PineconeStore> {
  const index = pinecone.Index(indexName);

  if (await namespaceExists(index, docId)) {
    return PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: docId,
    });
  }

  const docs = await generateDocs(gridFsId, docId);
  if (!docs.length) throw new Error("No chunks produced from PDF extraction.");

  try {
    const test = await embeddings.embedQuery("ping");
    console.log(`Embeddings live (dim=${test.length})`);
  } catch (error: any) {
    throw new Error(`Embeddings failed (likely quota): ${error?.message || error}`);
  }

  const store = await PineconeStore.fromDocuments(docs, embeddings, {
    pineconeIndex: index,
    namespace: docId,
  });

  try {
    const stats = await index.describeIndexStats();
    const count =
      (stats as any).namespaces?.[docId]?.recordCount ??
      (stats as any).namespaces?.[docId]?.vectorCount ??
      0;
    console.log(`Stored vectors in '${docId}': ${count}`);
  } catch (error) {
    console.warn("describeIndexStats verify failed:", error);
  }

  return store;
}
