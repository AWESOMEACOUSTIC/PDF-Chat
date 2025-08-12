"use client";

import { useState, useEffect } from "react";
import { Document, DocumentsResponse } from "@/types/chat";

export function useDocument(fileId: string) {
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!fileId) return;

      try {
        const response = await fetch(`/api/documents?userId=demo-user`);
        const data: DocumentsResponse = await response.json();
        
        if (data.success) {
          const foundDoc = data.documents.find((doc: Document) => doc.fileId === fileId);
          if (foundDoc) {
            setDocument(foundDoc);
          } else {
            setError('Document not found');
          }
        } else {
          setError(data.message || 'Failed to fetch document');
        }
      } catch (err) {
        setError('Error loading document');
        console.error('Error fetching document:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [fileId]);

  return { document, loading, error };
}
