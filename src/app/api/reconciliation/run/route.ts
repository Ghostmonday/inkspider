import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('Authorization')
    const expectedSecret = process.env.CRON_SECRET
    
    if (!cronSecret || cronSecret !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all projects for reconciliation
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, film_title, tokens_used')

    if (projectsError) {
      console.error('Projects fetch error:', projectsError)
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      )
    }

    const reconciliationResults = []
    const issuesCreated = []

    // Process each project
    for (const project of projects || []) {
      try {
        // Get reconciliation data for this project
        const { data: reconciliationData, error: reconciliationError } = await supabase
          .rpc('reconcile_project_tokens', { project_uuid: project.id })

        if (reconciliationError) {
          console.error(`Reconciliation error for project ${project.id}:`, reconciliationError)
          continue
        }

        const reconciliation = reconciliationData?.[0]
        if (!reconciliation) continue

        const { tokens_expected, tokens_actual, discrepancy_percentage } = reconciliation

        // Check if discrepancy exceeds threshold (5%)
        if (discrepancy_percentage > 5) {
          // Check if issue already exists
          const { data: existingIssue } = await supabase
            .from('reconciliation_issues')
            .select('id')
            .eq('project_id', project.id)
            .eq('status', 'open')
            .single()

          if (!existingIssue) {
            // Create new reconciliation issue
            const { data: issueData, error: issueError } = await supabase
              .from('reconciliation_issues')
              .insert({
                project_id: project.id,
                discrepancy_percentage,
                tokens_expected,
                tokens_actual,
                status: 'open'
              })
              .select()
              .single()

            if (issueError) {
              console.error(`Failed to create reconciliation issue for project ${project.id}:`, issueError)
            } else {
              issuesCreated.push({
                project_id: project.id,
                film_title: project.film_title,
                discrepancy_percentage,
                tokens_expected,
                tokens_actual
              })
            }
          }
        }

        reconciliationResults.push({
          project_id: project.id,
          film_title: project.film_title,
          tokens_expected,
          tokens_actual,
          discrepancy_percentage
        })

      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error)
      }
    }

    // Send alert email if issues were created
    if (issuesCreated.length > 0) {
      const adminEmail = process.env.ADMIN_EMAIL_ALERT
      if (adminEmail) {
        // In a real implementation, you would send an email here
        console.log(`ALERT: ${issuesCreated.length} reconciliation issues created`)
        console.log('Issues:', issuesCreated)
      }
    }

    return NextResponse.json({
      success: true,
      projects_processed: reconciliationResults.length,
      issues_created: issuesCreated.length,
      reconciliation_results: reconciliationResults,
      issues: issuesCreated
    })

  } catch (error) {
    console.error('Reconciliation job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

