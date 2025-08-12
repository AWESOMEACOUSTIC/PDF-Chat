"use client";

import { ArrowLeft } from "lucide-react";

interface ChatHeaderProps {
  fileName: string;
  uploadedAt: string;
  fileUrl: string;
  onBackClick: () => void;
}

export default function ChatHeader({ 
  fileName, 
  uploadedAt, 
  fileUrl, 
  onBackClick 
}: ChatHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBackClick}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-800 truncate">
            Chat with {fileName}
          </h1>
          <p className="text-sm text-gray-500">
            Uploaded on {new Date(uploadedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.open(fileUrl, '_blank')}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            View PDF
          </button>
          <button
            onClick={() => window.open(`${fileUrl}?download=true`, '_blank')}
            className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
