import "server-only";

import { Document } from "@langchain/core/documents";
import type {
    Embedding,
    Index,
    PineconeRecord,
    RecordMetadata,
    RecordSparseValues,
} from "@pinecone-database/pinecone";
import pinecone from "../config/pinecone";
import { embeddings } from "./embeddings";
import { generateDocs } from "./documentLoader";
import { filterTrustedChunks } from "./trustVaildator";
import { reciprocalRankFusion, type RrfInputMatch } from "./reciprocalRankFusion";

export const DENSE_INDEX_NAME = "pdf-chat";
export const SPARSE_INDEX_NAME = "pdf-with-chat";

const DEFAULT_DENSE_TOP_K = 20;
const DEFAULT_SPARSE_TOP_K = 20;
const DEFAULT_RRF_TOP_K = 15;
const DEFAULT_UPSERT_BATCH_SIZE = 100;
const DEFAULT_EMBED_BATCH_SIZE = 64;

// Use 'number | null' so we can handle sparse-only indexes that have no dimension
const indexDimensions = new Map<string, number | null>();

type HybridUpsertOptions = {
    includeDense?: boolean;
    includeSparse?: boolean;
    embedBatchSize?: number;
    upsertBatchSize?: number;
};

type HybridSearchOptions = {
    topK?: number;
    denseTopK?: number;
    sparseTopK?: number;
};

function asRecordSparseValues(embedding: Embedding): RecordSparseValues | null {
    if (embedding.vectorType !== "sparse") return null;
    return {
        indices: embedding.sparseIndices,
        values: embedding.sparseValues,
    };
}

function buildRrfKey(match: RrfInputMatch): string {
    const metadata = match.metadata ?? {};
    const docId = typeof metadata.docId === "string" ? metadata.docId : null;
    const chunkIndex = metadata.chunkIndex;
    if (docId && (typeof chunkIndex === "number" || typeof chunkIndex === "string")) {
        return `${docId}-chunk-${chunkIndex}`;
    }
    return match.id;
}

async function batchUpsert(
    index: Index<RecordMetadata>,
    namespace: string,
    records: PineconeRecord<RecordMetadata>[],
    batchSize: number
) {
    if (!records.length) return;
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        await index.namespace(namespace).upsert(batch);
    }
}

async function embedSparseBatch(texts: string[]) {
    const response = await pinecone.inference.embed(
        "pinecone-sparse-english-v0",
        texts,
        { inputType: "passage" }
    );
    return response.data;
}

// 🛠️ FIX 1: Don't throw an error if the index is sparse-only and has no dimension.
async function getIndexDimension(index: Index<RecordMetadata>, indexName: string) {
    if (indexDimensions.has(indexName)) {
        return indexDimensions.get(indexName);
    }

    const stats = await index.describeIndexStats();
    // Sparse-only indexes do not report a dimension. Capture this as null.
    const dimension = typeof stats.dimension === "number" ? stats.dimension : null;

    indexDimensions.set(indexName, dimension);
    return dimension;
}

export async function upsertHybridVectors(
    docs: Document[],
    docId: string,
    options: HybridUpsertOptions = {}
) {
    const includeDense = options.includeDense ?? true;
    const includeSparse = options.includeSparse ?? true;
    if (!includeDense && !includeSparse) return;

    const embedBatchSize = options.embedBatchSize ?? DEFAULT_EMBED_BATCH_SIZE;
    const upsertBatchSize = options.upsertBatchSize ?? DEFAULT_UPSERT_BATCH_SIZE;

    const denseIndex = pinecone.Index<RecordMetadata>(DENSE_INDEX_NAME);
    const sparseIndex = pinecone.Index<RecordMetadata>(SPARSE_INDEX_NAME);

    const records: PineconeRecord<RecordMetadata>[] = [];
    const sparseRecords: PineconeRecord<RecordMetadata>[] = [];

    for (let i = 0; i < docs.length; i += embedBatchSize) {
        const batchDocs = docs.slice(i, i + embedBatchSize);
        const batchTexts = batchDocs.map((doc) => doc.pageContent);

        const batchMetadata = batchDocs.map((doc, index) => {
            const chunkIndex =
                typeof doc.metadata?.chunkIndex === "number"
                    ? doc.metadata.chunkIndex
                    : i + index;
            return {
                ...(doc.metadata ?? {}),
                docId,
                chunkIndex,
                text: doc.pageContent,
            } as RecordMetadata;
        });

        const batchIds = batchMetadata.map((meta, index) => {
            const chunkIndex = meta.chunkIndex ?? i + index;
            return `${docId}-chunk-${chunkIndex}`;
        });

        const densePromise = includeDense
            ? embeddings.embedDocuments(batchTexts)
            : Promise.resolve(null);
        const sparsePromise = includeSparse
            ? embedSparseBatch(batchTexts).catch((error) => {
                console.warn("Sparse embedding batch failed:", error);
                return null;
            })
            : Promise.resolve(null);

        const [denseVectors, sparseEmbeddings] = await Promise.all([
            densePromise,
            sparsePromise,
        ]);

        if (denseVectors) {
            denseVectors.forEach((values, index) => {
                records.push({
                    id: batchIds[index],
                    values,
                    metadata: batchMetadata[index],
                });
            });
        }

        if (sparseEmbeddings) {
            sparseEmbeddings.forEach((embedding, index) => {
                const sparseValues = asRecordSparseValues(embedding);
                if (!sparseValues) return;
                sparseRecords.push({
                    id: batchIds[index],
                    sparseValues,
                    metadata: batchMetadata[index],
                });
            });
        }
    }

    if (includeDense) {
        await batchUpsert(denseIndex, docId, records, upsertBatchSize);
    }

    if (includeSparse) {
        await batchUpsert(sparseIndex, docId, sparseRecords, upsertBatchSize);
    }
}

export async function ensureHybridIndexes(gridFsId: string, docId: string) {
    const denseIndex = pinecone.Index<RecordMetadata>(DENSE_INDEX_NAME);
    const sparseIndex = pinecone.Index<RecordMetadata>(SPARSE_INDEX_NAME);

    const [denseStats, sparseStats] = await Promise.all([
        denseIndex.describeIndexStats(),
        sparseIndex.describeIndexStats(),
    ]);

    const denseExists = !!(denseStats as any).namespaces?.[docId];
    const sparseExists = !!(sparseStats as any).namespaces?.[docId];

    if (denseExists && sparseExists) return;

    const rawDocs = await generateDocs(gridFsId, docId);
    if (!rawDocs.length) throw new Error("No chunks produced from PDF extraction.");

    const trustedDocs = await filterTrustedChunks(rawDocs);

    await upsertHybridVectors(trustedDocs, docId, {
        includeDense: !denseExists,
        includeSparse: !sparseExists,
    });
}

export async function hybridSearch(
    query: string,
    docId: string,
    options: HybridSearchOptions = {}
): Promise<Document[]> {
    const denseTopK = options.denseTopK ?? DEFAULT_DENSE_TOP_K;
    const sparseTopK = options.sparseTopK ?? DEFAULT_SPARSE_TOP_K;
    const finalTopK = options.topK ?? DEFAULT_RRF_TOP_K;

    const denseIndex = pinecone.Index<RecordMetadata>(DENSE_INDEX_NAME);
    const sparseIndex = pinecone.Index<RecordMetadata>(SPARSE_INDEX_NAME);

    const [denseVector, sparseResponse] = await Promise.all([
        embeddings.embedQuery(query),
        pinecone.inference.embed("pinecone-sparse-english-v0", [query], {
            inputType: "query",
        }),
    ]);

    const sparseEmbedding = sparseResponse.data[0];
    const sparseVector = sparseEmbedding ? asRecordSparseValues(sparseEmbedding) : null;
    if (!sparseVector) {
        throw new Error("Failed to generate sparse query vector.");
    }

    const sparseDimension = await getIndexDimension(sparseIndex, SPARSE_INDEX_NAME);

    // 🛠️ FIX 2: Omit the dummy dense `vector` entirely if the dimension is null
    const sparseQueryOptions: any = {
        topK: sparseTopK,
        sparseVector,
        includeMetadata: true,
    };
    if (sparseDimension !== null) {
        sparseQueryOptions.vector = new Array(sparseDimension).fill(0);
    }

    const [denseResponse, sparseResponseResults] = await Promise.all([
        denseIndex.namespace(docId).query({
            topK: denseTopK,
            vector: denseVector,
            includeMetadata: true,
        }),
        sparseIndex.namespace(docId).query(sparseQueryOptions),
    ]);

    const denseMatches = denseResponse.matches ?? [];
    const sparseMatches = sparseResponseResults.matches ?? [];

    const fused = reciprocalRankFusion(denseMatches, sparseMatches, finalTopK, {
        keySelector: buildRrfKey,
    });

    return fused
        .map((match) => {
            const metadata = match.metadata ?? {};
            const text = typeof metadata.text === "string" ? metadata.text : "";
            if (!text) return null;
            return new Document({
                pageContent: text,
                metadata,
                id: match.id,
            });
        })
        .filter((doc): doc is Document => doc !== null);
}