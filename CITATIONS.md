# Citation-Aware RAG Flow

## What This Feature Does
This adds source citations to every AI response. Each answer carries a list of the exact reranked chunks used for generation, and the UI exposes those sources via a citation drawer.

## Full Application Flow (Upload -> LLM Output -> UI)
Below is the complete pipeline from upload through retrieval, LLM generation, and frontend rendering.

### 1) Upload and Persistence
- components/FileUploader.tsx
  - Collects the PDF from the user and submits it to the upload endpoint.
- app/api/upload/route.ts (or the active upload route)
  - Stores the binary in GridFS and creates a Document record.
  - Returns { fileId, documentId, gridFsId }.
- lib/models.ts
  - Persists Document metadata and chat history.

### 2) Embedding Ingestion (Gatekeeper Before Embeddings)
- lib/langchain/documentLoader.ts
  - Extracts text, splits into chunks, and yields LangChain Document[]
  - Attaches metadata like chunkIndex and (optionally) pageNumber/sectionTitle.
- lib/langchain/trustVaildator.ts
  - Runs per-chunk validation via a lightweight OpenRouter model.
  - Enforces structured JSON output using JsonOutputParser.
  - Fails fast if the document is unsafe or irrelevant.
- lib/langchain/vectorStore.ts
  - generateEmbeddingsInPineconeVectorStore()
  - Calls generateDocs() then filterTrustedChunks() before embeddings.
  - If filterTrustedChunks throws SECURITY_VIOLATION, aborts ingest.
- app/api/embeddings/route.ts
  - Returns 403 with code SECURITY_VIOLATION when validation fails.
  - Purges the blocked document metadata and GridFS file.

### 3) Retrieval + Rerank + Answer
- app/api/chat/[fileId]/route.ts
  - Accepts question input and resolves gridFsId + docId.
  - Ensures embeddings exist (calls generateEmbeddingsInPineconeVectorStore).
  - If validation failed, returns 403 with code SECURITY_VIOLATION and purges the document.
- lib/langchain/index.ts
  - answerQuestionAboutDocument()
  - Runs hybrid retrieval (dense + sparse) -> reciprocal rank fusion.
  - Uses Pinecone inference reranker to pick top chunks.
  - Builds citations from the reranked chunks only.
  - Runs the QA or summary chain with the final docs.
  - Returns { answer, citations, sourceDocuments }.

### 4) API Response + Persistence
- app/api/chat/[fileId]/route.ts
  - Stores the chat message + citations in Mongo.
  - Returns { success, answer, citations, chat } to the client.
- app/api/chat/[fileId]/history/route.ts
  - Returns prior chat history with citations intact.

### 5) Frontend Rendering
- hooks/useChat.ts
  - Calls /api/chat and maps the response to ChatMessage objects.
  - If code SECURITY_VIOLATION, injects a red warning message and locks input for 2 minutes.
- components/chat/ChatMessageList.tsx
  - Renders user/AI messages.
  - Shows a Citation badge for AI messages with citations.
  - Renders system warning message in red when present.
- components/chat/CitationDrawer.tsx
  - Displays citation cards (document name, page, snippet, etc.).
- components/chat/ChatInput.tsx
  - Disables input during the 2 minute security lockout.

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
  - Shows a Citation badge on AI messages with citations.
  - Opens the drawer with that message's citations.
- components/chat/CitationDrawer.tsx
  - Renders the slide-in drawer with citation cards.

## Strategic Design Notes
- Only reranked chunks are cited.
  The citations are built directly from the reranked list in lib/langchain/index.ts,
  so the user sees the exact evidence that the model used.

- Blocked documents are removed.
  If trust validation fails during ingestion or first chat, the document metadata
  and GridFS file are deleted to avoid retaining unsafe content.

- History keeps citations intact.
  ChatMessage documents store citations, so reloading the chat restores
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
