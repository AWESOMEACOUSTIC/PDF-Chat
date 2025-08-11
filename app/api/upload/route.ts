import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "stream";
import connectToDatabase from "@/lib/mongodb";
import { DocumentModel } from "@/lib/models";

export const runtime = "nodejs"; // required for Node streams

export async function POST(request: NextRequest) {
  console.log("Upload endpoint hit - starting upload process");

  try {
    // Connect to MongoDB (ensure your helper caches connections)
    console.log("Connecting to MongoDB...");
    await connectToDatabase();
    console.log("MongoDB connected successfully");

    // Parse form-data
    console.log("Parsing form data...");
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const fileId = form.get("fileId") as string | null; // your UUID
    const userId = form.get("userId") as string | null; // from client (no auth)

    console.log("Form data parsed:", {
      file: file ? { name: file.name, size: file.size, type: file.type } : null,
      fileId,
      userId,
    });

    if (!file || !fileId || !userId) {
      console.log("Missing required fields:", { file: !!file, fileId: !!fileId, userId: !!userId });
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      console.log("File is empty");
      return NextResponse.json(
        { success: false, message: "Empty file" },
        { status: 400 }
      );
    }

    // Get native db handle
    console.log("Getting database handle...");
    const db = mongoose.connection.db;
    if (!db) {
      console.error("MongoDB connection not ready");
      throw new Error("MongoDB connection not ready");
    }
    console.log("Database handle obtained");

    // Create GridFS bucket
    console.log("Creating GridFS bucket...");
    const bucket = new GridFSBucket(db, { bucketName: "uploads" });

    // Convert Web ReadableStream -> Node stream (no full buffering)
    function webStreamToNode(stream: ReadableStream<Uint8Array>) {
      const reader = stream.getReader();
      return new Readable({
        async read() {
          const { done, value } = await reader.read();
          if (done) this.push(null);
          else this.push(Buffer.from(value));
        },
      });
    }

    // Stream file to GridFS
    console.log("Starting file stream to GridFS...");
    const nodeStream = webStreamToNode(file.stream() as ReadableStream<Uint8Array>);
    const uploadStream = bucket.openUploadStream(file.name, {
      contentType: file.type || "application/octet-stream",
      metadata: {
        userId,
        clientFileId: fileId,
        mime: file.type,
        size: file.size,
        uploadedAt: new Date(),
      },
    });

    console.log("Streaming file to GridFS...");
    const gridFsId: string = await new Promise((resolve, reject) => {
      nodeStream
        .pipe(uploadStream)
        .on("error", (error) => {
          console.error("GridFS stream error:", error);
          reject(error);
        })
        .on("finish", () => {
          console.log("File streamed to GridFS successfully:", uploadStream.id.toString());
          resolve(uploadStream.id.toString());
        });
    });

    // Save metadata document (references GridFS file)
    console.log("Saving document metadata...");
    const document = await DocumentModel.create({
      clientFileId: fileId, // <-- store UUID here (not in _id)
      userId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      fileUrl: `/api/files/${gridFsId}`, // serve via a GET route
      status: "uploaded",
      uploadedAt: new Date(),
      metadata: {
        originalName: file.name,
        uploadDate: new Date().toISOString(),
        gridFsId,
        bucketName: "uploads",
      },
    });

    console.log("Upload completed successfully:", {
      fileId: document.clientFileId,
      documentId: document._id.toString(),
      gridFsId,
    });

    return NextResponse.json({
      success: true,
      fileId: document.clientFileId,        // your UUID
      documentId: document._id.toString(),  // Mongo ObjectId
      gridFsId,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "File upload failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
