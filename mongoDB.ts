import connectToDatabase from '@/lib/mongodb';
import { DocumentModel, ChatMessageModel } from '@/lib/models';

export { connectToDatabase as connectDB, DocumentModel as db, ChatMessageModel };

// For file storage, we'll use local file system or implement a different storage solution
// Storage functionality will be handled separately