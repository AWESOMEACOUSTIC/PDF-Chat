"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Components
import ChatHeader from "@/components/chat/ChatHeader";
import ChatMessageList from "@/components/chat/ChatMessageList";
import ChatInput from "@/components/chat/ChatInput";
import { LoadingState, ErrorState } from "@/components/ui/LoadingStates";

// Hooks
import { useChat } from "@/hooks/useChat";
import { useDocument } from "@/hooks/useDocument";

export default function DocumentChatPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.fileId as string;
  
  // Custom hooks for document and chat management
  const { document, loading, error } = useDocument(fileId);
  const {
    messages,
    inputMessage,
    sendingMessage,
    setInputMessage,
    initializeChat,
    handleSendMessage,
    handleKeyPress
  } = useChat({ fileId });

  // Initialize chat when document loads
  useEffect(() => {
    if (document) {
      initializeChat(document.fileName);
    }
  }, [document]);

  const handleBackClick = () => {
    router.push('/dashboard');
  };

  // Loading state
  if (loading) {
    return <LoadingState />;
  }

  // Error state
  if (error || !document) {
    return <ErrorState error={error} onBackClick={handleBackClick} />;
  }

  // Main chat interface
  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        fileName={document.fileName}
        uploadedAt={document.uploadedAt}
        fileUrl={document.fileUrl}
        onBackClick={handleBackClick}
      />
      
      <ChatMessageList 
        messages={messages} 
        sendingMessage={sendingMessage} 
      />
      
      <ChatInput
        inputMessage={inputMessage}
        sendingMessage={sendingMessage}
        fileName={document.fileName}
        onInputChange={setInputMessage}
        onSendMessage={handleSendMessage}
        onKeyPress={handleKeyPress}
      />
    </div>
  );
}