import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "stream";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    // Since authentication is removed, we'll serve files without user check
    // In production, you might want to add some form of access control

    // Ensure database connection
    await connectToDatabase();
    
    // Get the database handle from mongoose
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MongoDB connection not ready");
    }

    // Create GridFS bucket
    const bucket = new GridFSBucket(db, { bucketName: "uploads" });

    // Validate and convert the ID to ObjectId
    let fileObjectId: ObjectId;
    try {
      fileObjectId = new ObjectId(params.id);
    } catch (error) {
      return NextResponse.json({ message: "Invalid file ID" }, { status: 400 });
    }

    // Find the file in GridFS
    const file = await db.collection("uploads.files").findOne({ 
      _id: fileObjectId
    });

    if (!file) {
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    // Check if this is a download request
    const downloadParam = req.nextUrl.searchParams.get("download");
    
    // Create download stream from GridFS
    const downloadStream = bucket.openDownloadStream(fileObjectId);
    
    // Convert Node.js stream to Web ReadableStream
    const webStream = Readable.toWeb(downloadStream) as unknown as ReadableStream;

    // Set appropriate headers
    const headers = new Headers({
      "Content-Type": file.contentType || "application/octet-stream",
      "Content-Length": file.length?.toString() || "0",
      "Cache-Control": "private, max-age=3600", // Cache for 1 hour
    });

    // Set Content-Disposition based on download parameter
    if (downloadParam === "true") {
      headers.set("Content-Disposition", `attachment; filename="${file.filename}"`);
    } else {
      headers.set("Content-Disposition", `inline; filename="${file.filename}"`);
    }

    return new NextResponse(webStream, { headers });

  } catch (error) {
    console.error("File download error:", error);
    
    // Handle specific GridFS errors
    if (error instanceof Error) {
      if (error.message.includes("FileNotFound")) {
        return NextResponse.json({ message: "File not found" }, { status: 404 });
      }
    }

    return NextResponse.json(
      { 
        message: "Failed to download file",
        error: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    );
  }
}
