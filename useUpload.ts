"use client"; // custom hooks are always client side

import { useRouter } from "next/navigation";
import { useState } from "react";
import { v4 as uuidv4 } from 'uuid'; // to give unique ids to the uploaded files

export enum StatusText {
    UPLOADING = 'uploading',
    UPLOADED = 'uploaded',
    ERROR = 'error',
    IDLE = 'idle',
    SAVING = 'saving',
    GENERATING = 'generating'
}

export type Status = StatusText[keyof StatusText]

function useUpload() {
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>(StatusText.IDLE);
  const [fileId, setFileId] = useState<string | null>(null);
  const router = useRouter(); // used to redirect the user

  const handleUpload = async (file: File) => {
    console.log("handleUpload called with file:", { 
      name: file.name, 
      size: file.size, 
      type: file.type 
    });

    if (!file) {
      console.error("File not provided");
      return;
    }

    const fileIdToUploadTo = uuidv4();
    console.log("Generated file ID:", fileIdToUploadTo);
    setFileId(fileIdToUploadTo);

    setStatus(StatusText.UPLOADING);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileId', fileIdToUploadTo);
    formData.append('userId', 'demo-user'); // Since auth is removed, using demo user

    console.log("Form data prepared, making request to /api/upload");

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      console.log("Response received:", { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok 
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(StatusText.UPLOADED);
        console.log('Upload successful:', data);
        // Optionally redirect to dashboard or show success message
        // router.push('/dashboard');
      } else {
        const errorData = await response.json();
        console.error('Upload failed with status:', response.status);
        console.error('Error data:', errorData);
        setStatus(StatusText.ERROR);
      }
    } catch (error) {
      console.error('Upload error (network/parse):', error);
      setStatus(StatusText.ERROR);
    }
  };

  return { progress, status, fileId, handleUpload };
}

export default useUpload