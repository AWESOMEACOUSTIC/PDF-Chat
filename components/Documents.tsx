"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlaceholderDocument from "./PlaceholderDocument";

interface Document {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedAt: string;
  status: string;
  gridFsId: string;
}

function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch('/api/documents?userId=demo-user');
        const data = await response.json();
        
        if (data.success) {
          setDocuments(data.documents);
        } else {
          setError(data.message || 'Failed to fetch documents');
        }
      } catch (err) {
        setError('Error loading documents');
        console.error('Error fetching documents:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-wrap p-5 bg-gray-100 justify-center lg:justify-start rounded-sm gap-5 max-w-7xl mx-auto">
        <div className="text-gray-500">Loading documents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-wrap p-5 bg-gray-100 justify-center lg:justify-start rounded-sm gap-5 max-w-7xl mx-auto">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap p-5 bg-gray-100 justify-center lg:justify-start rounded-sm gap-5 max-w-7xl mx-auto">
      {documents.length === 0 ? (
        <PlaceholderDocument />
      ) : (
        documents.map((doc) => (
          <div
            key={doc.id}
            className="flex flex-col w-64 h-80 rounded-xl bg-white drop-shadow-md justify-between p-4 transition-all transform hover:scale-105 hover:drop-shadow-lg cursor-pointer"
          >
            {/* PDF Preview Area */}
            <div className="flex-1 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
              <div className="text-center">
                <div className="text-4xl mb-2">📄</div>
                <div className="text-xs text-gray-500">PDF Document</div>
              </div>
            </div>

            {/* Document Info */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-800 truncate" title={doc.fileName}>
                {doc.fileName}
              </h3>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Size: {formatFileSize(doc.fileSize)}</div>
                <div>Uploaded: {formatDate(doc.uploadedAt)}</div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    doc.status === 'uploaded' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {doc.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => router.push(`/dashboard/chat/${doc.fileId}`)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
              >
                Chat with PDF
              </button>
              <button
                onClick={() => window.open(`${doc.fileUrl}?download=true`, '_blank')}
                className="flex-1 px-3 py-2 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default Documents;