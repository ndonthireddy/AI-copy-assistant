interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

interface CopyContext {
  mode: string
  userType?: string
  errorType?: string
  canFix?: string
  surface?: string
}

export async function generateCopySuggestions(
  badCopy: string,
  productInstructions: string,
  imageBase64?: string,
  referenceFileUrls?: string[],
  context?: CopyContext
): Promise<string[]> {
  console.log('OpenRouter: Starting copy generation...')
  
  const apiKey = process.env.OPENROUTER_API_KEY
  
  if (!apiKey) {
    console.error('OpenRouter: API key not configured')
    throw new Error('OpenRouter API key not configured')
  }

  console.log('OpenRouter: API key found, building prompt...')
  
  // Build system prompt based on mode
  let systemPrompt = ''
  
  if (context?.mode === 'improve_copy') {
    systemPrompt = `You are an expert UX copywriter specializing in improving existing UI copy. ${productInstructions}

Your task is to improve existing UI copy to make it clearer, more helpful, and more user-friendly.

Always provide exactly 2-3 improved alternatives. Each suggestion should be on a new line. Do not include numbers, bullets, or extra formatting - just the clean copy suggestions.`
  } else if (context?.mode === 'write_new') {
    systemPrompt = `You are an expert UX copywriter specializing in writing new error messages. ${productInstructions}

Your task is to create new error message copy based on the context provided:
- User type: ${context.userType || 'unknown'}
- Error type: ${context.errorType || 'unknown'}
- Can user fix this: ${context.canFix || 'unknown'}
- Display surface: ${context.surface || 'unknown'}

Consider these factors when writing the error message:
- Be specific about what went wrong
- Provide clear next steps if the user can fix it
- Match the tone to the user type and severity
- Keep it appropriate for the display context

Always provide exactly 2-3 new error message alternatives. Each suggestion should be on a new line. Do not include numbers, bullets, or extra formatting - just the clean copy suggestions.`
  } else if (context?.mode === 'suggest_pattern') {
    systemPrompt = `You are an expert UX designer specializing in error handling patterns and information architecture. ${productInstructions}

Your task is to recommend design patterns for displaying error information based on:
- User type: ${context.userType || 'unknown'}
- Display surface: ${context.surface || 'unknown'}

Provide 2-3 specific design pattern recommendations that include:
- Pattern name (e.g., "Inline validation", "Error banner")
- When to use it
- Visual/interaction details
- Why it's appropriate for this context

Format each recommendation as a complete suggestion on a new line. Do not include numbers, bullets, or extra formatting.`
  } else {
    // Fallback to original behavior
    systemPrompt = `You are an expert UX copywriter. ${productInstructions}

Always provide exactly 2-3 improved alternatives. Each suggestion should be on a new line. Do not include numbers, bullets, or extra formatting - just the clean copy suggestions.`
  }

  if (referenceFileUrls && referenceFileUrls.length > 0) {
    systemPrompt += `

IMPORTANT: Reference documents have been provided that contain examples, style guides, or brand guidelines for this product. Please review these files and ensure your suggestions align with the established tone, style, and patterns shown in the reference materials.`
  }

  const messages = [
    {
      role: 'system' as const,
      content: systemPrompt
    }
  ]

  // Add reference files as context if available
  if (referenceFileUrls && referenceFileUrls.length > 0) {
    console.log('OpenRouter: Adding reference files context...')
    messages.push({
      role: 'user' as const,
      content: `Reference documents for context (please review these for tone and style guidance):
${referenceFileUrls.map((url, index) => `${index + 1}. ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${url}`).join('\n')}`
    })
  }

  // Add the main request with optional screenshot
  let userMessageText = ''
  
  if (context?.mode === 'improve_copy') {
    userMessageText = `Please improve this UI copy: "${badCopy}"`
  } else if (context?.mode === 'write_new') {
    userMessageText = badCopy 
      ? `Please write new error message copy for this context. Current copy (if any): "${badCopy}"`
      : `Please write new error message copy for this context.`
  } else if (context?.mode === 'suggest_pattern') {
    userMessageText = badCopy 
      ? `Please suggest design patterns for displaying error information. Context description: "${badCopy}"`
      : `Please suggest design patterns for displaying error information in this context.`
  } else {
    // Fallback for backward compatibility
    userMessageText = `Please improve this UI copy: "${badCopy}"`
  }

  messages.push({
    role: 'user' as const,
    content: imageBase64 
      ? [
          { type: 'text', text: userMessageText },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      : userMessageText
  })

  console.log('OpenRouter: Prompt built, making API call...', {
    messageCount: messages.length,
    hasImage: !!imageBase64,
    hasReferenceFiles: !!(referenceFileUrls && referenceFileUrls.length > 0),
    badCopyLength: badCopy.length
  })

  try {
    const requestBody = {
      model: 'openai/gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 1000
    }
    
    console.log('OpenRouter: Sending request to API...')
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'CopyFixer'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('OpenRouter: API response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenRouter: API error response:', errorText)
      
      // Provide specific error messages based on status code
      if (response.status === 401) {
        throw new Error('OpenRouter API authentication failed - invalid API key')
      } else if (response.status === 429) {
        throw new Error('OpenRouter API rate limit exceeded - please try again later')
      } else if (response.status === 500) {
        throw new Error('OpenRouter API server error - please try again')
      } else {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`)
      }
    }

    const data: OpenRouterResponse = await response.json()
    console.log('OpenRouter: API response parsed:', {
      hasChoices: !!(data.choices && data.choices.length > 0),
      choicesCount: data.choices?.length || 0,
      hasContent: !!(data.choices?.[0]?.message?.content)
    })

    const content = data.choices[0]?.message?.content

    if (!content) {
      console.error('OpenRouter: No content in API response')
      throw new Error('No response content from OpenRouter API')
    }

    console.log('OpenRouter: Processing response content...', {
      contentLength: content.length,
      contentPreview: content.substring(0, 100) + '...'
    })

    // Split by newlines and filter out empty lines
    const suggestions = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 3) // Ensure max 3 suggestions

    console.log('OpenRouter: Copy generation successful:', {
      suggestionsCount: suggestions.length,
      suggestions: suggestions.map((s, i) => `${i + 1}: "${s.substring(0, 50)}${s.length > 50 ? '...' : ''}"`)
    })

    return suggestions.length > 0 ? suggestions : ['Unable to generate suggestions at this time.']
  } catch (error) {
    console.error('OpenRouter: Unexpected error during API call:', error)
    
    // Re-throw with more context
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        throw new Error('Network error: Unable to reach OpenRouter API. Please check your internet connection.')
      } else if (error.message.includes('JSON')) {
        throw new Error('OpenRouter API returned invalid response format.')
      } else {
        throw error // Re-throw existing error with original message
      }
    } else {
      throw new Error('Unknown error occurred while generating copy suggestions.')
    }
  }
} 