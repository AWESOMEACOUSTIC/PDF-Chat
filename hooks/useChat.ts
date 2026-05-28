"use client";

import { useState } from "react";
import { ChatHistoryResponse, ChatMessage, ChatResponse } from "@/types/chat";

interface UseChatProps {
  fileId: string;
}

export function useChat({ fileId }: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const buildWelcomeMessage = (fileName: string): ChatMessage[] => ([{
    id: "welcome-message",
    type: "ai",
    content: `Hello! I'm ready to help you analyze "${fileName}". Ask me anything about this document!`,
    timestamp: new Date()
  }]);

  const mapHistoryToMessages = (history: ChatHistoryResponse["history"]) => {
    const mapped: ChatMessage[] = [];

    history.forEach((chat) => {
      const timestamp = new Date(chat.timestamp);
      mapped.push({
        id: `${chat.id}-user`,
        type: "user",
        content: chat.message,
        timestamp
      });
      mapped.push({
        id: `${chat.id}-ai`,
        type: "ai",
        content: chat.response,
        citations: chat.citations ?? [],
        timestamp
      });
    });

    return mapped;
  };

  const initializeChat = async (fileName: string) => {
    try {
      const response = await fetch(`/api/chat/${fileId}/history?userId=demo-user`, {
        method: "GET"
      });

      if (!response.ok) {
        setMessages(buildWelcomeMessage(fileName));
        return;
      }

      const data: ChatHistoryResponse = await response.json();

      if (data.success && data.history.length > 0) {
        setMessages(mapHistoryToMessages(data.history));
        return;
      }

      setMessages(buildWelcomeMessage(fileName));
    } catch (error) {
      console.error("Error loading chat history:", error);
      setMessages(buildWelcomeMessage(fileName));
    }
  };

  const sendMessage = async (message: string): Promise<void> => {
    if (!message.trim() || sendingMessage) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setSendingMessage(true);

    try {
      const response = await fetch(`/api/chat/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          userId: 'demo-user'
        })
      });

      const data: ChatResponse = await response.json();

      if (data.success) {
        if (data.chatHistory && data.chatHistory.length > 0) {
          setMessages(mapHistoryToMessages(data.chatHistory));
          return;
        }

        const answer = data.answer ?? data.response ?? "";
        const citations = data.citations ?? data.chat?.citations ?? [];

        const aiMessage: ChatMessage = {
          id: data.chat?.id ? `${data.chat.id}-ai` : (Date.now() + 1).toString(),
          type: 'ai',
          content: answer,
          citations,
          timestamp: data.chat?.timestamp ? new Date(data.chat.timestamp) : new Date()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        throw new Error(data.error || 'Failed to get AI response');
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendMessage = () => {
    sendMessage(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return {
    messages,
    inputMessage,
    sendingMessage,
    setInputMessage,
    initializeChat,
    handleSendMessage,
    handleKeyPress
  };
}
