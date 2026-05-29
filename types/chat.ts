// Chat Message Types
export interface Citation {
  documentName: string;
  pageNumber: number;
  chunkId: string;
  chunkText: string;
  sectionTitle?: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  citations?: Citation[];
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
export interface ChatSuccessResponse {
  success: true;
  answer: string;
  citations: Citation[];
  response?: string;
  chat?: {
    id: string;
    message: string;
    response: string;
    citations?: Citation[];
    timestamp: string;
  } | null;
  chatHistory?: ChatHistoryItem[];
  documentInfo?: {
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    gridFsId: string;
  };
}

export interface ChatErrorResponse {
  success: false;
  error: string;
  details?: string;
  code?: string;
}

export type ChatResponse = ChatSuccessResponse | ChatErrorResponse;

export interface ChatHistoryItem {
  id: string;
  message: string;
  response: string;
  citations?: Citation[];
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
