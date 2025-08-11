import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  console.log("=== MINIMAL UPLOAD TEST ===");
  
  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const fileId = form.get("fileId") as string | null;
    const userId = form.get("userId") as string | null;

    console.log("Received:", {
      file: file ? { name: file.name, size: file.size } : "No file",
      fileId,
      userId
    });

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file received" },
        { status: 400 }
      );
    }

    // Just return success without saving anything
    return NextResponse.json({
      success: true,
      message: "Minimal test successful",
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type
      }
    });

  } catch (error) {
    console.error("Minimal upload error:", error);
    return NextResponse.json(
      { success: false, message: "Upload failed", error: String(error) },
      { status: 500 }
    );
  }
}
