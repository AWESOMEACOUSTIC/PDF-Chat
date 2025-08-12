"use client"; // custom hooks are always client side

import { useRouter } from "next/navigation";
import { useState } from "react";
import { v4 as uuidv4 } from 'uuid'; // to give unique ids to the uploaded files

export enum StatusText {
    UPLOADING = 'uploading',
    UPLOADED = 'uploaded',
    SUCCESS = 'success',
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
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    fileId: string;
    documentId: string;
    gridFsId: string;
    fileName: string;
  } | null>(null);
  const [redirectTimer, setRedirectTimer] = useState<NodeJS.Timeout | null>(null);
  const router = useRouter(); // used to redirect the user

  const cancelRedirect = () => {
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      setRedirectTimer(null);
    }
    setStatus(StatusText.IDLE);
    setFileId(null);
    setProgress(null); // Reset progress when canceling
    setUploadedFileInfo(null); // Reset uploaded file info
  };

  const fetchUploadedFile = async (gridFsId: string) => {
    try {
      console.log(`Fetching uploaded file with GridFS ID: ${gridFsId}`);
      // Just verify the file exists - we'll handle display in the dashboard
      const response = await fetch(`/api/files/${gridFsId}`, {
        method: 'HEAD', // Just check if file exists without downloading
      });
      
      if (response.ok) {
        console.log('File successfully verified on server');
        return true;
      } else {
        console.warn('File verification failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error verifying uploaded file:', error);
      return false;
    }
  };

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
    setProgress(0); // Initialize progress
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileId', fileIdToUploadTo);
    formData.append('userId', 'demo-user'); // Since auth is removed, using demo user

    console.log("Form data prepared, making request to /api/upload");

    try {
      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
          console.log(`Upload progress: ${percentComplete}%`);
        }
      };

      // Handle response
      const response = await new Promise<Response>((resolve, reject) => {
        xhr.onload = () => {
          const response = new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: new Headers(xhr.getAllResponseHeaders().split('\r\n').reduce((headers, line) => {
              const [key, value] = line.split(': ');
              if (key && value) headers[key] = value;
              return headers;
            }, {} as Record<string, string>))
          });
          resolve(response);
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload aborted'));

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });

      console.log("Response received:", { 
        status: response.status, 
        statusText: response.statusText,
        ok: response.ok 
      });

      if (response.ok) {
        const data = await response.json();
        setProgress(100); // Ensure progress shows 100% on success
        
        // Store uploaded file information
        const uploadedFile = {
          fileId: data.fileId,
          documentId: data.documentId,
          gridFsId: data.gridFsId,
          fileName: file.name
        };
        setUploadedFileInfo(uploadedFile);
        
        console.log('Upload successful:', data);
        
        // Verify the file exists on the server
        const fileExists = await fetchUploadedFile(data.gridFsId);
        if (fileExists) {
          console.log('File verified successfully on server');
        }
        
        setStatus(StatusText.SUCCESS);
        
        // Set up redirect timer
        const timer = setTimeout(() => {
          router.push('/dashboard');
        }, 5000);
        setRedirectTimer(timer);
      } else {
        const errorData = await response.json();
        console.error('Upload failed with status:', response.status);
        console.error('Error data:', errorData);
        setStatus(StatusText.ERROR);
        setProgress(null); // Reset progress on error
      }
    } catch (error) {
      console.error('Upload error (network/parse):', error);
      setStatus(StatusText.ERROR);
      setProgress(null); // Reset progress on error
    }
  };

  return { progress, status, fileId, uploadedFileInfo, handleUpload, cancelRedirect };
}

export default useUpload