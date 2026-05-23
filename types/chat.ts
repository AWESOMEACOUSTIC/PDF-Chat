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
  chat?: {
    id: string;
    message: string;
    response: string;
    timestamp: string;
  } | null;
  chatHistory?: ChatHistoryItem[];
  documentInfo?: {
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    gridFsId: string;
  };
  error?: string;
}

export interface ChatHistoryItem {
  id: string;
  message: string;
  response: string;
  timestamp: string;
}

export interface ChatHistoryResponse {
  success: boolean;
  history: ChatHistoryItem[];
  historyCount: number;
  documentInfo?: {
    fileId: string;
    documentId: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
  };
  error?: string;
}

export interface DocumentsResponse {
  success: boolean;
  documents: Document[];
  message?: string;
}
