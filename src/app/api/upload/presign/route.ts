import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PresignRequestSchema = z.object({
  project_id: z.string().uuid(),
  file_name: z.string().min(1),
  file_type: z.string().min(1),
  size: z.number().int().min(1)
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = PresignRequestSchema.parse(body)

    // Verify project exists and user has access
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', validatedData.project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Generate unique file path
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = validatedData.file_name.split('.').pop()
    const fileName = `${validatedData.project_id}/${timestamp}-${randomId}.${fileExtension}`
    
    // Create presigned URL for upload
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'directorstudio-projects'
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(fileName, {
        expiresIn: 300, // 5 minutes
        upsert: false
      })

    if (error) {
      console.error('Presigned URL creation error:', error)
      return NextResponse.json(
        { error: 'Failed to create presigned URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      presigned_url: data.signedUrl,
      file_path: fileName,
      expires_at: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
    })

  } catch (error) {
    console.error('Presign upload error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

