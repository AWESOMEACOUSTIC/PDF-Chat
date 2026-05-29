import "server-only";

import type { Index, RecordMetadata } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import pinecone from "../config/pinecone";
import { embeddings } from "./embeddings";
import { generateDocs } from "./documentLoader";
import { filterTrustedChunks } from "./trustVaildator";
import {
  DENSE_INDEX_NAME,
  SPARSE_INDEX_NAME,
  upsertHybridVectors,
} from "./hybridSearch";

export const indexName = DENSE_INDEX_NAME;
export const sparseIndexName = SPARSE_INDEX_NAME;

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
  const denseIndex = pinecone.Index(indexName);
  const sparseIndex = pinecone.Index(sparseIndexName);

  const denseExists = await namespaceExists(denseIndex, docId);
  let sparseExists = false;
  let sparseAvailable = true;
  try {
    sparseExists = await namespaceExists(sparseIndex, docId);
  } catch (error) {
    sparseAvailable = false;
    console.warn("Sparse index check failed; continuing dense-only:", error);
  }

  if (denseExists && (sparseExists || !sparseAvailable)) {
    return PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: denseIndex,
      namespace: docId,
    });
  }

  const rawDocs = await generateDocs(gridFsId, docId);
  if (!rawDocs.length) throw new Error("No chunks produced from PDF extraction.");

  const trustedDocs = await filterTrustedChunks(rawDocs);

  try {
    const test = await embeddings.embedQuery("ping");
    console.log(`Embeddings live (dim=${test.length})`);
  } catch (error: any) {
    throw new Error(`Embeddings failed (likely quota): ${error?.message || error}`);
  }

  await upsertHybridVectors(trustedDocs, docId, {
    includeDense: !denseExists,
    includeSparse: sparseAvailable && !sparseExists,
  });

  return PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: denseIndex,
    namespace: docId,
  });
}
