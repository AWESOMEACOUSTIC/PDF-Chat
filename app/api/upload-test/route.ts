import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Upload endpoint is accessible",
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  console.log("=== UPLOAD ENDPOINT TEST ===");
  console.log("Request received at upload endpoint");
  
  return NextResponse.json({
    success: true,
    message: "Upload endpoint POST is working",
    timestamp: new Date().toISOString()
  });
}
