"use client";

import { useEffect, useState } from "react";
import { ChatHistoryResponse, ChatMessage, ChatResponse } from "@/types/chat";

interface UseChatProps {
  fileId: string;
  docId?: string;
  gridFsId?: string;
}

export function useChat({ fileId, docId, gridFsId }: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [lockUntil, setLockUntil] = useState<number | null>(null);

  const SECURITY_VIOLATION_CODE = "SECURITY_VIOLATION";
  const SECURITY_WARNING_MESSAGE =
    "You are being reported to the human resource team for using this service inappropriately";
  const LOCK_DURATION_MS = 2 * 60 * 1000;

  const isLocked = lockUntil !== null && Date.now() < lockUntil;

  useEffect(() => {
    if (lockUntil === null) return;

    const remainingMs = lockUntil - Date.now();
    if (remainingMs <= 0) {
      setLockUntil(null);
      return;
    }

    const timeout = setTimeout(() => {
      setLockUntil(null);
    }, remainingMs);

    return () => clearTimeout(timeout);
  }, [lockUntil]);

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

  const triggerSecurityLockdown = () => {
    const now = Date.now();
    setLockUntil(now + LOCK_DURATION_MS);
    setInputMessage("");
    setMessages((prev) => {
      const alreadyNotified = prev.some(
        (msg) => msg.type === "system" && msg.content === SECURITY_WARNING_MESSAGE
      );
      if (alreadyNotified) return prev;
      return [
        ...prev,
        {
          id: `security-${now}`,
          type: "system",
          content: SECURITY_WARNING_MESSAGE,
          timestamp: new Date(now),
        },
      ];
    });
  };

  const isSecurityViolation = (data: ChatResponse) => {
    if (data.success) return false;
    const errorMessage = data.error ?? "";
    return (
      data.code === SECURITY_VIOLATION_CODE ||
      errorMessage.startsWith(SECURITY_VIOLATION_CODE)
    );
  };

  const sendMessage = async (message: string): Promise<void> => {
    if (!message.trim() || sendingMessage || isLocked) return;

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
          question: userMessage.content,
          docId,
          gridFsId,
          userId: 'demo-user'
        })
      });

      const data: ChatResponse = await response.json();

      if (!response.ok || !data.success) {
        if (isSecurityViolation(data)) {
          triggerSecurityLockdown();
          return;
        }
        const errorMessage = !data.success
          ? data.error
          : "Failed to get AI response";
        throw new Error(errorMessage || "Failed to get AI response");
      }

      if (data.chatHistory && data.chatHistory.length > 0) {
        setMessages(mapHistoryToMessages(data.chatHistory));
        return;
      }

      const answer = data.answer ?? data.response ?? "";
      const citations = data.citations ?? data.chat?.citations ?? [];

      const aiMessage: ChatMessage = {
        id: data.chat?.id ? `${data.chat.id}-ai` : (Date.now() + 1).toString(),
        type: "ai",
        content: answer,
        citations,
        timestamp: data.chat?.timestamp ? new Date(data.chat.timestamp) : new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
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
    isLocked,
    setInputMessage,
    initializeChat,
    handleSendMessage,
    handleKeyPress
  };
}
