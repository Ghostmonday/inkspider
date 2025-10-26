import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch project with all related data
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        user_profiles (
          id,
          email,
          username,
          bio,
          avatar_url,
          is_director_verified
        ),
        script_segments (
          id,
          segment_order,
          scene_description,
          original_script_text,
          duration,
          generation_metadata (
            id,
            ai_provider,
            prompt_used,
            continuity_notes,
            actual_tokens_consumed,
            estimated_tokens,
            voiceover_sessions (
              id,
              take_number,
              timestamp_start,
              timestamp_end,
              audio_file_url,
              upload_status
            )
          )
        ),
        project_boosts (
          id,
          credits_spent,
          boost_start,
          boost_end,
          impressions_gained
        ),
        transactions (
          id,
          external_tx_id,
          tokens_debited,
          price_cents,
          payment_provider,
          currency,
          success,
          created_at
        )
      `)
      .eq('id', id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Calculate reconciliation status
    const { data: reconciliationData } = await supabase
      .rpc('reconcile_project_tokens', { project_uuid: id })

    const reconciliationStatus = reconciliationData?.[0] || {
      project_id: id,
      tokens_expected: 0,
      tokens_actual: 0,
      discrepancy_percentage: 0
    }

    return NextResponse.json({
      project,
      reconciliation_status: reconciliationStatus
    })

  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

