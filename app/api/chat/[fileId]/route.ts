import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { DocumentModel } from "@/lib/models";
import { 
  generateEmbeddingsInPineconeVectorStore, 
  answerQuestionAboutDocument 
} from "@/lib/langchain";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { message, userId = "demo-user" } = await req.json();
    const { fileId } = params;

    if (!message || !fileId) {
      return NextResponse.json(
        { error: "Message and fileId are required" },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find the document
    const document = await DocumentModel.findOne({
      clientFileId: fileId,
      userId
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const gridFsId = document.metadata.gridFsId;
    const docId = document._id.toString();

    try {
      // Check if embeddings exist for this document, if not create them
      let aiResponse: string;
      
      console.log(`Processing chat for document: ${docId}, gridFsId: ${gridFsId}`);
      
      try {
        // Try to answer the question using existing embeddings
        console.log(`Attempting to answer question: "${message}"`);
        const result = await answerQuestionAboutDocument(gridFsId, docId, message);
        aiResponse = result.answer;
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
        const result = await answerQuestionAboutDocument(gridFsId, docId, message);
        aiResponse = result.answer;
      }

      return NextResponse.json({
        success: true,
        response: aiResponse,
        documentInfo: {
          fileName: document.fileName,
          fileSize: document.fileSize,
          uploadedAt: document.uploadedAt,
          gridFsId: document.metadata.gridFsId
        }
      });

    } catch (aiError) {
      console.error("AI processing error:", aiError);
      
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

Your question: "${message}"`;

      return NextResponse.json({
        success: true,
        response: fallbackResponse,
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
