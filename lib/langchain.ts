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

    // Extract text from PDF using pdf-parse
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;
    
    if (!pdfText || pdfText.trim().length === 0) {
      throw new Error("No text content found in PDF");
    }

    console.log(`Extracted text length: ${pdfText.length} characters`);

    // Split text into manageable chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Create documents from text chunks
    const docs = await textSplitter.createDocuments([pdfText]);
    
    // Add metadata to each document
    const docsWithMetadata = docs.map((doc, index) => {
      return new Document({
        pageContent: doc.pageContent,
        metadata: {
          docId: docId,
          gridFsId: gridFsId,
          chunkIndex: index,
          fileName: fileInfo.filename,
          uploadDate: fileInfo.uploadDate,
        },
      });
    });

    console.log(`Created ${docsWithMetadata.length} text chunks`);

    // Initialize Pinecone index
    const pineconeIndex = pinecone.Index(indexName);

    // Create or update Pinecone vector store
    const vectorStore = await PineconeStore.fromDocuments(
      docsWithMetadata,
      embeddings,
      {
        pineconeIndex,
        namespace: `doc-${docId}`, // Use namespace to isolate documents
      }
    );

    console.log(`Successfully created embeddings for document ${docId}`);
    
    return vectorStore;

  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a retrieval chain for answering questions about a specific document
 * 
 * Logic Flow:
 * 1. Get the vector store for the specific document
 * 2. Create a retriever that finds relevant text chunks
 * 3. Set up prompts for contextual question answering
 * 4. Create a chain that combines retrieved context with user questions
 * 5. Return responses based on document content
 */
export async function createDocumentQAChain(docId: string) {
  try {
    // Initialize Pinecone index
    const pineconeIndex = pinecone.Index(indexName);
    
    // Create vector store from existing embeddings
    const vectorStore = new PineconeStore(embeddings, {
      pineconeIndex,
      namespace: `doc-${docId}`,
    });

    // Create retriever
    const retriever = vectorStore.asRetriever({
      k: 6, // Retrieve top 6 most relevant chunks
    });

    // Define prompt template for question answering
    const qaPrompt = ChatPromptTemplate.fromTemplate(`
      Use the following context to answer the user's question about the document.
      If you cannot find the answer in the provided context, say "I cannot find that information in the document."
      
      Context: {context}
      
      Question: {input}
      
      Answer:
    `);

    // Create document chain
    const documentChain = await createStuffDocumentsChain({
      llm: model,
      prompt: qaPrompt,
    });

    // Create retrieval chain
    const retrievalChain = await createRetrievalChain({
      combineDocsChain: documentChain,
      retriever,
    });

    return retrievalChain;

  } catch (error) {
    console.error("Error creating QA chain:", error);
    throw new Error(`Failed to create QA chain: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Answer a question about a specific document using the QA chain
 */
export async function answerQuestionAboutDocument(docId: string, question: string) {
  try {
    const qaChain = await createDocumentQAChain(docId);
    
    const response = await qaChain.invoke({
      input: question,
    });

    return {
      answer: response.answer,
      sourceDocuments: response.context || [],
    };

  } catch (error) {
    console.error("Error answering question:", error);
    throw new Error(`Failed to answer question: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}