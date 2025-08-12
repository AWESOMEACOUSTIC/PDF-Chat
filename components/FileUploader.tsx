"use client"
import useUpload, { StatusText } from '@/useUpload'
import { CircleArrowDown, RocketIcon, CheckCircle } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'



const FileUploader = () => {
      const {
    progress,
    status,
    fileId,
    handleUpload,
    cancelRedirect
  } = useUpload();  // to get the upload status
    const [countdown, setCountdown] = useState(3);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');

    // Countdown timer for redirect
    useEffect(() => {
        if (status === StatusText.SUCCESS) {
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        }
    }, [status]);

    const onDrop = useCallback( async (acceptedFiles: File[]) => {
        // Do something with the files

        const file = acceptedFiles[0]; // Get the first accepted file
        if(file){
            setUploadedFileName(file.name);
            setCountdown(3); // Reset countdown
            await handleUpload(file);
        }else{
            // do nothing..
            //toast...
        }
    }, [handleUpload])

    const { getRootProps, getInputProps, isDragActive, isFocused } = 
        useDropzone({ 
            onDrop,
            maxFiles: 1,
            accept : {
                "application/pdf": [".pdf"]
            }
        })

    return (
        <div className='flex flex-col items-center max-w-7xl mx-auto'>
            <div {...getRootProps()}
                className={`p-10 border-2 bg-indigo-300/40 mt-10 w-[90%] text-indigo-600 rounded-lg h-95 flex items-center justify-center text-center border-dashed ${isDragActive ? 'border-blue-500' : 'border-gray-300'} ${isFocused ? 'outline-none ring-2 ring-blue-500' : ''}`}>
                <input {...getInputProps()} />
                <div className='flex flex-col items-center justify-center'>
                    {
                        status === StatusText.UPLOADING ? (
                            <>
                                <RocketIcon className='h-20 w-20 animate-spin text-blue-600' />
                                <p className="text-lg font-semibold text-blue-600 mt-4">Uploading your file...</p>
                                <p className="text-sm text-gray-600">Please wait while we process your PDF</p>
                            </>
                        ) : status === StatusText.SUCCESS ? (
                            <>
                                <CheckCircle className='h-24 w-24 text-green-600 animate-pulse' />
                                <p className="text-xl font-bold text-green-600 mt-4">Upload Completed!</p>
                                <p className="text-lg text-gray-700 mt-2">{uploadedFileName}</p>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4 max-w-md">
                                    <p className="text-sm text-green-700 font-medium">✅ File successfully uploaded</p>
                                    <p className="text-xs text-green-600 mt-1">File ID: {fileId}</p>
                                    <p className="text-sm text-green-700 mt-3">
                                        Redirecting to dashboard in <span className="font-bold text-green-800">{countdown}</span> seconds...
                                    </p>
                                    <div className="flex gap-3 mt-4">
                                        <button
                                            onClick={cancelRedirect}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Upload Another File
                                        </button>
                                        <button
                                            onClick={() => window.location.href = '/dashboard'}
                                            className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                                        >
                                            Go to Dashboard
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : status === StatusText.ERROR ? (
                            <>
                                <CircleArrowDown className='h-16 w-16 text-red-600' />
                                <p className='text-red-600 text-lg font-semibold'>Upload failed. Please try again.</p>
                                <p className='text-sm text-gray-600 mt-2'>Check your internet connection and try again</p>
                            </>
                        ) : isDragActive ? (
                            <>
                                <RocketIcon className='h-20 w-20 animate-ping text-indigo-600' />
                                <p className="text-lg font-semibold">Drop the files here ...</p>
                            </>
                        ) : (
                            <>
                                <CircleArrowDown className='h-16 w-16 animate-bounce text-indigo-600' />
                                <p className="text-lg font-semibold mb-2">Drag 'n' drop some files here, or click to select files</p>
                                <p className="text-sm text-gray-600">Supports PDF files only</p>
                            </>
                        )
                    }
                </div>

            </div>
        </div>

    )
}

export default FileUploader