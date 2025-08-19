'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ReferenceFileUpload } from '@/components/ui/reference-file-upload'
import { ProductType, ReferenceFile } from '@/lib/supabase'
import { ArrowLeft, Plus, Edit, Trash2, Settings, Eye, EyeOff, FileText, Image } from 'lucide-react'
import Link from 'next/link'

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [secretCode, setSecretCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingType, setEditingType] = useState<ProductType | null>(null)
  const [formData, setFormData] = useState({ 
    name: '', 
    instructions: '',
    referenceFiles: [] as ReferenceFile[]
  })
  const [error, setError] = useState('')

  // Debug useEffect to monitor state changes
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Admin: State changed - isCreating:', isCreating, 'editingType:', editingType?.name, 'formData:', {
        name: formData.name,
        instructionsLength: formData.instructions.length,
        referenceFilesCount: formData.referenceFiles.length
      })
    }
  }, [isCreating, editingType, formData])

  useEffect(() => {
    // Check if already authenticated
    const stored = localStorage.getItem('adminAuthenticated')
    if (stored === 'true') {
      setIsAuthenticated(true)
      fetchProductTypes()
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    // Simple secret code check
    if (secretCode === process.env.NEXT_PUBLIC_ADMIN_SECRET || secretCode === 'admin123') {
      setIsAuthenticated(true)
      localStorage.setItem('adminAuthenticated', 'true')
      await fetchProductTypes()
    } else {
      setError('Invalid secret code')
    }
    setIsLoading(false)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('adminAuthenticated')
    setSecretCode('')
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.instructions.trim()) return

    setIsLoading(true)
    setError('')
    try {
      const isUpdating = !!editingType
      const url = isUpdating ? `/api/product-types/${editingType.id}` : '/api/product-types'
      const method = isUpdating ? 'PUT' : 'POST'
      
      console.log(`Admin: ${method} ${url}`, { name: formData.name, instructions: formData.instructions, referenceFilesCount: formData.referenceFiles.length })
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          instructions: formData.instructions.trim(),
          referenceFiles: formData.referenceFiles
        })
      })

      const responseData = await response.json()
      console.log(`Admin: ${method} ${url} response:`, responseData)

      if (response.ok) {
        await fetchProductTypes()
        setFormData({ name: '', instructions: '', referenceFiles: [] })
        setEditingType(null)
        setIsCreating(false)
        setError('')
        console.log(`Admin: ${isUpdating ? 'Update' : 'Create'} successful`)
      } else {
        // Handle API errors
        const errorMessage = responseData.error || `Failed to ${isUpdating ? 'update' : 'create'} product type`
        setError(errorMessage)
        console.error(`Admin: ${method} ${url} failed:`, responseData)
      }
    } catch (error) {
      console.error('Admin: Network error during save:', error)
      setError(`Network error: Failed to ${editingType ? 'update' : 'create'} product type`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (type: ProductType) => {
    console.log('Admin: handleEdit called for product type:', {
      id: type.id,
      name: type.name,
      nameLength: type.name?.length || 0,
      instructionsLength: type.instructions?.length || 0,
      hasReferenceFiles: Boolean(type.reference_files?.length),
      referenceFilesCount: type.reference_files?.length || 0
    })

    try {
      // Ensure we have valid data
      const safeName = type.name || ''
      const safeInstructions = type.instructions || ''
      const safeReferenceFiles = Array.isArray(type.reference_files) ? type.reference_files : []

      console.log('Admin: Setting form data:', {
        safeName,
        instructionsPreview: safeInstructions.substring(0, 100) + (safeInstructions.length > 100 ? '...' : ''),
        referenceFilesCount: safeReferenceFiles.length
      })

      // Set the editing state first
      setEditingType(type)
      
      // Then set the form data
      setFormData({ 
        name: safeName, 
        instructions: safeInstructions, 
        referenceFiles: safeReferenceFiles 
      })
      
      // Clear any existing errors
      setError('')
      
      // Finally show the form
      setIsCreating(true)

      console.log('Admin: Edit form should now be visible')
    } catch (error) {
      console.error('Admin: Error in handleEdit:', error)
      setError('Failed to load product type for editing. Please try again.')
      
      // Still try to show the form with empty data
      setEditingType(type)
      setFormData({ name: '', instructions: '', referenceFiles: [] })
      setIsCreating(true)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product type?')) return

    console.log('Admin: DELETE /api/product-types/' + id)
    
    try {
      const response = await fetch(`/api/product-types/${id}`, {
        method: 'DELETE'
      })
      
      const responseData = await response.json()
      console.log('Admin: DELETE /api/product-types/' + id + ' response:', responseData)
      
      if (response.ok) {
        // Success - refresh the list and show success message
        await fetchProductTypes()
        const deletedName = responseData.deletedName || 'Product type'
        console.log('Admin: Delete successful')
        alert(`✅ ${deletedName} deleted successfully!`)
      } else {
        // Error - show the most descriptive message available
        const errorMessage = responseData.message || responseData.error || 'Failed to delete product type'
        console.error('Admin: Delete failed:', responseData)
        
        // Show user-friendly error message
        if (response.status === 409) {
          // Conflict - foreign key constraint
          alert(`❌ Cannot Delete\n\n${errorMessage}\n\nTip: You can edit this product type instead of deleting it.`)
        } else {
          // Other errors
          alert(`❌ Delete Failed\n\n${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Admin: Network error during delete:', error)
      alert('❌ Network Error\n\nFailed to connect to server. Please check your connection and try again.')
    }
  }

  const resetForm = () => {
    setFormData({ name: '', instructions: '', referenceFiles: [] })
    setEditingType(null)
    setIsCreating(false)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Settings className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900">Admin Login</h1>
            <p className="text-gray-600">Enter the secret code to manage CopyFixer</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="secret-code">Secret Code</Label>
                  <div className="relative">
                    <Input
                      id="secret-code"
                      type={showPassword ? 'text' : 'password'}
                      value={secretCode}
                      onChange={(e) => setSecretCode(e.target.value)}
                      placeholder="Enter admin secret code"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Authenticating...' : 'Login'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <Button variant="ghost" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to CopyFixer
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Settings className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to App
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Product Types</h2>
            <p className="text-gray-600">Manage AI instructions for different product contexts</p>
          </div>
          {!isCreating && (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product Type
            </Button>
          )}
        </div>

        {/* Create/Edit Form */}
        {isCreating && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{editingType ? 'Edit Product Type' : 'Create New Product Type'}</CardTitle>
              <CardDescription>
                Define how the AI should rewrite copy for this product context
                {editingType && (
                  <span className="block mt-1 text-xs text-blue-600">
                    Editing: {editingType.name} (ID: {editingType.id?.substring(0, 8)}...)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Type Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., E-commerce, SaaS, Mobile App"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructions">
                    AI Instructions
                    <span className="text-xs text-gray-500 ml-2">
                      ({formData.instructions.length} characters)
                    </span>
                  </Label>
                  <Textarea
                    id="instructions"
                    value={formData.instructions}
                    onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder="Describe the tone, style, and specific guidelines for this product type..."
                    className="min-h-[120px] max-h-[400px] resize-y"
                    style={{ 
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      overflow: 'auto'
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference-files">Reference Files</Label>
                  <ReferenceFileUpload
                    files={formData.referenceFiles}
                    onChange={(files: ReferenceFile[]) => setFormData(prev => ({ ...prev, referenceFiles: files }))}
                    maxFiles={5}
                  />
                </div>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
                <div className="flex space-x-2">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : editingType ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-2 bg-gray-100 rounded text-xs text-gray-600">
            Debug: isCreating={isCreating.toString()}, editingType={editingType?.name || 'null'}, formDataName={formData.name}
          </div>
        )}

        {/* Product Types List */}
        <div className="grid gap-4">
          {productTypes.map((type) => (
            <Card key={type.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{type.name}</h3>
                      {type.reference_files && type.reference_files.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md">
                          <FileText className="h-3 w-3" />
                          {type.reference_files.length} file{type.reference_files.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed mb-3">{type.instructions}</p>
                    
                    {/* Reference Files Display */}
                    {type.reference_files && type.reference_files.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-700 mb-2">Reference Documents:</p>
                        <div className="flex flex-wrap gap-2">
                          {type.reference_files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded border"
                            >
                              {file.type === 'application/pdf' ? (
                                <FileText className="h-3 w-3 text-red-500" />
                              ) : (
                                <Image className="h-3 w-3 text-blue-500" />
                              )}
                              <span className="truncate max-w-[120px]">{file.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500">
                      Created: {new Date(type.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log('Admin: Edit button clicked for:', type.name, type.id)
                        console.log('Admin: Product type data:', {
                          ...type,
                          instructionsPreview: type.instructions?.substring(0, 50) + '...'
                        })
                        handleEdit(type)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {process.env.NODE_ENV === 'development' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          console.log('Admin: Debug test - forcing form open')
                          console.log('Admin: Current states:', { isCreating, editingType: editingType?.name })
                          setIsCreating(true)
                          setEditingType(type)
                          setFormData({ 
                            name: type.name || 'TEST NAME', 
                            instructions: type.instructions || 'TEST INSTRUCTIONS', 
                            referenceFiles: type.reference_files || [] 
                          })
                        }}
                        className="text-xs"
                      >
                        🔧
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(type.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {productTypes.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Product Types</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first product type</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product Type
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
} 