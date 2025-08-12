"use client";

import { useState } from "react";
import { ChatMessage, ChatResponse } from "@/types/chat";

interface UseChatProps {
  fileId: string;
}

export function useChat({ fileId }: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const initializeChat = (fileName: string) => {
    setMessages([{
      id: '1',
      type: 'ai',
      content: `Hello! I'm ready to help you analyze "${fileName}". Ask me anything about this document!`,
      timestamp: new Date()
    }]);
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
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: data.response,
          timestamp: new Date()
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
