import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { DocumentModel } from "@/lib/models";
import mongoose from "mongoose";

export async function GET() {
  try {
    // Test database connection
    await connectToDatabase();
    
    // Get database stats
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("MongoDB connection not ready");
    }

    // Check if we can query the database
    const collections = await db.listCollections().toArray();
    const documentsCount = await DocumentModel.countDocuments();
    
    // Check GridFS files
    const gridFSFiles = await db.collection("uploads.files").countDocuments();

    return NextResponse.json({
      success: true,
      message: "Database connection successful",
      data: {
        databaseName: db.databaseName,
        collections: collections.map(c => c.name),
        documentsCount,
        gridFSFiles,
        status: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
      }
    });
  } catch (error) {
    console.error("Database test error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
