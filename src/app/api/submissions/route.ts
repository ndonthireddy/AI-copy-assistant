import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET - Fetch all submissions
export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Get user session from cookie
    const userSession = request.headers.get('cookie')?.split(';')
      .find(c => c.trim().startsWith('user_session='))
      ?.split('=')[1]
    
    if (!userSession) {
      return NextResponse.json([]) // Return empty array if no session
    }
    
    // Get submissions with suggestions
    try {
      const { data: submissionsWithSuggestions, error: submissionsError } = await supabase
        .from('submissions')
        .select(`
          id,
          bad_copy,
          has_screenshot,
          created_at,
          suggestions (
            id,
            improved_copy
          )
        `)
        .eq('user_session', userSession)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!submissionsError) {
        console.log('Successfully fetched submissions with suggestions')
        // Process submissions and their suggestions
        const processedSubmissions = (submissionsWithSuggestions || []).map(submission => ({
          ...submission,
          suggestions: submission.suggestions?.map(s => s.improved_copy) || [],
          has_screenshot: Boolean(submission.has_screenshot)
        }))
        return NextResponse.json(processedSubmissions)
      } else {
        console.error('Error fetching submissions:', submissionsError)
        return NextResponse.json(
          { error: 'Failed to fetch submissions' },
          { status: 500 }
        )
      }
    } catch (error) {
      console.error('Error fetching submissions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch submissions' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Get submissions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
} 