import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/config/mongodb";
import { DocumentModel } from "@/lib/models";
import { generateEmbeddingsInPineconeVectorStore } from "@/lib/langchain";
import { purgeBlockedDocument } from "@/lib/securityCleanup";

export const runtime = "nodejs";

const SECURITY_VIOLATION_CODE = "SECURITY_VIOLATION";
const isSecurityViolationError = (error: unknown) =>
  error instanceof Error && error.message.startsWith(SECURITY_VIOLATION_CODE);

export async function POST(req: NextRequest) {
  let document: any = null;

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
    document = await DocumentModel.findOne({
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

    if (isSecurityViolationError(error)) {
      if (document) {
        try {
          await purgeBlockedDocument({
            documentId: document._id.toString(),
            gridFsId: document.metadata?.gridFsId,
          });
        } catch (cleanupError) {
          console.warn("Failed to purge blocked document:", cleanupError);
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Security violation",
          code: SECURITY_VIOLATION_CODE,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate embeddings",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}