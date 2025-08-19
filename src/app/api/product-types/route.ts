import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// GET - Fetch all product types
export async function GET() {
  try {
    const supabase = createServerSupabaseClient()
    
    // Try to select with reference_files, fall back to basic columns if it doesn't exist
    let query = supabase
      .from('product_types')
      .select('id, name, instructions, created_at')
      .order('created_at', { ascending: true })

    // First try with reference_files column
    try {
      const { data: productTypesWithRefs, error: errorWithRefs } = await supabase
        .from('product_types')
        .select('id, name, instructions, reference_files, created_at')
        .order('created_at', { ascending: true })

      if (!errorWithRefs) {
        console.log('Successfully fetched product types with reference_files column')
        return NextResponse.json(productTypesWithRefs || [])
      } else {
        console.log('reference_files column not found, falling back to basic query:', errorWithRefs.message)
      }
    } catch (refError) {
      console.log('reference_files column error, using fallback query')
    }

    // Fallback to basic query without reference_files
    const { data: productTypes, error } = await query

    if (error) {
      throw error
    }

    // Add empty reference_files array to maintain interface compatibility
    const productTypesWithEmptyRefs = (productTypes || []).map(type => ({
      ...type,
      reference_files: []
    }))

    console.log('Successfully fetched product types without reference_files column')
    return NextResponse.json(productTypesWithEmptyRefs)
  } catch (error) {
    console.error('Get product types error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product types' },
      { status: 500 }
    )
  }
}

// POST - Create new product type
export async function POST(request: NextRequest) {
  try {
    const { name, instructions, referenceFiles } = await request.json()

    if (!name || !instructions) {
      return NextResponse.json(
        { error: 'Name and instructions are required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Check if name already exists
    const { data: existing } = await supabase
      .from('product_types')
      .select('id')
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'A product type with this name already exists' },
        { status: 409 }
      )
    }

    // Try to insert with reference_files, fall back to without if column doesn't exist
    try {
      const { data: productType, error } = await supabase
        .from('product_types')
        .insert({
          name,
          instructions,
          reference_files: referenceFiles || []
        })
        .select('id, name, instructions, reference_files, created_at')
        .single()

      if (!error) {
        console.log('Successfully created product type with reference_files column')
        return NextResponse.json(productType)
      } else {
        console.log('reference_files column not found in insert, falling back:', error.message)
      }
    } catch (refError) {
      console.log('reference_files column error in insert, using fallback')
    }

    // Fallback to insert without reference_files
    const { data: productType, error } = await supabase
      .from('product_types')
      .insert({
        name,
        instructions
      })
      .select('id, name, instructions, created_at')
      .single()

    if (error) {
      throw error
    }

    // Add empty reference_files for interface compatibility
    const productTypeWithRefs = {
      ...productType,
      reference_files: []
    }

    console.log('Successfully created product type without reference_files column')
    return NextResponse.json(productTypeWithRefs)
  } catch (error) {
    console.error('Create product type error:', error)
    return NextResponse.json(
      { error: 'Failed to create product type' },
      { status: 500 }
    )
  }
}

// PUT - Update existing product type
export async function PUT(request: NextRequest) {
  try {
    const { id, name, instructions } = await request.json()

    if (!id || !name || !instructions) {
      return NextResponse.json(
        { error: 'ID, name and instructions are required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Check if name already exists for different product type
    const { data: existing } = await supabase
      .from('product_types')
      .select('id')
      .eq('name', name)
      .neq('id', id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'A product type with this name already exists' },
        { status: 409 }
      )
    }

    const { data: productType, error } = await supabase
      .from('product_types')
      .update({
        name,
        instructions
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(productType)
  } catch (error) {
    console.error('Update product type error:', error)
    return NextResponse.json(
      { error: 'Failed to update product type' },
      { status: 500 }
    )
  }
} 