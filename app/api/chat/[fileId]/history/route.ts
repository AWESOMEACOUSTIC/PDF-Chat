import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/config/mongodb";
import { ChatMessageModel, DocumentModel } from "@/lib/models";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 }
      );
    }

    const userId = req.nextUrl.searchParams.get("userId") || "demo-user";
    const limitParam = req.nextUrl.searchParams.get("limit");
    let limit: number | undefined;

    if (limitParam) {
      const parsedLimit = Number.parseInt(limitParam, 10);
      if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
        return NextResponse.json(
          { error: "limit must be a positive integer" },
          { status: 400 }
        );
      }
      limit = parsedLimit;
    }

    await connectToDatabase();

    const document = await DocumentModel.findOne({ clientFileId: fileId });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (document.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized access to document" },
        { status: 403 }
      );
    }

    const documentId = document._id.toString();
    let historyQuery = ChatMessageModel.find({ documentId, userId })
      .sort({ timestamp: 1 });

    if (limit) {
      historyQuery = historyQuery.limit(limit);
    }

    const historyDocs = await historyQuery;
    const history = historyDocs.map(chat => ({
      id: chat._id.toString(),
      message: chat.message,
      response: chat.response,
      timestamp: chat.timestamp
    }));

    return NextResponse.json({
      success: true,
      history,
      historyCount: history.length,
      documentInfo: {
        fileId,
        documentId,
        fileName: document.fileName,
        fileSize: document.fileSize,
        uploadedAt: document.uploadedAt
      }
    });

  } catch (error) {
    console.error("Chat history error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch chat history",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
