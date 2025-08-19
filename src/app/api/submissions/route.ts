import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET - Fetch all submissions
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    
    // Try to select with all columns, fall back to basic columns if some don't exist
    let query = supabase
      .from('submissions')
      .select('id, bad_copy, suggestions, created_at')
      .order('created_at', { ascending: false })
      .limit(50) // Limit to last 50 submissions

    // First try with has_screenshot column
    try {
      const { data: submissionsWithScreenshot, error: errorWithScreenshot } = await supabase
        .from('submissions')
        .select('id, bad_copy, suggestions, has_screenshot, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!errorWithScreenshot) {
        console.log('Successfully fetched submissions with has_screenshot column')
        // Ensure suggestions is always an array
        const processedSubmissions = (submissionsWithScreenshot || []).map(submission => ({
          ...submission,
          suggestions: Array.isArray(submission.suggestions) ? submission.suggestions : [],
          has_screenshot: Boolean(submission.has_screenshot)
        }))
        return NextResponse.json(processedSubmissions)
      } else {
        console.log('has_screenshot column not found, falling back to basic query:', errorWithScreenshot.message)
      }
    } catch (screenshotError) {
      console.log('has_screenshot column error, using fallback query')
    }

    // Fallback to basic query without has_screenshot
    const { data: submissions, error } = await query

    if (error) {
      console.error('Error fetching submissions:', error)
      throw error
    }

    // Add default has_screenshot field and ensure suggestions is always an array
    const processedSubmissions = (submissions || []).map(submission => ({
      ...submission,
      suggestions: Array.isArray(submission.suggestions) ? submission.suggestions : [],
      has_screenshot: false // Default to false when column doesn't exist
    }))

    console.log('Successfully fetched submissions without has_screenshot column')
    return NextResponse.json(processedSubmissions)
  } catch (error) {
    console.error('Get submissions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
} 