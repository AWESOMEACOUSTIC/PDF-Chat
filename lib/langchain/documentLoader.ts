import "server-only";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import mongoose from "mongoose";
import connectToDatabase from "../config/mongodb";

import fs from "fs";
import os from "os";
import path from "path";
import LlamaCloud from '@llamaindex/llama-cloud';

const MIN_TEXT_LENGTH = 50;

// ==========================================
// TIER 1: The Fast & Cheap Parser (pdf-parse)
// ==========================================
async function extractWithPdfParse(pdfBuffer: Buffer): Promise<string> {
  try {
    const mod: any = await import("pdf-parse");
    const parse = mod.default ?? mod;
    const out = await parse(pdfBuffer);
    return (out?.text ?? "").trim();
  } catch (error) {
    console.warn("⚠️ pdf-parse extraction failed:", error);
    return "";
  }
}

// ==========================================
// TIER 2: The Heavy AI Parser (LlamaParse)
// ==========================================
async function extractWithLlamaParse(pdfBuffer: Buffer, fileName: string): Promise<string> {
  console.log("🚀 Initiating LlamaParse fallback for messy document...");
  
  // 1. Create a temporary file path
  const tempFilePath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);
  
  try {
    // 2. Write the GridFS buffer to a temporary file so LlamaCloud can stream it
    fs.writeFileSync(tempFilePath, pdfBuffer);

    // 3. Initialize LlamaCloud (relies on process.env.LLAMA_CLOUD_API_KEY)
    const client = new LlamaCloud({
      apiKey: process.env.LLAMA_CLOUD_API_KEY,
    });

    // 4. Upload and parse the document
    const file = await client.files.create({
      file: fs.createReadStream(tempFilePath),
      purpose: 'parse',
    });

    const result = await client.parsing.parse({
      file_id: file.id,
      tier: 'agentic',
      version: 'latest',
      expand: ['markdown']
    });

    // 5. Combine markdown from all extracted pages
    if (!result.markdown || !result.markdown.pages) return "";
    
    const combinedMarkdown = result.markdown.pages
      .map((page: any) => page.markdown)
      .join("\n\n");

    console.log("✅ LlamaParse extraction successful!");
    return combinedMarkdown.trim();

  } catch (error) {
    console.error("❌ LlamaParse fallback failed:", error);
    return "";
  } finally {
    // 6. Cleanup: ALWAYS delete the temp file to prevent server storage leaks
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

// ==========================================
// MAIN EXPORTER
// ==========================================
export async function generateDocs(
  gridFsId: string,
  docId: string
): Promise<Document[]> {
  if (!gridFsId || !docId) {
    throw new Error("gridFsId and docId are required.");
  }

  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB connection not ready");

  const bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: "uploads",
  });

  const fileObjectId = new mongoose.Types.ObjectId(gridFsId);
  const fileInfo = await db.collection("uploads.files").findOne({ _id: fileObjectId });

  if (!fileInfo) throw new Error(`PDF not found with GridFS ID: ${gridFsId}`);

  // Download PDF from GridFS into a buffer
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const stream = bucket.openDownloadStream(fileObjectId);
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve());
    stream.on("error", (error) => reject(error));
  });

  const pdfBuffer = Buffer.concat(chunks);
  const safeFileName = fileInfo.filename || "unknown.pdf";
  console.log(`PDF buffer size: ${pdfBuffer.length} bytes`);

  // ----------------------------------------------------
  // THE WATERFALL EXECUTION
  // ----------------------------------------------------
  let extractedText = await extractWithPdfParse(pdfBuffer);

  // If pdf-parse failed or returned gibberish (under our length limit), trigger fallback
  if (!extractedText || extractedText.length < MIN_TEXT_LENGTH) {
    console.warn("⚠️ Minimal text extracted natively. Document may be scanned or image-heavy.");
    extractedText = await extractWithLlamaParse(pdfBuffer, safeFileName);
  }

  // If BOTH failed, abort to avoid indexing empty vectors
  if (!extractedText || extractedText.length < MIN_TEXT_LENGTH) {
    throw new Error("No readable text found in PDF, even after OCR fallback.");
  }
  // ----------------------------------------------------

  // Split text into optimized chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const textChunks = await splitter.createDocuments([extractedText]);

  // Return LangChain Documents mapped with Pinecone-safe metadata
  return textChunks.map(
    (doc, i) =>
      new Document({
        pageContent: doc.pageContent,
        metadata: {
          docId,
          gridFsId,
          chunkIndex: i,
          fileName: safeFileName,
          uploadDate: fileInfo.uploadDate ? new Date(fileInfo.uploadDate).toISOString() : new Date().toISOString(),
        },
      })
  );
}