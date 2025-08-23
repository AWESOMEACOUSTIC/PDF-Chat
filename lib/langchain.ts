import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Document } from "@langchain/core/documents";
import pinecone from "./pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { Index, RecordMetadata } from "@pinecone-database/pinecone";
import connectToDatabase from "./mongodb";
import { GridFSBucket, ObjectId } from "mongodb";
import mongoose from "mongoose";
import pdfParse from "pdf-parse";

// Initialize OpenAI model with API Key and model name
const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o",
});

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
});

export const indexName = "pdf-chat";

/**
 * Extract text from PDF stored in GridFS and generate embeddings for Pinecone vector store
 * 
 * Logic Flow:
 * 1. Retrieve PDF file from MongoDB GridFS using the provided gridFsId
 * 2. Extract text content from the PDF buffer using pdf-parse
 * 3. Split the text into smaller chunks for better embedding quality
 * 4. Generate vector embeddings for each text chunk using OpenAI
 * 5. Store embeddings in Pinecone vector database with metadata
 * 6. Return the vector store for querying
 */
export async function generateEmbeddingPineconeVectorStore(gridFsId: string, docId: string) {
  try {
    // Connect to MongoDB
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MongoDB connection not ready");
    }

    // Create GridFS bucket to retrieve the PDF
    const bucket = new GridFSBucket(db, { bucketName: "uploads" });
    
    // Convert gridFsId string to ObjectId
    const fileObjectId = new ObjectId(gridFsId);
    
    // Check if file exists
    const fileInfo = await db.collection("uploads.files").findOne({ _id: fileObjectId });
    if (!fileInfo) {
      throw new Error(`PDF file not found with GridFS ID: ${gridFsId}`);
    }

    // Download PDF buffer from GridFS
    const chunks: Buffer[] = [];
    const downloadStream = bucket.openDownloadStream(fileObjectId);
    
    await new Promise<void>((resolve, reject) => {
      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      downloadStream.on('end', () => {
        resolve();
      });
      
      downloadStream.on('error', (error) => {
        reject(error);
      });
    });

    const pdfBuffer = Buffer.concat(chunks);
    console.log(`PDF buffer size: ${pdfBuffer.length} bytes`);

    
}