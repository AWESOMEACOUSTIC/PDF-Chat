# Citation-Aware RAG Flow

## What This Feature Does
This adds source citations to every AI response. Each answer now carries a list of the exact reranked chunks used for generation, and the UI exposes those sources via a citation drawer.

## End-to-End Data Flow (Files and Responsibilities)
1) Retrieval + rerank pipeline
- lib/langchain/index.ts
  - Runs hybrid retrieval + rerank.
  - Builds the final citations array from the reranked chunks only.
  - Returns { answer, citations, sourceDocuments }.

2) API response and persistence
- app/api/chat/[fileId]/route.ts
  - Calls answerQuestionAboutDocument.
  - Persists citations with the chat message.
  - Returns { answer, citations } in the response payload.
- app/api/chat/[fileId]/history/route.ts
  - Returns chat history with citations when available.
- lib/models.ts
  - Stores citations on ChatMessage documents for history replay.

3) Frontend consumption and UI
- types/chat.ts
  - Adds Citation type and makes citations part of chat responses/messages.
- hooks/useChat.ts
  - Maps API responses into ChatMessage objects, including citations.
- components/chat/ChatMessageList.tsx
  - Shows a "Citation" badge on AI messages with citations.
  - Opens the drawer with that message's citations.
- components/chat/CitationDrawer.tsx
  - Renders the slide-in drawer with citation cards.

## Strategic Design Notes
- Only reranked chunks are cited.
  The citations are built directly from the reranked list in lib/langchain/index.ts,
  so the user sees the exact evidence that the model used.

- History keeps citations intact.
  ChatMessage documents now store citations, so reloading the chat restores
  the same sources that were shown when the answer was generated.

- Page numbers are best-effort.
  The current pipeline does not always emit page metadata. When missing, the
  UI displays "Page N/A". If you want accurate page numbers, update
  lib/langchain/documentLoader.ts to attach pageNumber on each chunk.

- Section titles are optional.
  If your parser provides headings (for example from LlamaParse), add
  metadata.sectionTitle when creating Document objects in documentLoader.ts.

## Future-Friendly Extension Points
- Enrich chunk metadata in lib/langchain/documentLoader.ts
  - Add pageNumber and sectionTitle when creating each chunk.
  - Those fields flow automatically into citations.

- UI enhancements in components/chat/CitationDrawer.tsx
  - Add "Open in PDF" deep links if you can resolve page offsets.
  - Add search or filters when documents get large.
