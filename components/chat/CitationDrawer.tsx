"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { Citation } from "@/types/chat";

interface CitationDrawerProps {
  open: boolean;
  citations: Citation[];
  onClose: () => void;
}

export default function CitationDrawer({ open, citations, onClose }: CitationDrawerProps) {
  useEffect(() => {
    if (!open) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Citations"
        className={`absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out md:w-1/2 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Citations</p>
            <h2 className="text-lg font-semibold text-gray-900">
              {citations.length} source{citations.length === 1 ? "" : "s"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
            aria-label="Close citations"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {citations.map((citation, index) => {
              const pageLabel =
                citation.pageNumber > 0 ? `Page ${citation.pageNumber}` : "Page N/A";
              const previewText =
                citation.chunkText.length > 600
                  ? `${citation.chunkText.slice(0, 600)}...`
                  : citation.chunkText;
              return (
                <div
                  key={`${citation.chunkId}-${index}`}
                  className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {citation.documentName}
                      </p>
                      <p className="text-xs text-gray-500">{pageLabel}</p>
                      {citation.sectionTitle ? (
                        <p className="mt-1 text-xs font-medium text-gray-600">
                          Section: {citation.sectionTitle}
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] uppercase tracking-wide text-gray-500">
                      Chunk {index + 1}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                    {previewText}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
