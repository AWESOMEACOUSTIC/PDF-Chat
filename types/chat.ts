// Chat Message Types
export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// Document Types
export interface Document {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedAt: string;
  status: string;
  gridFsId: string;
}

// API Response Types
export interface ChatResponse {
  success: boolean;
  response: string;
  documentInfo?: {
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    gridFsId: string;
  };
  error?: string;
}

export interface DocumentsResponse {
  success: boolean;
  documents: Document[];
  message?: string;
}
