'use client'

import { useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ProductType } from '@/lib/supabase'
import { Sparkles, Upload, Copy, Check, Trash2, History, Settings, HelpCircle, RefreshCcw } from 'lucide-react'
import Link from 'next/link'

type CopyMode = 'improve_copy' | 'write_new' | 'suggest_pattern'
type UserType = 'traveler' | 'admin'
type ErrorType = 'user' | 'system' | 'external'
type Surface = 'inline' | 'banner' | 'modal' | 'form' | 'page' | 'toast'

export default function HomePage() {
  // Core state
  const [mode, setMode] = useState<CopyMode>('improve_copy')
  const [badCopy, setBadCopy] = useState('')
  const [selectedProductType, setSelectedProductType] = useState('')
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  
  // New workflow fields
  const [userType, setUserType] = useState<UserType>('traveler')
  const [errorType, setErrorType] = useState<ErrorType>('user')
  const [canFix, setCanFix] = useState<string>('yes')
  const [surface, setSurface] = useState<Surface>('inline')
  
  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [copiedStates, setCopiedStates] = useState<boolean[]>([])
  const [uploadFeedback, setUploadFeedback] = useState<string>('')
  const [isHighlighted, setIsHighlighted] = useState(false)

  // Load product types on mount
  useEffect(() => {
    fetchProductTypes()
  }, [])

  // Cleanup preview URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Global paste listener for anywhere on the page
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            handleImageUpload(file, true) // Pass true to trigger highlight
            break
          }
        }
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => {
      window.removeEventListener('paste', handleGlobalPaste)
    }
  }, [])

  const fetchProductTypes = async () => {
    try {
      const response = await fetch('/api/product-types')
      if (response.ok) {
        const types = await response.json()
        setProductTypes(types)
      }
    } catch (error) {
      console.error('Failed to fetch product types:', error)
    }
  }

  // Combined image upload handler for drop, paste, and file input
  const handleImageUpload = (file: File, shouldHighlight = false) => {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      setUploadFeedback('Please upload a valid image file (PNG, JPG, WebP, or GIF)')
      setTimeout(() => setUploadFeedback(''), 3000)
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadFeedback('File size must be less than 5MB')
      setTimeout(() => setUploadFeedback(''), 3000)
      return
    }

    // Clean up previous preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    // Generate preview URL
    try {
      const newPreviewUrl = URL.createObjectURL(file)
      setPreviewUrl(newPreviewUrl)
    } catch (error) {
      console.error('Failed to create preview:', error)
      setPreviewUrl(null)
    }

    // Set the file and show success feedback
    setUploadedFile(file)
    setUploadFeedback('Screenshot added successfully!')
    setTimeout(() => setUploadFeedback(''), 2000)

    // Highlight the upload area briefly if requested (for global paste)
    if (shouldHighlight) {
      setIsHighlighted(true)
      setTimeout(() => setIsHighlighted(false), 2000)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0]
        if (rejection.errors.some(error => error.code === 'file-too-large')) {
          setUploadFeedback('File size must be less than 5MB')
        } else if (rejection.errors.some(error => error.code === 'file-invalid-type')) {
          setUploadFeedback('Please upload a valid image file')
        } else {
          setUploadFeedback('Upload failed. Please try again.')
        }
        setTimeout(() => setUploadFeedback(''), 3000)
        return
      }

      if (acceptedFiles.length > 0) {
        handleImageUpload(acceptedFiles[0])
      }
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation based on mode
    if (mode === 'improve_copy' && (!badCopy.trim() || !selectedProductType)) return
    if (mode === 'write_new' && !selectedProductType) return
    if (mode === 'suggest_pattern' && !selectedProductType) return

    setIsGenerating(true)
    setSuggestions([])
    setCopiedStates([])

    try {
      const formData = new FormData()
      
      // Core fields
      formData.append('mode', mode)
      formData.append('productTypeId', selectedProductType)
      
      // Mode-specific fields
      if (mode === 'improve_copy') {
        formData.append('badCopy', badCopy.trim())
      } else if (mode === 'write_new') {
        formData.append('inputCopy', badCopy.trim() || '') // Optional for new copy mode
        formData.append('userType', userType)
        formData.append('errorType', errorType)
        formData.append('canFix', canFix)
        formData.append('surface', surface)
      } else if (mode === 'suggest_pattern') {
        formData.append('userType', userType)
        formData.append('surface', surface)
      }
      
      // Optional screenshot for all modes
      if (uploadedFile) {
        formData.append('screenshot', uploadedFile)
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to generate suggestions')
      }

      const data = await response.json()
      setSuggestions(data.suggestions)
      setCopiedStates(new Array(data.suggestions.length).fill(false))
    } catch (error) {
      console.error('Generation error:', error)
      setSuggestions([`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`])
      setCopiedStates([false])
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedStates(prev => prev.map((copied, i) => i === index ? true : copied))
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopiedStates(prev => prev.map((copied, i) => i === index ? false : copied))
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const removeFile = () => {
    // Clean up preview URL before removing
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setUploadedFile(null)
    setPreviewUrl(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Sparkles className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">CopyFixer</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/history">
                  <History className="h-4 w-4 mr-2" />
                  History
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        {/* Hero Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            AI-Powered Copy Assistant
          </h2>
          <p className="text-lg text-gray-600 leading-tight max-w-xl mx-auto text-center">
            Improve existing copy, write new error messages, or get UX pattern recommendations—all powered by intelligent AI.
          </p>
        </div>

        {/* Main Form Card */}
        <Card className="mb-12 bg-white border border-gray-200 shadow-sm rounded-xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-semibold text-gray-900">Choose Your Copy Challenge</CardTitle>
            <CardDescription className="text-gray-600 text-base leading-relaxed max-w-[52ch]">
              Select what type of help you need, and we'll provide tailored suggestions based on your context.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Mode Selector */}
              <div className="space-y-3 pb-4 border-b border-gray-200">
                <Label htmlFor="mode-selector" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  What do you want help with?
                  <HelpCircle className="h-4 w-4 text-gray-400" />
                </Label>
                <Select value={mode} onValueChange={(value: CopyMode) => setMode(value)}>
                  <SelectTrigger id="mode-selector" className="w-full h-12">
                    <SelectValue placeholder="Choose what type of help you need" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="improve_copy">Improve existing error message</SelectItem>
                    <SelectItem value="write_new">Write a new error message</SelectItem>
                    <SelectItem value="suggest_pattern">Recommend a design pattern</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional Form Fields Based on Mode */}
              {mode === 'improve_copy' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Original Copy */}
                  <div className="space-y-3">
                    <Label htmlFor="bad-copy" className="text-sm font-medium text-gray-700">
                      Original Copy
                    </Label>
                    <Textarea
                      id="bad-copy"
                      placeholder="e.g., Oops! Something went wrong. Please try again."
                      value={badCopy}
                      onChange={(e) => setBadCopy(e.target.value)}
                      className="min-h-[200px] md:min-h-[240px] text-base leading-relaxed resize-none"
                      required
                    />
                  </div>

                  {/* Right Column - Product Context + Screenshot */}
                  <div className="flex flex-col space-y-4 min-w-0">
                    {/* Product Context */}
                    <div className="w-full space-y-3">
                      <Label htmlFor="product-type" className="text-sm font-medium text-gray-700">
                        Where does this appear?
                      </Label>
                      <Select value={selectedProductType} onValueChange={setSelectedProductType} required>
                        <SelectTrigger id="product-type" className="w-full h-12">
                          <SelectValue placeholder="Choose a product context to tailor the tone" />
                        </SelectTrigger>
                        <SelectContent>
                          {productTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Screenshot Upload */}
                    <div className="w-full space-y-3">
                      <Label className="text-sm font-medium text-gray-700">
                        Upload a Screenshot (Optional)
                      </Label>
                      {!uploadedFile ? (
                        <div
                          {...getRootProps()}
                          tabIndex={0}
                          role="button"
                          className={`w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 h-32 flex flex-col items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            isDragActive 
                              ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
                              : isHighlighted
                              ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400 scale-[1.02]'
                              : uploadFeedback.includes('successfully')
                              ? 'border-green-500 bg-green-50'
                              : uploadFeedback && uploadFeedback.includes('File size') || uploadFeedback.includes('Please upload')
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          <input {...getInputProps()} />
                          <Upload className="h-6 w-6 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600 mb-1">
                            {isDragActive ? 'Drop screenshot here' : isHighlighted ? 'Image pasted!' : 'Add context if the copy depends on layout or visuals'}
                          </p>
                          <p className="text-xs text-gray-500">Drag, paste anywhere (⌘+V), or click • Max file size: 5MB</p>
                          {uploadFeedback && (
                            <p className={`text-xs mt-2 font-medium ${
                              uploadFeedback.includes('successfully') 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {uploadFeedback}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="w-full border border-gray-300 rounded-lg p-4 bg-gray-50 transition-all duration-200">
                          <div className="flex flex-col md:flex-row gap-4 items-start">
                            {/* Image Preview */}
                            {previewUrl ? (
                              <div className="flex-shrink-0">
                                <img
                                  src={previewUrl}
                                  alt="Screenshot preview"
                                  className="h-20 w-20 object-cover rounded-md border bg-white shadow-sm"
                                  onError={() => setPreviewUrl(null)}
                                />
                              </div>
                            ) : (
                              <div className="flex-shrink-0 h-20 w-20 bg-gray-200 rounded-md border flex items-center justify-center">
                                <Upload className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            
                            {/* File Details */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{uploadedFile.name}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {Math.round(uploadedFile.size / 1024)} KB • {uploadedFile.type.split('/')[1].toUpperCase()}
                              </p>
                              <p className="text-xs text-green-600 mt-1">✓ Ready to upload</p>
                            </div>
                            
                            {/* Delete Button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={removeFile}
                              className="flex-shrink-0 hover:bg-red-50 hover:text-red-600 transition-colors self-start"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {mode === 'write_new' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - New Copy */}
                  <div className="space-y-3">
                    <Label htmlFor="new-copy" className="text-sm font-medium text-gray-700">
                      New Copy
                    </Label>
                    <Textarea
                      id="new-copy"
                      placeholder="e.g., Oops! Something went wrong. Please try again."
                      value={badCopy}
                      onChange={(e) => setBadCopy(e.target.value)}
                      className="min-h-[200px] md:min-h-[240px] text-base leading-relaxed resize-none"
                      required
                    />
                  </div>

                  {/* Right Column - User Context */}
                  <div className="flex flex-col space-y-4 min-w-0">
                    <Label htmlFor="user-type" className="text-sm font-medium text-gray-700">
                      Who is this for?
                    </Label>
                    <Select value={userType} onValueChange={(value) => setUserType(value as UserType)}>
                      <SelectTrigger id="user-type" className="w-full h-12">
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="traveler">Traveler</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    <Label htmlFor="error-type" className="text-sm font-medium text-gray-700">
                      What type of error is it?
                    </Label>
                    <Select value={errorType} onValueChange={(value) => setErrorType(value as ErrorType)}>
                      <SelectTrigger id="error-type" className="w-full h-12">
                        <SelectValue placeholder="Select error type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User Error</SelectItem>
                        <SelectItem value="system">System Error</SelectItem>
                        <SelectItem value="external">External Error</SelectItem>
                      </SelectContent>
                    </Select>

                    <Label htmlFor="can-fix" className="text-sm font-medium text-gray-700">
                      Can the user fix this?
                    </Label>
                    <Select value={canFix} onValueChange={setCanFix}>
                      <SelectTrigger id="can-fix" className="w-full h-12">
                        <SelectValue placeholder="Select if user can fix" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>

                    <Label htmlFor="surface" className="text-sm font-medium text-gray-700">
                      Where does this appear?
                    </Label>
                    <Select value={surface} onValueChange={(value) => setSurface(value as Surface)}>
                      <SelectTrigger id="surface" className="w-full h-12">
                        <SelectValue placeholder="Select surface" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inline">Inline (e.g., button text)</SelectItem>
                        <SelectItem value="banner">Banner (e.g., full-page error)</SelectItem>
                        <SelectItem value="modal">Modal (e.g., confirmation dialog)</SelectItem>
                        <SelectItem value="form">Form (e.g., validation message)</SelectItem>
                        <SelectItem value="page">Page (e.g., main content)</SelectItem>
                        <SelectItem value="toast">Toast (e.g., notification)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {mode === 'suggest_pattern' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - New Copy */}
                  <div className="space-y-3">
                    <Label htmlFor="new-copy" className="text-sm font-medium text-gray-700">
                      New Copy
                    </Label>
                    <Textarea
                      id="new-copy"
                      placeholder="e.g., Oops! Something went wrong. Please try again."
                      value={badCopy}
                      onChange={(e) => setBadCopy(e.target.value)}
                      className="min-h-[200px] md:min-h-[240px] text-base leading-relaxed resize-none"
                      required
                    />
                  </div>

                  {/* Right Column - User Context */}
                  <div className="flex flex-col space-y-4 min-w-0">
                    <Label htmlFor="user-type" className="text-sm font-medium text-gray-700">
                      Who is this for?
                    </Label>
                    <Select value={userType} onValueChange={(value) => setUserType(value as UserType)}>
                      <SelectTrigger id="user-type" className="w-full h-12">
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="traveler">Traveler</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>

                    <Label htmlFor="surface" className="text-sm font-medium text-gray-700">
                      Where does this appear?
                    </Label>
                    <Select value={surface} onValueChange={(value) => setSurface(value as Surface)}>
                      <SelectTrigger id="surface" className="w-full h-12">
                        <SelectValue placeholder="Select surface" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inline">Inline (e.g., button text)</SelectItem>
                        <SelectItem value="banner">Banner (e.g., full-page error)</SelectItem>
                        <SelectItem value="modal">Modal (e.g., confirmation dialog)</SelectItem>
                        <SelectItem value="form">Form (e.g., validation message)</SelectItem>
                        <SelectItem value="page">Page (e.g., main content)</SelectItem>
                        <SelectItem value="toast">Toast (e.g., notification)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

               {/* Submit Button - Full Width */}
               <div className="flex flex-col sm:flex-row gap-3 pt-4">
                 <Button 
                   type="submit" 
                   disabled={isGenerating || !selectedProductType}
                   className="flex-1 h-12 text-base font-medium"
                 >
                   {isGenerating ? (
                     <>
                       <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                       Generating...
                     </>
                   ) : (
                     <>
                       <Sparkles className="h-4 w-4 mr-2" />
                       {mode === 'improve_copy' ? 'Improve Copy' : 
                        mode === 'write_new' ? 'Write New Copy' : 
                        'Suggest Pattern'}
                     </>
                   )}
                 </Button>
                 
                 {suggestions.length > 0 && !isGenerating && (
                   <Button 
                     type="button"
                     variant="outline"
                     onClick={() => {
                       if (mode === 'improve_copy' && !badCopy.trim()) return
                       handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                     }}
                     className="h-12 px-4"
                   >
                     <RefreshCcw className="h-4 w-4 mr-2" />
                     Regenerate
                   </Button>
                 )}
               </div>
            </form>
          </CardContent>
        </Card>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl font-semibold text-gray-900">AI Suggestions</CardTitle>
              <CardDescription className="text-gray-600 text-base">
                Click any suggestion to copy it to your clipboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => copyToClipboard(suggestion, index)}
                    className={`p-6 rounded-xl border cursor-pointer transition-all duration-200 group ${
                      copiedStates[index] 
                        ? 'border-green-500 bg-green-50 scale-[1.01]' 
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-gray-900 flex-1 pr-4 text-base leading-relaxed">{suggestion}</p>
                      <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                        {copiedStates[index] ? (
                          <Check className="h-5 w-5 text-green-600" />
                        ) : (
                          <Copy className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
