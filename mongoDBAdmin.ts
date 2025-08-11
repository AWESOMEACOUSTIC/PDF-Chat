import connectToDatabase from '@/lib/mongodb';
import { DocumentModel, ChatMessageModel } from '@/lib/models';

// Database connection and models for server-side operations
export const connectToMongoDB = connectToDatabase;
export const adminDb = {
  documents: DocumentModel,
  chatMessages: ChatMessageModel,
};

// Initialize connection function for server-side operations
export async function initializeDatabase() {
  try {
    await connectToDatabase();
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    return false;
  }
}
