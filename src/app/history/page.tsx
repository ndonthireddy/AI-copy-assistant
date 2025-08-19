'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Submission } from '@/lib/supabase'
import { ArrowLeft, Clock, MessageSquare, Sparkles, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'

export default function HistoryPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSubmissions()
  }, [])

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/submissions')
      
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data)
      } else {
        setError('Failed to load submission history')
      }
    } catch (error) {
      console.error('Error fetching submissions:', error)
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to CopyFixer
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Submission History</h1>
                <p className="text-gray-600">View your past copy improvement requests</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading submission history...</p>
          </div>
        )}

        {error && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={fetchSubmissions} variant="outline">
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && submissions.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
                <p className="text-gray-600 mb-6">
                  Start by improving some copy on the main page.
                </p>
                <Button asChild>
                  <Link href="/">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Get Started
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && submissions.length > 0 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <p className="text-gray-600">
                {submissions.length} submission{submissions.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {submissions.map((submission) => (
              <Card key={submission.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">Copy Improvement Request</CardTitle>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatDate(submission.created_at)}
                    </div>
                  </div>
                  {submission.has_screenshot && (
                    <div className="flex items-center text-sm text-blue-600">
                      <ImageIcon className="h-4 w-4 mr-1" />
                      Screenshot included
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Original Copy */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Original Copy</h4>
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-gray-900 font-mono text-sm">{submission.bad_copy}</p>
                    </div>
                  </div>

                  {/* Suggestions */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      AI Suggestions ({submission.suggestions.length})
                    </h4>
                    <div className="space-y-2">
                      {submission.suggestions.map((suggestion, index) => (
                        <div 
                          key={index}
                          className="bg-green-50 border border-green-200 rounded-md p-3"
                        >
                          <div className="flex items-start">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-800 text-xs font-medium rounded-full mr-3 mt-0.5">
                              {index + 1}
                            </span>
                            <p className="text-gray-900 text-sm flex-1">{suggestion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
} 