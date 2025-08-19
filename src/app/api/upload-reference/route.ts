import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']

// POST - Upload reference files to Supabase Storage
export async function POST(request: NextRequest) {
  console.log('Reference upload: Starting file upload...')
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.error('Reference upload: No file provided')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log('Reference upload: File received:', {
      name: file.name,
      size: file.size,
      type: file.type
    })

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_TYPES.includes(fileExtension)) {
      console.error('Reference upload: Invalid file type:', fileExtension)
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, PNG, JPG, and WebP files are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.error('Reference upload: File too large:', file.size)
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileId = randomUUID()
    const fileName = `${fileId}-${file.name}`
    const filePath = `reference-docs/${fileName}`

    console.log('Reference upload: Uploading to Supabase Storage:', filePath)

    // Upload to Supabase Storage
    const supabase = createServerSupabaseClient()
    const arrayBuffer = await file.arrayBuffer()
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('reference-files')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        duplex: 'half'
      })

    if (uploadError) {
      console.error('Reference upload: Supabase Storage error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file to storage: ' + uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('reference-files')
      .getPublicUrl(filePath)

    if (!urlData.publicUrl) {
      console.error('Reference upload: Failed to get public URL')
      return NextResponse.json(
        { error: 'Failed to get file URL' },
        { status: 500 }
      )
    }

    const fileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: urlData.publicUrl,
      uploadedAt: new Date().toISOString()
    }

    console.log('Reference upload: Upload successful:', fileMetadata)

    return NextResponse.json(fileMetadata)
  } catch (error) {
    console.error('Reference upload: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

// DELETE - Remove reference file from Supabase Storage
export async function DELETE(request: NextRequest) {
  console.log('Reference delete: Starting file deletion...')
  
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')
    const fileUrl = searchParams.get('url')

    if (!fileId || !fileUrl) {
      console.error('Reference delete: Missing file ID or URL')
      return NextResponse.json(
        { error: 'File ID and URL are required' },
        { status: 400 }
      )
    }

    console.log('Reference delete: Deleting file:', { fileId, fileUrl })

    // Extract file path from URL
    const urlParts = fileUrl.split('/reference-files/')
    if (urlParts.length !== 2) {
      console.error('Reference delete: Invalid file URL format')
      return NextResponse.json(
        { error: 'Invalid file URL format' },
        { status: 400 }
      )
    }

    const filePath = `reference-files/${urlParts[1]}`
    console.log('Reference delete: Extracted file path:', filePath)

    // Delete from Supabase Storage
    const supabase = createServerSupabaseClient()
    const { error: deleteError } = await supabase.storage
      .from('reference-files')
      .remove([filePath])

    if (deleteError) {
      console.error('Reference delete: Supabase Storage error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete file from storage: ' + deleteError.message },
        { status: 500 }
      )
    }

    console.log('Reference delete: File deleted successfully')

    return NextResponse.json({ message: 'File deleted successfully' })
  } catch (error) {
    console.error('Reference delete: Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to delete file: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
} 