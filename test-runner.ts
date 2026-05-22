import "dotenv/config"; // Ensure env vars are loaded
import mongoose from "mongoose";
import connectToDatabase from "./lib/config/mongodb"// Adjust path if needed
import { generateDocs } from "./lib/langchain/documentLoader";
import { generateEmbeddingsInPineconeVectorStore, getVectorStoreForDoc } from "./lib/langchain/vectorStore";
import { answerQuestionAboutDocument } from "./lib/langchain/index";

// REPLACE THESE WITH REAL IDs FROM YOUR DATABASE
const TEST_GRIDFS_ID = "689acd942f05190acf36dc83"; 
const TEST_DOC_ID = "test-doc-namespace-003";
const TEST_QUESTION = "What is the main topic of this document?";

async function runTests() {
  console.log("🚀 Starting RAG Pipeline Tests...\n");

  try {
    // Connect to DB first since documentLoader needs it
    console.log("📦 Connecting to MongoDB...");
    await connectToDatabase();
    console.log("✅ MongoDB Connected.\n");

    // ==========================================
    // STAGE 1: Test Document Loader
    // ==========================================
    console.log("🛠️ STAGE 1: Testing Document Loader...");
    const docs = await generateDocs(TEST_GRIDFS_ID, TEST_DOC_ID);
    console.log(`✅ Success: Generated ${docs.length} chunks.`);
    if (docs.length > 0) {
      console.log("First chunk preview:\n", docs[0].pageContent.substring(0, 150), "...\n");
    }

    // ==========================================
    // STAGE 2: Test Embeddings & Pinecone Upload
    // ==========================================
    console.log("🛠️ STAGE 2: Testing Pinecone Embeddings Upload...");
    const vectorStore = await generateEmbeddingsInPineconeVectorStore(TEST_GRIDFS_ID, TEST_DOC_ID);
    console.log(`✅ Success: Vectors stored/verified in namespace '${TEST_DOC_ID}'.\n`);

   // ==========================================
    // STAGE 3: Test Retrieval (Upgraded with IDs & Scores)
    // ==========================================
    console.log("🛠️ STAGE 3: Testing Pinecone Retrieval...");
    const retrieverStore = await getVectorStoreForDoc(TEST_DOC_ID);
    
    // Using similaritySearchWithScore to get [Document, Score] tuples
    const retrievedDocs = await retrieverStore.similaritySearchWithScore(TEST_QUESTION, 2);
    console.log(`✅ Success: Retrieved ${retrievedDocs.length} relevant chunks.`);
    
    if (retrievedDocs.length > 0) {
      retrievedDocs.forEach(([doc, score], index) => {
        console.log(`\n--- Match ${index + 1} ---`);
        // doc.id contains the Pinecone Vector ID in newer LangChain versions
        console.log(`🔹 Vector ID:   ${doc.id || "Not exposed by current LangChain version"}`);
        console.log(`🔹 Match Score: ${score.toFixed(4)}`);
        console.log(`🔹 Chunk Index: ${doc.metadata.chunkIndex} (From your documentLoader)`);
        console.log(`🔹 Content:     ${doc.pageContent.substring(0, 120)}...\n`);
      });
    }

    // ==========================================
    // STAGE 4: Test Full LLM QA Chain
    // ==========================================
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
    // Cleanup connections
    await mongoose.disconnect();
    console.log("\n🛑 Tests Completed.");
  }
}

runTests();