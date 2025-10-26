import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BoostRequestSchema = z.object({
  project_id: z.string().uuid(),
  duration: z.enum(['24h', '7d']),
  credits_spent: z.number().int().min(1)
})

const BOOST_PRICING = {
  '24h': 5,
  '7d': 20
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = BoostRequestSchema.parse(body)

    // Verify pricing
    const expectedCredits = BOOST_PRICING[validatedData.duration]
    if (validatedData.credits_spent !== expectedCredits) {
      return NextResponse.json(
        { error: `Invalid credits amount. Expected ${expectedCredits} for ${validatedData.duration}` },
        { status: 400 }
      )
    }

    // Get project and verify ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, is_boosted')
      .eq('id', validatedData.project_id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // Check if project is already boosted
    if (project.is_boosted) {
      return NextResponse.json(
        { error: 'Project is already boosted' },
        { status: 400 }
      )
    }

    // Get user's credit balance
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('boost_credits')
      .eq('user_id', project.user_id)
      .single()

    if (creditsError || !userCredits) {
      return NextResponse.json(
        { error: 'User credits not found' },
        { status: 404 }
      )
    }

    if (userCredits.boost_credits < validatedData.credits_spent) {
      return NextResponse.json(
        { error: 'Insufficient boost credits' },
        { status: 400 }
      )
    }

    // Calculate boost end time
    const boostStart = new Date()
    const boostEnd = new Date()
    if (validatedData.duration === '24h') {
      boostEnd.setHours(boostEnd.getHours() + 24)
    } else {
      boostEnd.setDate(boostEnd.getDate() + 7)
    }

    // Start transaction
    const { data: boostData, error: boostError } = await supabase
      .from('project_boosts')
      .insert({
        project_id: validatedData.project_id,
        credits_spent: validatedData.credits_spent,
        boost_start: boostStart.toISOString(),
        boost_end: boostEnd.toISOString()
      })
      .select()
      .single()

    if (boostError) {
      console.error('Boost creation error:', boostError)
      return NextResponse.json(
        { error: 'Failed to create boost' },
        { status: 500 }
      )
    }

    // Update project as boosted
    const { error: projectUpdateError } = await supabase
      .from('projects')
      .update({ is_boosted: true })
      .eq('id', validatedData.project_id)

    if (projectUpdateError) {
      console.error('Project update error:', projectUpdateError)
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      )
    }

    // Deduct credits from user
    const { error: creditsUpdateError } = await supabase
      .from('user_credits')
      .update({
        boost_credits: userCredits.boost_credits - validatedData.credits_spent
      })
      .eq('user_id', project.user_id)

    if (creditsUpdateError) {
      console.error('Credits update error:', creditsUpdateError)
      return NextResponse.json(
        { error: 'Failed to update credits' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      boost_id: boostData.id,
      boost_end: boostEnd.toISOString(),
      remaining_credits: userCredits.boost_credits - validatedData.credits_spent
    })

  } catch (error) {
    console.error('Boost creation error:', error)
    
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

