import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import pinecone from "./pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { Index, RecordMetadata } from "@pinecone-database/pinecone";
import connectToDatabase from "./mongodb";
import { GridFSBucket, ObjectId } from "mongodb";
import mongoose from "mongoose";

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
 * Check if a namespace exists in Pinecone index
 */
async function namespaceExists(index: Index<RecordMetadata>, namespace: string): Promise<boolean> {
  if (!namespace) {
    console.error("❌ No namespace value provided to namespaceExists");
    throw new Error("No namespace value provided.");
  }
  
  try {
    console.log(`🔍 Checking if namespace '${namespace}' exists in Pinecone...`);
    const stats = await index.describeIndexStats();
    console.log(`📊 Pinecone index stats:`, JSON.stringify(stats, null, 2));
    
    const exists = stats.namespaces?.[namespace] !== undefined;
    console.log(`✅ Namespace '${namespace}' exists: ${exists}`);
    
    if (exists && stats.namespaces) {
      console.log(`📈 Namespace '${namespace}' record count:`, stats.namespaces[namespace]?.recordCount || 0);
    }
    
    return exists;
  } catch (error) {
    console.error("❌ Error checking namespace existence:", error);
    return false;
  }
}

/**
 * Generate documents from PDF stored in GridFS
 */
async function generateDocs(gridFsId: string, docId: string): Promise<Document[]> {
  try {
    console.log("--- 📁 Fetching PDF from GridFS... ---");
    console.log(`🆔 GridFS ID: ${gridFsId}`);
    console.log(`📄 Document ID: ${docId}`);
    
    // Connect to MongoDB
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      console.error("❌ MongoDB connection not ready");
      throw new Error("MongoDB connection not ready");
    }
    console.log("✅ MongoDB connection ready");

    // Create GridFS bucket to retrieve the PDF
    const bucket = new GridFSBucket(db, { bucketName: "uploads" });
    console.log("✅ GridFS bucket created with name: uploads");
    
    // Convert gridFsId string to ObjectId
    const fileObjectId = new ObjectId(gridFsId);
    console.log(`🔄 Converted GridFS ID to ObjectId: ${fileObjectId}`);
    
    // Check if file exists
    const fileInfo = await db.collection("uploads.files").findOne({ _id: fileObjectId });
    if (!fileInfo) {
      console.error(`❌ PDF file not found with GridFS ID: ${gridFsId}`);
      throw new Error(`PDF file not found with GridFS ID: ${gridFsId}`);
    }
    console.log(`✅ File found: ${fileInfo.filename}, size: ${fileInfo.length} bytes`);

    // Download PDF buffer from GridFS
    console.log("⬇️ Starting PDF download from GridFS...");
    const chunks: Buffer[] = [];
    const downloadStream = bucket.openDownloadStream(fileObjectId);
    
    await new Promise<void>((resolve, reject) => {
      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
        console.log(`📦 Received chunk: ${chunk.length} bytes`);
      });
      
      downloadStream.on('end', () => {
        console.log("✅ PDF download completed");
        resolve();
      });
      
      downloadStream.on('error', (error) => {
        console.error("❌ Error downloading PDF:", error);
        reject(error);
      });
    });

    const pdfBuffer = Buffer.concat(chunks);
    console.log(`--- 📊 PDF buffer size: ${pdfBuffer.length} bytes ---`);

    // Dynamic import for pdf-parse to avoid Next.js build issues
    console.log("🔄 Loading pdf-parse module dynamically...");
    const pdfParse = (await import('pdf-parse')).default;
    console.log("✅ pdf-parse module loaded successfully");

    // Extract text from PDF using pdf-parse
    console.log("--- 📖 Loading PDF document... ---");
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;
    
    if (!pdfText || pdfText.trim().length === 0) {
      console.error("❌ No text content found in PDF");
      throw new Error("No text content found in PDF");
    }

    console.log(`--- ✅ Extracted text length: ${pdfText.length} characters ---`);
    console.log(`📝 Text preview (first 200 chars): ${pdfText.substring(0, 200)}...`);

    // Split the loaded document into smaller parts
    console.log("--- ✂️ Splitting the document into smaller parts... ---");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    console.log("⚙️ Text splitter configured: chunkSize=1000, chunkOverlap=200");

    // Create documents from text chunks
    const docs = await splitter.createDocuments([pdfText]);
    console.log(`✅ Created ${docs.length} initial text chunks`);
    
    // Add metadata to each document
    const docsWithMetadata = docs.map((doc, index) => {
      const metadata = {
        docId: docId,
        gridFsId: gridFsId,
        chunkIndex: index,
        fileName: fileInfo.filename,
        uploadDate: fileInfo.uploadDate,
      };
      
      console.log(`📋 Chunk ${index}: ${doc.pageContent.length} chars, metadata:`, metadata);
      
      return new Document({
        pageContent: doc.pageContent,
        metadata,
      });
    });

    console.log(`--- ✅ Split into ${docsWithMetadata.length} parts with metadata ---`);
    
    return docsWithMetadata;

  } catch (error) {
    console.error("❌ Error generating documents:", error);
    throw new Error(`Failed to generate documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings and store in Pinecone vector store
 * This function checks if embeddings already exist before creating new ones
 */
export async function generateEmbeddingsInPineconeVectorStore(gridFsId: string, docId: string): Promise<PineconeStore> {
  try {
    console.log("=== 🚀 STARTING EMBEDDING GENERATION ===");
    console.log(`🆔 GridFS ID: ${gridFsId}`);
    console.log(`📄 Document ID: ${docId}`);
    console.log("--- 🔧 Generating embeddings... ---");
    
    // Initialize Pinecone
    console.log("🔄 Initializing Pinecone index...");
    const index = pinecone.Index(indexName);
    console.log(`✅ Pinecone index '${indexName}' initialized`);
    
    // Check if namespace exists
    console.log(`🔍 Checking if namespace '${docId}' already exists...`);
    const namespaceAlreadyExists = await namespaceExists(index, docId);

    let pineconeVectorStore: PineconeStore;

    if (namespaceAlreadyExists) {
      console.log(`--- ♻️ Namespace ${docId} already exists, reusing existing embeddings... ---`);

      try {
        pineconeVectorStore = await PineconeStore.fromExistingIndex(embeddings, {
          pineconeIndex: index,
          namespace: docId,
        });
        console.log(`✅ Successfully connected to existing embeddings in namespace: ${docId}`);
      } catch (error) {
        console.error("❌ Error connecting to existing embeddings:", error);
        throw error;
      }

      return pineconeVectorStore;
    } else {
      console.log(`--- 🆕 Namespace ${docId} does not exist, generating new embeddings... ---`);
      
      // Generate documents
      console.log("📄 Generating documents from PDF...");
      const splitDocs = await generateDocs(gridFsId, docId);
      console.log(`✅ Generated ${splitDocs.length} document chunks`);

      // Log first chunk for verification
      if (splitDocs.length > 0) {
        console.log("📋 First chunk preview:");
        console.log(`  Content length: ${splitDocs[0].pageContent.length}`);
        console.log(`  Content preview: ${splitDocs[0].pageContent.substring(0, 100)}...`);
        console.log(`  Metadata:`, splitDocs[0].metadata);
      }

      console.log(`--- 💾 Storing embeddings in namespace ${docId} in the ${indexName} Pinecone vector store... ---`);
      
      // Test OpenAI embeddings first
      console.log("🧠 Testing OpenAI embeddings API...");
      try {
        const testEmbedding = await embeddings.embedQuery("test");
        console.log(`✅ OpenAI embeddings working, dimension: ${testEmbedding.length}`);
      } catch (embeddingError) {
        console.error("❌ OpenAI embeddings API error:", embeddingError);
        throw new Error(`OpenAI embeddings failed: ${embeddingError}`);
      }

      // Store in Pinecone
      console.log("🚀 Creating Pinecone vector store from documents...");
      try {
        pineconeVectorStore = await PineconeStore.fromDocuments(
          splitDocs,
          embeddings,
          {
            pineconeIndex: index,
            namespace: docId,
          }
        );
        console.log(`✅ Successfully stored embeddings in Pinecone namespace: ${docId}`);
      } catch (pineconeError) {
        console.error("❌ Pinecone storage error:", pineconeError);
        throw new Error(`Pinecone storage failed: ${pineconeError}`);
      }

      // Verify storage
      console.log("🔍 Verifying embeddings were stored...");
      try {
        const verificationStats = await index.describeIndexStats();
        console.log("📊 Post-storage Pinecone stats:", JSON.stringify(verificationStats, null, 2));
        
        if (verificationStats.namespaces?.[docId]) {
          console.log(`✅ Verification successful! Namespace '${docId}' now has ${verificationStats.namespaces[docId].recordCount} records`);
        } else {
          console.warn(`⚠️ Warning: Namespace '${docId}' not found in verification check`);
        }
      } catch (verifyError) {
        console.error("❌ Error verifying storage:", verifyError);
      }

      console.log(`--- ✅ Successfully created embeddings for document ${docId} ---`);
      
      return pineconeVectorStore;
    }

  } catch (error) {
    console.error("=== ❌ EMBEDDING GENERATION FAILED ===");
    console.error("Error details:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a retrieval chain for answering questions about a specific document
 */
export async function createDocumentQAChain(docId: string): Promise<any> {
  try {
    console.log(`--- 🤖 Creating QA chain for document: ${docId} ---`);
    
    // Get or create the vector store
    console.log("🔄 Connecting to Pinecone index...");
    const index = pinecone.Index(indexName);
    console.log(`✅ Connected to Pinecone index: ${indexName}`);
    
    console.log(`🔍 Creating vector store for namespace: ${docId}`);
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: docId,
    });

    console.log(`--- ✅ Vector store created with namespace: ${docId} ---`);

    // Create retriever
    console.log("🔎 Creating retriever with k=4...");
    const retriever = vectorStore.asRetriever({
      k: 4, // Retrieve top 4 most relevant chunks
    });
    console.log(`--- ✅ Retriever created with k=4 ---`);

    // Define prompt template for question answering
    console.log("📝 Setting up QA prompt template...");
    const qaPrompt = ChatPromptTemplate.fromTemplate(`
      Use the following context to answer the user's question about the document.
      If you cannot find the answer in the provided context, say "I cannot find that information in the document."
      
      Context: {context}
      
      Question: {input}
      
      Answer:
    `);
    console.log("✅ QA prompt template configured");

    // Create document chain
    console.log("🔗 Creating document chain...");
    const documentChain = await createStuffDocumentsChain({
      llm: model,
      prompt: qaPrompt,
    });
    console.log(`--- ✅ Document chain created ---`);

    // Create retrieval chain
    console.log("🔗 Creating retrieval chain...");
    const retrievalChain = await createRetrievalChain({
      combineDocsChain: documentChain,
      retriever,
    });
    console.log(`--- ✅ Retrieval chain created successfully ---`);

    return retrievalChain;

  } catch (error) {
    console.error("❌ Error creating QA chain:", error);
    throw new Error(`Failed to create QA chain: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Answer a question about a specific document using the QA chain
 */
export async function answerQuestionAboutDocument(gridFsId: string, docId: string, question: string) {
  try {
    console.log(`=== 💬 STARTING QUESTION ANSWERING ===`);
    console.log(`📄 Document ID: ${docId}`);
    console.log(`🆔 GridFS ID: ${gridFsId}`);
    console.log(`❓ Question: ${question}`);
    
    // First, ensure embeddings exist
    console.log("🔍 Ensuring embeddings exist...");
    const vectorStore = await generateEmbeddingsInPineconeVectorStore(gridFsId, docId);
    console.log("✅ Embeddings confirmed to exist");
    
    // Create QA chain
    console.log("🤖 Creating QA chain...");
    const qaChain = await createDocumentQAChain(docId);
    console.log("✅ QA chain created successfully");
    
    // Test retrieval before answering
    console.log("🔎 Testing document retrieval...");
    try {
      const testRetrieval = await vectorStore.asRetriever({ k: 2 }).getRelevantDocuments("test query");
      console.log(`📚 Retrieved ${testRetrieval.length} test documents for verification`);
      if (testRetrieval.length > 0) {
        console.log(`📄 Sample retrieved content: ${testRetrieval[0].pageContent.substring(0, 100)}...`);
      }
    } catch (retrievalError) {
      console.warn("⚠️ Warning: Test retrieval failed:", retrievalError);
    }
    
    // Get answer
    console.log("🧠 Processing question with QA chain...");
    const response = await qaChain.invoke({
      input: question,
    });

    console.log(`--- ✅ QA Chain response received ---`);
    console.log(`📝 Answer: ${response.answer}`);
    console.log(`📚 Context documents: ${response.context?.length || 0}`);
    
    if (response.context && response.context.length > 0) {
      console.log("📄 Context sources:");
      response.context.forEach((doc: any, index: number) => {
        console.log(`  ${index + 1}. ${doc.pageContent?.substring(0, 100)}...`);
      });
    }

    console.log(`=== ✅ QUESTION ANSWERING COMPLETED ===`);

    return {
      answer: response.answer,
      sourceDocuments: response.context || [],
    };

  } catch (error) {
    console.error("=== ❌ QUESTION ANSWERING FAILED ===");
    console.error("Error details:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to answer question: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}