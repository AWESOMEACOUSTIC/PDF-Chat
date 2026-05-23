import dotenv from "dotenv";

const TEST_GRIDFS_ID = "6a114bd75e669cd8412ea71e"; 
const TEST_DOC_ID = "6a114bd75e669cd8412ea720";
const TEST_QUESTION = "Can you explain me the main topic of this document and provide a brief summary of the literature?";

async function main() {
  // Load environment variables first
  dotenv.config({ path: ".env.local" });
  dotenv.config();

  // Dynamically import everything to avoid top-level await CJS issues
  const mongoose = (await import("mongoose")).default;
  const connectToDatabase = (await import("./lib/config/mongodb")).default;
  const pinecone = (await import("./lib/config/pinecone")).default;
  const { generateDocs } = await import("./lib/langchain/documentLoader");
  const { generateEmbeddingsInPineconeVectorStore } = await import("./lib/langchain/vectorStore");
  const { answerQuestionAboutDocument } = await import("./lib/langchain/index");
  const { hybridSearch } = await import("./lib/langchain/hybridSearch");

  console.log("🚀 Starting RAG Pipeline Tests...\n");

  try {
    console.log("📦 Connecting to MongoDB...");
    await connectToDatabase();
    console.log("✅ MongoDB Connected.\n");

    // STAGE 1: Test Document Loader
    console.log("🛠️ STAGE 1: Testing Document Loader...");
    const docs = await generateDocs(TEST_GRIDFS_ID, TEST_DOC_ID);
    console.log(`✅ Success: Generated ${docs.length} chunks.`);
    if (docs.length > 0) {
      console.log("First chunk preview:\n", docs[0].pageContent.substring(0, 150), "...\n");
    }

    // STAGE 2: Test Embeddings & Pinecone Upload
    console.log("🛠️ STAGE 2: Testing Pinecone Embeddings Upload...");
    await generateEmbeddingsInPineconeVectorStore(TEST_GRIDFS_ID, TEST_DOC_ID);
    console.log(`✅ Success: Vectors stored/verified in namespace '${TEST_DOC_ID}'.\n`);

    // STAGE 3A: Broad Retrieval
    console.log("🛠️ STAGE 3A: Testing Hybrid Retrieval...");
    const searchResults = await hybridSearch(TEST_QUESTION, TEST_DOC_ID, { topK: 15 });
    console.log(`✅ Success: Retrieved ${searchResults.length} initial chunks using hybrid search.\n`);

    // STAGE 3B: Precision Reranking
    console.log("🛠️ STAGE 3B: Testing Pinecone Inference Reranker...");
    if (searchResults.length > 0) {
      const docStrings = searchResults.map((doc) => doc.pageContent);

      const rerankResponse = await pinecone.inference.rerank(
        "bge-reranker-v2-m3",
        TEST_QUESTION,
        docStrings,
        {
          topN: 5,
          returnDocuments: false,
        }
      );

      if (rerankResponse.data) {
        console.log(`✅ Success: Reranked down to top ${rerankResponse.data.length} strictly relevant chunks.`);
        
        rerankResponse.data.forEach((item, index) => {
          const originalDoc = searchResults[item.index];
          console.log(`\n--- Top Match ${index + 1} ---`);
          console.log(`🔹 Vector ID:    ${originalDoc.id || "N/A"}`);
          console.log(`🔹 Rerank Score: ${item.score.toFixed(4)}`);
          console.log(`🔹 Content:      ${originalDoc.pageContent.substring(0, 100)}...\n`);
        });
      }
    } else {
      console.log("⚠️ No chunks retrieved, skipping reranking.");
    }

    // STAGE 4: Test Full LLM QA Chain
    console.log("🛠️ STAGE 4: Testing End-to-End LLM Chain...");
    const response = await answerQuestionAboutDocument(TEST_GRIDFS_ID, TEST_DOC_ID, TEST_QUESTION);
    console.log("✅ Success! LLM Output:");
    console.log("--------------------------------------------------");
    console.log(response.answer);
    console.log("--------------------------------------------------");
    console.log(`Sources used: ${response.sourceDocuments.length}`);

  } catch (error) {
    console.error("❌ TEST FAILED:", error);
  } finally {
    // Cleanup connections so the terminal process can exit naturally
    await mongoose.disconnect();
    console.log("\n🛑 Tests Completed.");
  }
}

main().catch((error) => {
  console.error("❌ TEST RUNNER FAILED:", error);
  process.exitCode = 1;
});