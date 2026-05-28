import mongoose, { Document, Schema } from 'mongoose';

export interface IDocument extends Document {
  clientFileId: string; // your UUID from the client
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedAt: Date;
  status: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'error';
  metadata?: {
    pages?: number;
    [key: string]: any;
  };
}

export interface ICitation {
  documentName: string;
  pageNumber: number;
  chunkId: string;
  chunkText: string;
  sectionTitle?: string;
}

const DocumentSchema: Schema = new Schema({
  clientFileId: { type: String, required: true, index: true, unique: true },
  userId: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['uploading', 'uploaded', 'processing', 'ready', 'error'],
    default: 'uploading',
  },
  metadata: { type: Schema.Types.Mixed, default: {} },
});

// Chat Message interface
export interface IChatMessage extends Document {
  documentId: string;
  userId: string;
  message: string;
  response: string;
  citations?: ICitation[];
  timestamp: Date;
}

const CitationSchema = new Schema(
  {
    documentName: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    chunkId: { type: String, required: true },
    chunkText: { type: String, required: true },
    sectionTitle: { type: String },
  },
  { _id: false }
);

// Chat Message Schema
const ChatMessageSchema: Schema = new Schema({
  documentId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  message: { type: String, required: true },
  response: { type: String, required: true },
  citations: { type: [CitationSchema], default: [] },
  timestamp: { type: Date, default: Date.now },
});

export const DocumentModel =
  mongoose.models.Document || mongoose.model<IDocument>('Document', DocumentSchema);

export const ChatMessageModel =
  mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
