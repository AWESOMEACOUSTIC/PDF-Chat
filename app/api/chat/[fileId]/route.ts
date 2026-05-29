import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/config/mongodb";
import { ChatMessageModel, DocumentModel } from "@/lib/models";
import { 
  generateEmbeddingsInPineconeVectorStore, 
  answerQuestionAboutDocument 
} from "@/lib/langchain";
import type { Citation } from "@/lib/langchain";
import { validateUserQuery } from "@/lib/langchain/trustVaildator";
import { isLockedOut, recordViolation } from "@/lib/langchain/lockout";
import { purgeBlockedDocument } from "@/lib/securityCleanup";

export const runtime = "nodejs";

const SECURITY_VIOLATION_CODE = "SECURITY_VIOLATION";
const SECURITY_LOCKOUT_MESSAGE =
  "SECURITY_VIOLATION: You are temporarily locked out.";
const SECURITY_VIOLATION_MESSAGE =
  "SECURITY_VIOLATION: Your message violated our usage policy. This incident has been logged.";
const isSecurityViolationError = (error: unknown) =>
  error instanceof Error && error.message.startsWith(SECURITY_VIOLATION_CODE);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  let document: any = null;

  try {
    const {
      message,
      question,
      userId,
      includeHistory = false,
      historyLimit
    } = await req.json();
    const { fileId } = await params;

    const resolvedUserId =
      typeof userId === "string" && userId.trim().length > 0
        ? userId.trim()
        : "demo-user";
    const resolvedMessage =
      typeof message === "string"
        ? message.trim()
        : typeof question === "string"
        ? question.trim()
        : "";

    if (!resolvedMessage || !fileId) {
      return NextResponse.json(
        { error: "Message and fileId are required" },
        { status: 400 }
      );
    }

    if (isLockedOut(resolvedUserId)) {
      return NextResponse.json(
        {
          success: false,
          error: SECURITY_LOCKOUT_MESSAGE,
          code: SECURITY_VIOLATION_CODE,
        },
        { status: 403 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find the document and validate ownership
    document = await DocumentModel.findOne({
      clientFileId: fileId
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (document.userId !== resolvedUserId) {
      return NextResponse.json(
        { error: "Unauthorized access to document" },
        { status: 403 }
      );
    }

    const verdict = await validateUserQuery(resolvedMessage);
    if (!verdict.isSafe) {
      recordViolation(resolvedUserId, verdict.reason);
      return NextResponse.json(
        {
          success: false,
          error: SECURITY_VIOLATION_MESSAGE,
          code: SECURITY_VIOLATION_CODE,
        },
        { status: 403 }
      );
    }

    const gridFsId = document.metadata.gridFsId;
    const docId = document._id.toString();

    try {
      // Check if embeddings exist for this document, if not create them
      let aiResponse: string;
      let citations: Citation[] = [];
      
      console.log(`Processing chat for document: ${docId}, gridFsId: ${gridFsId}`);
      
      try {
        // Try to answer the question using existing embeddings
        console.log(`Attempting to answer question: "${resolvedMessage}"`);
        const result = await answerQuestionAboutDocument(gridFsId, docId, resolvedMessage);
        aiResponse = result.answer;
        citations = result.citations;
        console.log(`AI Response received: ${aiResponse.substring(0, 100)}...`);
        
        // If the answer indicates no information found, it might be the first query
        if (aiResponse.toLowerCase().includes("cannot find") || 
            aiResponse.toLowerCase().includes("no information")) {
          throw new Error("Embeddings might not exist");
        }
        
      } catch (embeddingError) {
        console.log("Embedding error occurred:", embeddingError);
        console.log("Creating embeddings for document:", docId);
        
        // Generate embeddings for this document
        await generateEmbeddingsInPineconeVectorStore(gridFsId, docId);
        
        // Wait a moment for Pinecone to index
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try answering again
        const result = await answerQuestionAboutDocument(gridFsId, docId, resolvedMessage);
        aiResponse = result.answer;
        citations = result.citations;
      }

      let savedChat = null;

      try {
        savedChat = await ChatMessageModel.create({
          documentId: docId,
          userId: resolvedUserId,
          message: resolvedMessage,
          response: aiResponse,
          citations,
          timestamp: new Date()
        });
      } catch (saveError) {
        console.error("Failed to persist chat message:", saveError);
      }

      let chatHistory;
      const resolvedHistoryLimit =
        typeof historyLimit === "number" && Number.isFinite(historyLimit) && historyLimit > 0
          ? Math.floor(historyLimit)
          : undefined;

      if (includeHistory || resolvedHistoryLimit) {
        try {
          let historyQuery = ChatMessageModel.find({ documentId: docId, userId: resolvedUserId })
            .sort({ timestamp: 1 });

          if (resolvedHistoryLimit) {
            historyQuery = historyQuery.limit(resolvedHistoryLimit);
          }

          const historyDocs = await historyQuery;
          chatHistory = historyDocs.map(chat => ({
            id: chat._id.toString(),
            message: chat.message,
            response: chat.response,
            citations: chat.citations ?? [],
            timestamp: chat.timestamp
          }));
        } catch (historyError) {
          console.error("Failed to fetch chat history:", historyError);
        }
      }

      return NextResponse.json({
        success: true,
        answer: aiResponse,
        citations,
        response: aiResponse,
        chat: savedChat
          ? {
              id: savedChat._id.toString(),
              message: savedChat.message,
              response: savedChat.response,
              citations: savedChat.citations ?? [],
              timestamp: savedChat.timestamp
            }
          : null,
        chatHistory,
        documentInfo: {
          fileName: document.fileName,
          fileSize: document.fileSize,
          uploadedAt: document.uploadedAt,
          gridFsId: document.metadata.gridFsId
        }
      });

    } catch (aiError) {
      console.error("AI processing error:", aiError);

      if (isSecurityViolationError(aiError)) {
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

        const message = aiError instanceof Error ? aiError.message : "Security violation";
        return NextResponse.json(
          {
            success: false,
            error: message,
            code: SECURITY_VIOLATION_CODE,
          },
          { status: 403 }
        );
      }
      
      // Fallback response if AI processing fails
      const fallbackResponse = `I'm having trouble processing your question about "${document.fileName}" right now. This could be due to:

• The document text extraction is still processing
• The AI service is temporarily unavailable
• The document format may not be supported

Please try asking your question again in a moment.

Document Info:
• File: ${document.fileName}
• Size: ${(document.fileSize / 1024 / 1024).toFixed(2)} MB
• Uploaded: ${document.uploadedAt.toLocaleDateString()}

Your question: "${resolvedMessage}"`;

      let savedChat = null;

      try {
        savedChat = await ChatMessageModel.create({
          documentId: docId,
          userId: resolvedUserId,
          message: resolvedMessage,
          response: fallbackResponse,
          citations: [],
          timestamp: new Date()
        });
      } catch (saveError) {
        console.error("Failed to persist fallback chat message:", saveError);
      }

      return NextResponse.json({
        success: true,
        answer: fallbackResponse,
        citations: [],
        response: fallbackResponse,
        chat: savedChat
          ? {
              id: savedChat._id.toString(),
              message: savedChat.message,
              response: savedChat.response,
              citations: savedChat.citations ?? [],
              timestamp: savedChat.timestamp
            }
          : null,
        documentInfo: {
          fileName: document.fileName,
          fileSize: document.fileSize,
          uploadedAt: document.uploadedAt,
          gridFsId: document.metadata.gridFsId
        }
      });
    }

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process chat message",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
