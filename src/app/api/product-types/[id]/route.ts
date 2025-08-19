import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// PUT - Update specific product type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { name, instructions, referenceFiles } = await request.json()

    console.log('PUT /api/product-types/[id] - Updating product type:', { id, name, instructions, referenceFilesCount: referenceFiles?.length || 0 })

    if (!id || !name || !instructions) {
      console.log('PUT /api/product-types/[id] - Missing required fields:', { id: !!id, name: !!name, instructions: !!instructions })
      return NextResponse.json(
        { error: 'ID, name and instructions are required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Check if name already exists for different product type
    console.log('PUT /api/product-types/[id] - Checking for name conflicts...')
    const { data: existing, error: checkError } = await supabase
      .from('product_types')
      .select('id')
      .eq('name', name)
      .neq('id', id)

    if (checkError) {
      console.error('PUT /api/product-types/[id] - Error checking existing names:', checkError)
      throw checkError
    }

    if (existing && existing.length > 0) {
      console.log('PUT /api/product-types/[id] - Name conflict found:', existing)
      return NextResponse.json(
        { error: 'A product type with this name already exists' },
        { status: 409 }
      )
    }

    // Update the product type
    console.log('PUT /api/product-types/[id] - Updating product type in database...')
    const { data: productType, error: updateError } = await supabase
      .from('product_types')
      .update({
        name,
        instructions,
        reference_files: referenceFiles || []
      })
      .eq('id', id)
      .select('id, name, instructions, reference_files, created_at')
      .single()

    if (updateError) {
      console.error('PUT /api/product-types/[id] - Database update error:', updateError)
      throw updateError
    }

    if (!productType) {
      console.log('PUT /api/product-types/[id] - No product type found with ID:', id)
      return NextResponse.json(
        { error: 'Product type not found' },
        { status: 404 }
      )
    }

    console.log('PUT /api/product-types/[id] - Update successful:', productType)
    return NextResponse.json(productType)
  } catch (error) {
    console.error('PUT /api/product-types/[id] - Unexpected error:', error)
    return NextResponse.json(
      { error: 'Failed to update product type', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete specific product type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log('DELETE /api/product-types/[id] - Deleting product type:', { id })

    if (!id) {
      console.log('DELETE /api/product-types/[id] - Missing ID parameter')
      return NextResponse.json(
        { error: 'Product type ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // First check if the product type exists
    console.log('DELETE /api/product-types/[id] - Checking if product type exists...')
    const { data: existing, error: checkError } = await supabase
      .from('product_types')
      .select('id, name')
      .eq('id', id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('DELETE /api/product-types/[id] - Error checking existence:', checkError)
      throw checkError
    }

    if (!existing) {
      console.log('DELETE /api/product-types/[id] - Product type not found:', id)
      return NextResponse.json(
        { error: 'Product type not found' },
        { status: 404 }
      )
    }

    // Check if there are any submissions using this product type
    console.log('DELETE /api/product-types/[id] - Checking for related submissions...')
    const { data: relatedSubmissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('id')
      .eq('product_type_id', id)
      .limit(1)

    if (submissionsError) {
      console.error('DELETE /api/product-types/[id] - Error checking submissions:', submissionsError)
      // Continue with deletion attempt even if we can't check submissions
    }

    if (relatedSubmissions && relatedSubmissions.length > 0) {
      console.log('DELETE /api/product-types/[id] - Found related submissions, cannot delete')
      return NextResponse.json(
        { 
          error: 'Cannot delete product type', 
          message: 'This product type has been used in copy generation requests and cannot be deleted. You can edit it instead.',
          details: 'Foreign key constraint: submissions exist for this product type'
        },
        { status: 409 } // Conflict
      )
    }

    // Delete the product type
    console.log('DELETE /api/product-types/[id] - Deleting from database:', existing)
    const { error: deleteError } = await supabase
      .from('product_types')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('DELETE /api/product-types/[id] - Database delete error:', deleteError)
      
      // Handle specific error types
      if (deleteError.code === '23503') {
        // Foreign key constraint violation
        return NextResponse.json(
          { 
            error: 'Cannot delete product type', 
            message: 'This product type is being used by existing submissions and cannot be deleted.',
            details: deleteError.message 
          },
          { status: 409 }
        )
      }
      
      // Return the actual database error
      return NextResponse.json(
        { 
          error: 'Database error', 
          message: deleteError.message,
          details: deleteError.details || 'Unknown database error'
        },
        { status: 500 }
      )
    }

    console.log('DELETE /api/product-types/[id] - Delete successful')
    return NextResponse.json({ 
      message: 'Product type deleted successfully',
      deletedId: id,
      deletedName: existing.name
    })
  } catch (error) {
    console.error('DELETE /api/product-types/[id] - Unexpected error:', error)
    
    // Handle different error types
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as { code: string; message: string }
      if (dbError.code === '23503') {
        return NextResponse.json(
          { 
            error: 'Cannot delete product type', 
            message: 'This product type is being used and cannot be deleted.',
            details: dbError.message 
          },
          { status: 409 }
        )
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to delete product type', 
        message: error instanceof Error ? error.message : 'Unknown error',
        details: 'Unexpected server error during deletion'
      },
      { status: 500 }
    )
  }
} 