import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TransactionRequestSchema = z.object({
  project_id: z.string().uuid(),
  external_tx_id: z.string().min(1),
  tokens_debited: z.number().int().min(0),
  price_cents: z.number().int().min(0),
  payment_provider: z.string().min(1),
  currency: z.string().default('USD'),
  success: z.boolean().default(true),
  client_created_at: z.string().datetime().optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = TransactionRequestSchema.parse(body)

    // Check if transaction already exists (idempotency)
    const { data: existingTransaction } = await supabase
      .from('transactions')
      .select('id')
      .eq('external_tx_id', validatedData.external_tx_id)
      .single()

    if (existingTransaction) {
      return NextResponse.json({
        success: true,
        transaction_id: existingTransaction.id,
        message: 'Transaction already processed',
        idempotent: true
      })
    }

    // Verify project exists
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

    // Create transaction
    const { data: transactionData, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        project_id: validatedData.project_id,
        external_tx_id: validatedData.external_tx_id,
        tokens_debited: validatedData.tokens_debited,
        price_cents: validatedData.price_cents,
        payment_provider: validatedData.payment_provider,
        currency: validatedData.currency,
        success: validatedData.success,
        client_created_at: validatedData.client_created_at
      })
      .select()
      .single()

    if (transactionError) {
      console.error('Transaction creation error:', transactionError)
      return NextResponse.json(
        { error: 'Failed to create transaction' },
        { status: 500 }
      )
    }

    // Create ledger entry
    const { error: ledgerError } = await supabase
      .from('transactions_ledger')
      .insert({
        transaction_id: transactionData.id,
        external_tx_id: validatedData.external_tx_id,
        operation_type: 'debit',
        amount: validatedData.tokens_debited,
        balance_after: 0 // This would be calculated based on user's current balance
      })

    if (ledgerError) {
      console.error('Ledger creation error:', ledgerError)
      // Don't fail the request for ledger errors, just log them
    }

    // Update project tokens_used
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        tokens_used: validatedData.tokens_debited
      })
      .eq('id', validatedData.project_id)

    if (updateError) {
      console.error('Project update error:', updateError)
      // Don't fail the request for this error either
    }

    return NextResponse.json({
      success: true,
      transaction_id: transactionData.id,
      external_tx_id: validatedData.external_tx_id
    })

  } catch (error) {
    console.error('Transaction creation error:', error)
    
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

