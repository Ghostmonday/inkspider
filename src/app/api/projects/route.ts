import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const filter = searchParams.get('filter') || 'all'
    
    const offset = (page - 1) * limit

    let query = supabase
      .from('projects')
      .select(`
        id,
        film_title,
        description,
        director_notes,
        tokens_used,
        continuity_score,
        is_public,
        is_boosted,
        created_at,
        updated_at,
        user_profiles (
          id,
          username,
          avatar_url,
          is_director_verified
        ),
        project_boosts (
          id,
          boost_end
        )
      `)

    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (filter === 'boosted') {
      query = query.eq('is_boosted', true)
    } else if (filter === 'trending') {
      // For trending, we'll order by a combination of factors
      // This is a simplified version - in production you'd want more sophisticated trending logic
      query = query
        .eq('is_public', true)
        .order('created_at', { ascending: false })
    } else if (filter === 'recent') {
      query = query
        .eq('is_public', true)
        .order('created_at', { ascending: false })
    } else {
      query = query
        .eq('is_public', true)
        .order('created_at', { ascending: false })
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: projects, error: projectsError, count } = await query

    if (projectsError) {
      console.error('Projects fetch error:', projectsError)
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      projects: projects || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Get projects error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

