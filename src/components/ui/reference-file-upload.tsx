'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ReferenceFile } from '@/lib/supabase'
import { Upload, FileText, Image, X, AlertCircle } from 'lucide-react'

interface ReferenceFileUploadProps {
  files: ReferenceFile[]
  onChange: (files: ReferenceFile[]) => void
  maxFiles?: number
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp'
]

export function ReferenceFileUpload({ 
  files, 
  onChange, 
  maxFiles = 5 
}: ReferenceFileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const uploadFile = async (file: File): Promise<ReferenceFile | null> => {
    console.log('ReferenceFileUpload: Uploading file:', file.name)
    
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-reference', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()
      console.log('ReferenceFileUpload: Upload successful:', result)
      
      // The API now returns the file metadata directly
      return result
    } catch (error) {
      console.error('ReferenceFileUpload: Upload error:', error)
      throw error
    }
  }

  const deleteFile = async (file: ReferenceFile): Promise<void> => {
    console.log('ReferenceFileUpload: Deleting file:', file.name)
    
    try {
      const response = await fetch(`/api/upload-reference?id=${file.id}&url=${encodeURIComponent(file.url)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Delete failed')
      }

      console.log('ReferenceFileUpload: Delete successful')
    } catch (error) {
      console.error('ReferenceFileUpload: Delete error:', error)
      throw error
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploadError(null)
    
    // Check if adding these files would exceed the limit
    if (files.length + acceptedFiles.length > maxFiles) {
      setUploadError(`Cannot upload more than ${maxFiles} files`)
      return
    }

    setIsUploading(true)
    const newFiles: ReferenceFile[] = []

    try {
      for (const file of acceptedFiles) {
        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          throw new Error(`Invalid file type: ${file.type}. Only PDF, PNG, JPG, and WebP files are allowed.`)
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`File ${file.name} is too large. Maximum size is 5MB.`)
        }

        const uploadedFile = await uploadFile(file)
        if (uploadedFile) {
          newFiles.push(uploadedFile)
        }
      }

      // Update the files list
      onChange([...files, ...newFiles])
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
      
      // Clean up any files that were uploaded before the error
      for (const file of newFiles) {
        try {
          await deleteFile(file)
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded file:', cleanupError)
        }
      }
    } finally {
      setIsUploading(false)
    }
  }, [files, onChange, maxFiles])

  const handleRemoveFile = async (fileToRemove: ReferenceFile) => {
    try {
      await deleteFile(fileToRemove)
      onChange(files.filter(file => file.id !== fileToRemove.id))
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp']
    },
    maxFiles: maxFiles - files.length,
    disabled: isUploading || files.length >= maxFiles
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${isUploading || files.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 mb-1">
          {isDragActive ? 'Drop files here...' : 'Drag & drop reference files here, or click to select'}
        </p>
        <p className="text-xs text-gray-500">
          PDF, PNG, JPG, WebP up to 5MB ({files.length}/{maxFiles} files)
        </p>
      </div>

      {/* Upload Status */}
      {isUploading && (
        <div className="flex items-center justify-center p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-sm text-blue-700">Uploading files...</span>
        </div>
      )}

      {/* Error Display */}
      {uploadError && (
        <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="h-4 w-4 text-red-600 mr-2 flex-shrink-0" />
          <span className="text-sm text-red-700">{uploadError}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Uploaded Files</Label>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-gray-50 border rounded-md"
            >
              <div className="flex items-center flex-1 min-w-0">
                {file.type === 'application/pdf' ? (
                  <FileText className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                ) : (
                  <Image className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveFile(file)}
                className="text-red-600 hover:text-red-700 ml-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 