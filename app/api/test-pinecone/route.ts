import { NextRequest, NextResponse } from "next/server";
import pinecone from "@/lib/pinecone";
import { indexName } from "@/lib/langchain";

export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("🧪 Testing Pinecone connection...");
    
    // Test basic Pinecone connection
    const index = pinecone.Index(indexName);
    console.log(`✅ Pinecone index '${indexName}' initialized`);
    
    // Get index stats
    const stats = await index.describeIndexStats();
    console.log("📊 Pinecone index stats:", JSON.stringify(stats, null, 2));
    
    // Test OpenAI embeddings
    console.log("🧠 Testing OpenAI embeddings...");
    const { OpenAIEmbeddings } = await import("@langchain/openai");
    const embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const testEmbedding = await embeddings.embedQuery("test query");
    console.log(`✅ OpenAI embeddings working, dimension: ${testEmbedding.length}`);
    
    return NextResponse.json({
      success: true,
      pinecone: {
        indexName,
        stats,
        totalVectors: stats.totalRecordCount || 0,
        namespaces: Object.keys(stats.namespaces || {}),
      },
      openai: {
        embeddingDimension: testEmbedding.length,
        working: true,
      },
      environment: {
        hasPineconeKey: !!process.env.PINECONE_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      }
    });
    
  } catch (error) {
    console.error("❌ Pinecone test failed:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      environment: {
        hasPineconeKey: !!process.env.PINECONE_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      }
    }, { status: 500 });
  }
}
