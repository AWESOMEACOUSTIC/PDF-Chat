"use client";

import { Loader2 } from "lucide-react";

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  sendingMessage: boolean;
}

export default function ChatMessageList({ messages, sendingMessage }: ChatMessageListProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[70%] rounded-lg px-4 py-3 ${
              message.type === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            <p
              className={`text-xs mt-2 ${
                message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}
            >
              {formatDate(message.timestamp)}
            </p>
          </div>
        </div>
      ))}
      
      {sendingMessage && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
              <span className="text-gray-600">AI is thinking...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
