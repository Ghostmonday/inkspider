import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { z } from 'zod'

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CompleteUploadSchema = z.object({
  project_id: z.string().uuid(),
  clip_id: z.string().uuid(),
  file_url: z.string().url(),
  checksum: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = CompleteUploadSchema.parse(body)

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', validatedData.project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Verify clip exists
    const { data: clip, error: clipError } = await supabase
      .from('generation_metadata')
      .select('id')
      .eq('id', validatedData.clip_id)
      .single()

    if (clipError || !clip) {
      return NextResponse.json(
        { error: 'Clip not found' },
        { status: 404 }
      )
    }

    // Verify file exists in storage
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'directorstudio-projects'
    const filePath = validatedData.file_url.split('/').slice(-2).join('/') // Extract path from URL
    
    const { data: fileData, error: fileError } = await supabase.storage
      .from(bucketName)
      .download(filePath)

    if (fileError || !fileData) {
      return NextResponse.json(
        { error: 'File not found in storage' },
        { status: 404 }
      )
    }

    // Verify checksum if provided
    if (validatedData.checksum) {
      const buffer = await fileData.arrayBuffer()
      const hash = crypto.createHash('sha256').update(buffer).digest('hex')
      
      if (hash !== validatedData.checksum) {
        return NextResponse.json(
          { error: 'Checksum verification failed' },
          { status: 400 }
        )
      }
    }

    // Update voiceover session with verified file URL
    const { error: updateError } = await supabase
      .from('voiceover_sessions')
      .update({
        audio_file_url: validatedData.file_url,
        upload_status: 'verified'
      })
      .eq('clip_id', validatedData.clip_id)

    if (updateError) {
      console.error('Voiceover session update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update voiceover session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      upload_status: 'verified',
      file_url: validatedData.file_url
    })

  } catch (error) {
    console.error('Complete upload error:', error)
    
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

