import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { DocumentModel } from "@/lib/models";

export const runtime = "nodejs";
// error handling audit to check the connections 
export async function GET() {
  try {
    console.log("Testing database connection...");
    
    // Test MongoDB connection
    await connectToDatabase();
    console.log("MongoDB connected successfully");
    
    // Test document retrieval
    const documents = await DocumentModel.find({}).limit(5);
    console.log(`Found ${documents.length} documents in database`);
    
    // Test environment variables
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasPinecone = !!process.env.PINECONE_API_KEY;
    
    console.log(`OpenAI API Key present: ${hasOpenAI}`);
    console.log(`Pinecone API Key present: ${hasPinecone}`);
    
    return NextResponse.json({
      success: true,
      mongodb: "connected",
      documentsCount: documents.length,
      documents: documents.map(doc => ({
        id: doc._id,
        fileName: doc.fileName,
        clientFileId: doc.clientFileId,
        gridFsId: doc.metadata?.gridFsId
      })),
      environment: {
        hasOpenAI,
        hasPinecone,
        mongoUri: process.env.MONGODB_URI?.replace(/\/\/.*@/, '//[HIDDEN]@') || 'not set'
      }
    });
    
  } catch (error) {
    console.error("Debug API error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
