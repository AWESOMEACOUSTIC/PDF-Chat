import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    console.log("Upload endpoint hit!");
    
    // Parse form-data
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const fileId = form.get("fileId") as string | null;
    const userId = form.get("userId") as string | null;

    console.log("Received data:", {
      file: file ? { name: file.name, size: file.size, type: file.type } : null,
      fileId,
      userId
    });

    if (!file || !fileId || !userId) {
      console.log("Missing required fields");
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Just return success for now to test the frontend
    return NextResponse.json({
      success: true,
      message: "Test upload successful",
      data: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileId,
        userId
      }
    });
  } catch (error) {
    console.error("Test upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Test upload failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
