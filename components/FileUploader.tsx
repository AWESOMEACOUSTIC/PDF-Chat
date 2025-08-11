"use client"
import useUpload from '@/useUpload'
import { CircleArrowDown, RocketIcon } from 'lucide-react'
import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'



const FileUploader = () => {
    const {progress, status, fileId, handleUpload} = useUpload();  // to get the upload status

    const onDrop = useCallback( async (acceptedFiles: File[]) => {
        // Do something with the files

        const file = acceptedFiles[0]; // Get the first accepted file
        if(file){
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
                        status === 'uploading' ? (
                            <>
                                <RocketIcon className='h-20 w-20 animate-spin' />
                                <p>Uploading your file...</p>
                            </>
                        ) : status === 'uploaded' ? (
                            <>
                                <RocketIcon className='h-20 w-20 text-green-600' />
                                <p>File uploaded successfully!</p>
                                <p className='text-sm text-gray-600'>File ID: {fileId}</p>
                            </>
                        ) : status === 'error' ? (
                            <>
                                <CircleArrowDown className='h-16 w-16 text-red-600' />
                                <p className='text-red-600'>Upload failed. Please try again.</p>
                            </>
                        ) : isDragActive ? (
                            <>
                                <RocketIcon className='h-20 w-20 animate-ping' />
                                <p>Drop the files here ...</p>
                            </>
                        ) : (
                            <>
                                <CircleArrowDown className='h-16 w-16 animate-bounce' />
                                <p>Drag 'n' drop some files here, or click to select files</p>
                            </>
                        )
                    }
                </div>

            </div>
        </div>

    )
}

export default FileUploader