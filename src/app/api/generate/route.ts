import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { generateCopySuggestions } from '@/lib/openrouter'
import { convertFileToBase64 } from '@/lib/utils'

export async function POST(request: NextRequest) {
  console.log('=== GENERATE API STARTED ===')
  
  try {
    // Check environment variables first
    const openRouterKey = process.env.OPENROUTER_API_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('Environment variables check:', {
      openRouterKey: !!openRouterKey,
      supabaseUrl: !!supabaseUrl,
      supabaseServiceKey: !!supabaseServiceKey
    })
    
    if (!openRouterKey) {
      console.error('MISSING: OPENROUTER_API_KEY not configured')
      return NextResponse.json(
        { error: 'OpenRouter API key not configured. Please check environment variables.' },
        { status: 500 }
      )
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('MISSING: Supabase configuration incomplete')
      return NextResponse.json(
        { error: 'Database configuration incomplete. Please check environment variables.' },
        { status: 500 }
      )
    }

    // Parse form data
    console.log('Parsing form data...')
    const formData = await request.formData()
    
    // Core fields
    const mode = formData.get('mode') as string || 'improve_copy' // Default for backward compatibility
    const productTypeId = formData.get('productTypeId') as string
    const screenshot = formData.get('screenshot') as File | null

    // Mode-specific fields
    const badCopy = formData.get('badCopy') as string || formData.get('inputCopy') as string || ''
    const userType = formData.get('userType') as string
    const errorType = formData.get('errorType') as string
    const canFix = formData.get('canFix') as string
    const surface = formData.get('surface') as string

    console.log('Form data received:', {
      mode,
      badCopy: badCopy ? `"${badCopy.substring(0, 50)}${badCopy.length > 50 ? '...' : ''}"` : 'null',
      productTypeId,
      userType,
      errorType,
      canFix,
      surface,
      hasScreenshot: !!screenshot,
      screenshotSize: screenshot?.size || 0
    })

    // Validation based on mode
    if (!productTypeId) {
      console.error('VALIDATION ERROR: Product type is required')
      return NextResponse.json(
        { error: 'Product type is required' },
        { status: 400 }
      )
    }

    if (mode === 'improve_copy' && !badCopy) {
      console.error('VALIDATION ERROR: Bad copy is required for improve_copy mode')
      return NextResponse.json(
        { error: 'Original copy is required for improvement mode' },
        { status: 400 }
      )
    }

    // Get product type instructions from Supabase
    console.log('Fetching product type from database...')
    const supabase = createServerSupabaseClient()
    
    // Try to get reference_files, fall back to just instructions if column doesn't exist
    let productType: { instructions: string; reference_files?: unknown[] } | null = null
    let productError: Error | null = null

    try {
      const { data, error } = await supabase
        .from('product_types')
        .select('instructions, reference_files')
        .eq('id', productTypeId)
        .single()

      if (!error) {
        productType = data
        console.log('Successfully fetched product type with reference_files column')
      } else {
        console.log('reference_files column not found, falling back to basic query:', error.message)
        throw error
      }
    } catch {
      console.log('reference_files column error, using fallback query')
      
      // Fallback to basic query without reference_files
      const { data, error } = await supabase
        .from('product_types')
        .select('instructions')
        .eq('id', productTypeId)
        .single()

      productType = data ? { ...data, reference_files: [] } : null
      productError = error
    }

    console.log('Database query result:', {
      found: !!productType,
      error: productError?.message || null,
      errorCode: (productError as { code?: string })?.code || null
    })

    if (productError) {
      console.error('DATABASE ERROR:', productError)
      return NextResponse.json(
        { error: 'Database error: ' + productError.message },
        { status: 500 }
      )
    }

    if (!productType) {
      console.error('VALIDATION ERROR: Product type not found')
      return NextResponse.json(
        { error: 'Invalid product type' },
        { status: 400 }
      )
    }

    console.log('Product type found:', {
      instructionsLength: productType.instructions?.length || 0,
      instructionsPreview: productType.instructions?.substring(0, 100) + '...',
      referenceFilesCount: productType.reference_files?.length || 0
    })

    // Convert screenshot to base64 if provided
    let imageBase64: string | undefined
    if (screenshot && screenshot.size > 0) {
      try {
        console.log('Converting screenshot to base64...')
        imageBase64 = await convertFileToBase64(screenshot)
        console.log('Screenshot conversion successful:', {
          originalSize: screenshot.size,
          base64Length: imageBase64.length
        })
      } catch (conversionError) {
        console.error('SCREENSHOT CONVERSION ERROR:', conversionError)
        return NextResponse.json(
          { error: 'Failed to process screenshot: ' + (conversionError instanceof Error ? conversionError.message : 'Unknown error') },
          { status: 500 }
        )
      }
    }

    // Get reference files URLs from the product type
    const referenceFileUrls = (productType.reference_files as { url: string }[] || []).map(file => file.url)
    console.log('Reference files found:', {
      count: referenceFileUrls.length,
      urls: referenceFileUrls.map(url => url.substring(url.lastIndexOf('/') + 1))
    })

    // Generate suggestions using OpenRouter
    console.log('Calling OpenRouter API...')
    let suggestions: string[]
    try {
      suggestions = await generateCopySuggestions(
        badCopy,
        productType.instructions,
        imageBase64,
        referenceFileUrls,
        {
          mode,
          userType,
          errorType,
          canFix,
          surface
        }
      )
      console.log('OpenRouter API successful:', {
        suggestionsCount: suggestions.length,
        suggestions: suggestions.map((s, i) => `${i + 1}: "${s.substring(0, 50)}${s.length > 50 ? '...' : ''}"`)
      })
    } catch (openRouterError) {
      console.error('OPENROUTER API ERROR:', openRouterError)
      
      // Provide specific error messages based on the error
      let userMessage = 'Failed to generate suggestions'
      if (openRouterError instanceof Error) {
        if (openRouterError.message.includes('API key')) {
          userMessage = 'OpenRouter API key is invalid or missing'
        } else if (openRouterError.message.includes('429')) {
          userMessage = 'Rate limit exceeded. Please try again later'
        } else if (openRouterError.message.includes('401')) {
          userMessage = 'OpenRouter API authentication failed'
        } else if (openRouterError.message.includes('network') || openRouterError.message.includes('fetch')) {
          userMessage = 'Network error: Unable to reach AI service'
        } else {
          userMessage = 'AI service error: ' + openRouterError.message
        }
      }
      
      return NextResponse.json(
        { error: userMessage },
        { status: 500 }
      )
    }

    // Get or create user session
    const userSession = request.cookies.get('user_session')?.value || crypto.randomUUID()
    
    // Set cookie if not exists
    const response = NextResponse.json({ suggestions })
    if (!request.cookies.get('user_session')) {
      response.cookies.set('user_session', userSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      })
    }

    // Store the submission in Supabase
    try {
      console.log('Storing submission in database...')
      const { error: submissionError } = await supabase
        .from('submissions')
        .insert({
          bad_copy: badCopy,
          product_type_id: productTypeId,
          suggestions: suggestions,
          has_screenshot: !!screenshot,
          user_session: userSession
        })

      if (submissionError) {
        console.error('SUBMISSION STORAGE ERROR:', submissionError)
        // Don't fail the request if storage fails, just log it
      } else {
        console.log('Submission stored successfully')
      }
    } catch (storageError) {
      console.error('SUBMISSION STORAGE UNEXPECTED ERROR:', storageError)
      // Don't fail the request if storage fails
    }

    console.log('=== GENERATE API SUCCESS ===')
    return response
    
  } catch (error) {
    console.error('=== GENERATE API UNEXPECTED ERROR ===')
    console.error('Error details:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      { 
        error: 'Unexpected server error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        details: error instanceof Error ? error.stack : 'No additional details'
      },
      { status: 500 }
    )
  }
} 