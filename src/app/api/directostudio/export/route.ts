import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { z } from 'zod'

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schemas
const ProjectSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  film_title: z.string().min(1).max(200),
  description: z.string().optional(),
  director_notes: z.string().optional(),
  directorstudio_version: z.string().default('1.0.0'),
  tokens_used: z.number().int().min(0).default(0),
  continuity_score: z.number().min(0).max(1).default(0),
  is_public: z.boolean().default(true),
  client_created_at: z.string().datetime().optional(),
  idempotency_key: z.string().min(1)
})

const ScriptSegmentSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  segment_order: z.number().int().min(0),
  scene_description: z.string().min(1),
  original_script_text: z.string().min(1),
  duration: z.number().min(0).default(0)
})

const GenerationMetadataSchema = z.object({
  id: z.string().uuid(),
  segment_id: z.string().uuid(),
  ai_provider: z.string().min(1),
  prompt_used: z.string().min(1),
  continuity_notes: z.string().optional(),
  actual_tokens_consumed: z.number().int().min(0).default(0),
  estimated_tokens: z.number().int().min(0).default(0)
})

const VoiceoverSessionSchema = z.object({
  id: z.string().uuid(),
  clip_id: z.string().uuid(),
  take_number: z.number().int().min(1).default(1),
  timestamp_start: z.number().min(0).default(0),
  timestamp_end: z.number().min(0).default(0),
  audio_file_url: z.string().url().optional()
})

const TransactionSchema = z.object({
  project_id: z.string().uuid(),
  external_tx_id: z.string().min(1),
  tokens_debited: z.number().int().min(0),
  price_cents: z.number().int().min(0),
  payment_provider: z.string().min(1),
  currency: z.string().default('USD'),
  success: z.boolean().default(true),
  client_created_at: z.string().datetime().optional()
})

const ExportRequestSchema = z.object({
  project: ProjectSchema,
  script_segments: z.array(ScriptSegmentSchema),
  generation_metadata: z.array(GenerationMetadataSchema),
  voiceover_sessions: z.array(VoiceoverSessionSchema),
  transactions: z.array(TransactionSchema)
})

// HMAC verification function
function verifyHMACSignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

// Idempotency check function
async function checkIdempotency(idempotencyKey: string): Promise<boolean> {
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .single()
  
  return !!data
}

export async function POST(request: NextRequest) {
  try {
    // Verify required headers
    const idempotencyKey = request.headers.get('Idempotency-Key')
    const signature = request.headers.get('X-Client-Signature')
    const clientVersion = request.headers.get('X-Client-Version')
    
    if (!idempotencyKey || !signature || !clientVersion) {
      return NextResponse.json(
        { error: 'Missing required headers: Idempotency-Key, X-Client-Signature, X-Client-Version' },
        { status: 400 }
      )
    }

    // Get request body
    const body = await request.text()
    
    // Verify HMAC signature
    const appUploadSecret = process.env.APP_UPLOAD_SECRET
    if (!appUploadSecret) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!verifyHMACSignature(body, signature, appUploadSecret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Check idempotency
    if (await checkIdempotency(idempotencyKey)) {
      return NextResponse.json(
        { error: 'Request already processed', idempotency_key: idempotencyKey },
        { status: 409 }
      )
    }

    // Parse and validate request body
    const requestData = JSON.parse(body)
    const validatedData = ExportRequestSchema.parse(requestData)

    // Start database transaction
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert(validatedData.project)
      .select()
      .single()

    if (projectError) {
      console.error('Project insertion error:', projectError)
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      )
    }

    // Insert script segments
    if (validatedData.script_segments.length > 0) {
      const { error: segmentsError } = await supabase
        .from('script_segments')
        .insert(validatedData.script_segments)

      if (segmentsError) {
        console.error('Script segments insertion error:', segmentsError)
        return NextResponse.json(
          { error: 'Failed to create script segments' },
          { status: 500 }
        )
      }
    }

    // Insert generation metadata
    if (validatedData.generation_metadata.length > 0) {
      const { error: metadataError } = await supabase
        .from('generation_metadata')
        .insert(validatedData.generation_metadata)

      if (metadataError) {
        console.error('Generation metadata insertion error:', metadataError)
        return NextResponse.json(
          { error: 'Failed to create generation metadata' },
          { status: 500 }
        )
      }
    }

    // Insert voiceover sessions
    if (validatedData.voiceover_sessions.length > 0) {
      const { error: voiceoverError } = await supabase
        .from('voiceover_sessions')
        .insert(validatedData.voiceover_sessions)

      if (voiceoverError) {
        console.error('Voiceover sessions insertion error:', voiceoverError)
        return NextResponse.json(
          { error: 'Failed to create voiceover sessions' },
          { status: 500 }
        )
      }
    }

    // Insert transactions
    if (validatedData.transactions.length > 0) {
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert(validatedData.transactions)
        .select()

      if (transactionError) {
        console.error('Transactions insertion error:', transactionError)
        return NextResponse.json(
          { error: 'Failed to create transactions' },
          { status: 500 }
        )
      }

      // Create ledger entries
      if (transactionData) {
        const ledgerEntries = transactionData.map(tx => ({
          transaction_id: tx.id,
          external_tx_id: tx.external_tx_id,
          operation_type: 'debit' as const,
          amount: tx.tokens_debited,
          balance_after: 0 // This would be calculated based on user's current balance
        }))

        const { error: ledgerError } = await supabase
          .from('transactions_ledger')
          .insert(ledgerEntries)

        if (ledgerError) {
          console.error('Ledger insertion error:', ledgerError)
          // Don't fail the request for ledger errors, just log them
        }
      }
    }

    // Return success response
    const projectUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/project/${projectData.id}`
    
    return NextResponse.json({
      success: true,
      project_url: projectUrl,
      project_id: projectData.id,
      idempotency_key: idempotencyKey
    })

  } catch (error) {
    console.error('DirectorStudio export error:', error)
    
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

