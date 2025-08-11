import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if MongoDB URI is configured
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      return NextResponse.json({
        success: false,
        message: 'MONGODB_URI environment variable not set',
        instructions: 'Please add MONGODB_URI=mongodb://localhost:27017/pdf-chat to your .env.local file'
      }, { status: 500 });
    }

    // Try to connect to MongoDB
    const { default: connectToDatabase } = await import('@/lib/mongodb');
    const { DocumentModel } = await import('@/lib/models');
    
    await connectToDatabase();
    
    // Test basic database operation
    const testResult = await DocumentModel.countDocuments();
    
    return NextResponse.json({
      success: true,
      message: 'MongoDB connection successful',
      mongoUri: mongoUri.replace(/\/\/[^@]*@/, '//***:***@'), // Hide credentials in response
      documentsCount: testResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('MongoDB test error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide helpful error messages
    let helpMessage = '';
    if (errorMessage.includes('ECONNREFUSED')) {
      helpMessage = 'MongoDB server is not running. Please start MongoDB with: mongod --dbpath=./data';
    } else if (errorMessage.includes('getaddrinfo ENOTFOUND')) {
      helpMessage = 'Cannot resolve MongoDB host. Check your MONGODB_URI.';
    }
    
    return NextResponse.json({
      success: false,
      message: 'MongoDB connection failed',
      error: errorMessage,
      help: helpMessage,
      mongodbInstallInstructions: {
        windows: 'Download MongoDB Community Server from https://www.mongodb.com/try/download/community',
        macOS: 'brew install mongodb/brew/mongodb-community',
        linux: 'sudo apt-get install mongodb-org'
      }
    }, { status: 500 });
  }
}
