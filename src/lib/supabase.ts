import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For server-side operations that need elevated permissions
export const createServerSupabaseClient = () => {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Reference file interface for storing file metadata
export interface ReferenceFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  uploadedAt: string
}

// Product type interface with reference files support
export interface ProductType {
  id: string
  name: string
  instructions: string
  reference_files?: ReferenceFile[]
  created_at: string
}

// Submission interface with screenshot support
export interface Submission {
  id: string
  bad_copy: string
  product_type_id: string
  suggestions: string[]
  has_screenshot?: boolean
  created_at: string
} 