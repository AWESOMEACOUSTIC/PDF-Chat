"use client";

import { Send } from "lucide-react";

interface ChatInputProps {
  inputMessage: string;
  sendingMessage: boolean;
  fileName: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

export default function ChatInput({ 
  inputMessage, 
  sendingMessage, 
  fileName, 
  onInputChange, 
  onSendMessage, 
  onKeyPress 
}: ChatInputProps) {
  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={`Ask questions about ${fileName}...`}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={sendingMessage}
        />
        <button
          onClick={onSendMessage}
          disabled={!inputMessage.trim() || sendingMessage}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Press Enter to send • Shift+Enter for new line
      </p>
    </div>
  );
}
