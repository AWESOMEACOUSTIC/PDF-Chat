import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { DocumentModel } from "@/lib/models";
import { generateEmbeddingsInPineconeVectorStore } from "@/lib/langchain";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { fileId, userId = "demo-user" } = await req.json();

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find the document
    const document = await DocumentModel.findOne({
      clientFileId: fileId,
      userId
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const gridFsId = document.metadata.gridFsId;
    const docId = document._id.toString();

    console.log(`Starting embedding generation for document: ${document.fileName}`);

    // Generate embeddings
    const vectorStore = await generateEmbeddingsInPineconeVectorStore(gridFsId, docId);

    // Update document status to indicate embeddings are ready
    await DocumentModel.findByIdAndUpdate(document._id, {
      $set: {
        'metadata.embeddingsGenerated': true,
        'metadata.embeddingsGeneratedAt': new Date()
      }
    });

    console.log(`Embeddings generated successfully for document: ${document.fileName}`);

    return NextResponse.json({
      success: true,
      message: "Embeddings generated successfully",
      documentInfo: {
        fileName: document.fileName,
        docId: docId,
        gridFsId: gridFsId,
        embeddingsGenerated: true
      }
    });

  } catch (error) {
    console.error("Embeddings generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate embeddings",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}