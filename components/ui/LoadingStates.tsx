"use client";

import { FileText, Loader2 } from "lucide-react";

interface LoadingStateProps {
  isLoading?: boolean;
}

export function LoadingState({ isLoading = true }: LoadingStateProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Loading document...</p>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  error?: string | null;
  onBackClick: () => void;
}

export function ErrorState({ error, onBackClick }: ErrorStateProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <FileText className="h-16 w-16 mx-auto mb-4 text-red-400" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Document Not Found</h2>
        <p className="text-gray-600 mb-4">{error || 'The requested document could not be found.'}</p>
        <button
          onClick={onBackClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
