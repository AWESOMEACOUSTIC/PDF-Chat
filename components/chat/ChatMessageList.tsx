"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { ChatMessage, Citation } from "@/types/chat";
import CitationDrawer from "@/components/chat/CitationDrawer";

interface ChatMessageListProps {
  messages: ChatMessage[];
  sendingMessage: boolean;
}

interface MarkdownMessageProps {
  content: string;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 text-lg font-semibold text-gray-900">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 text-base font-semibold text-gray-900">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 text-sm font-semibold text-gray-900">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-gray-300 pl-3 text-gray-700 last:mb-0">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const text = String(children ?? "");
    const isBlock = text.includes("\n");

    if (isBlock) {
      const codeClassName = [
        "font-mono text-xs text-gray-100",
        className,
      ]
        .filter(Boolean)
        .join(" ");
      return (
        <code className={codeClassName} {...props}>
          {children}
        </code>
      );
    }

    return (
      <code
        className="rounded bg-gray-200/70 px-1 py-0.5 font-mono text-[0.85em] text-gray-800"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100 last:mb-0">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue-600 underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
};

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="text-sm leading-relaxed text-gray-800">
      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
    </div>
  );
}

export default function ChatMessageList({ messages, sendingMessage }: ChatMessageListProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);

  const openCitations = (citations?: Citation[]) => {
    if (!citations?.length) return;
    setActiveCitations(citations);
    setDrawerOpen(true);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.map((message) => {
        if (message.type === "system") {
          return (
            <div key={message.id} className="flex justify-center">
              <div className="max-w-[80%] rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {message.content}
              </div>
            </div>
          );
        }

        const isUser = message.type === "user";
        const hasCitations = message.type === "ai" && (message.citations?.length ?? 0) > 0;
        const timestampClass = isUser ? "text-blue-100" : "text-gray-500";

        return (
          <div
            key={message.id}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-3 ${
                isUser ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
              }`}
            >
              {message.type === "ai" ? (
                <MarkdownMessage content={message.content} />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </p>
              )}
              <div
                className={`mt-2 flex items-center text-xs ${
                  isUser || !hasCitations ? "justify-end" : "justify-between"
                }`}
              >
                <span className={timestampClass}>{formatDate(message.timestamp)}</span>
                {hasCitations ? (
                  <button
                    type="button"
                    onClick={() => openCitations(message.citations)}
                    className="rounded-full border border-gray-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:bg-white hover:text-gray-800"
                  >
                    Citation
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      
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

      <CitationDrawer
        open={drawerOpen}
        citations={activeCitations}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
