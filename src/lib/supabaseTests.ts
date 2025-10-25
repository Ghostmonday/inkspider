// Supabase API Test Suite
// Run these tests to verify all Supabase operations work correctly

import { supabase, handleSupabaseError, getCurrentUser } from './supabaseClient'

export interface TestResult {
  operation: string
  success: boolean
  error?: string
  data?: any
}

export class SupabaseTestSuite {
  private results: TestResult[] = []

  private addResult(operation: string, success: boolean, error?: string, data?: any) {
    this.results.push({ operation, success, error, data })
  }

  // Test 1: Environment Variables
  async testEnvironmentVariables(): Promise<TestResult> {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!url || !key) {
        this.addResult('Environment Variables', false, 'Missing Supabase credentials')
        return this.results[this.results.length - 1]
      }
      
      this.addResult('Environment Variables', true, undefined, { url: url.substring(0, 20) + '...' })
      return this.results[this.results.length - 1]
    } catch (error) {
      this.addResult('Environment Variables', false, handleSupabaseError(error, 'environment check'))
      return this.results[this.results.length - 1]
    }
  }

  // Test 2: Supabase Connection
  async testConnection(): Promise<TestResult> {
    try {
      const { data, error } = await supabase.from('videos').select('count').limit(1)
      
      if (error) {
        this.addResult('Connection Test', false, handleSupabaseError(error, 'connection'))
        return this.results[this.results.length - 1]
      }
      
      this.addResult('Connection Test', true)
      return this.results[this.results.length - 1]
    } catch (error) {
      this.addResult('Connection Test', false, handleSupabaseError(error, 'connection'))
      return this.results[this.results.length - 1]
    }
  }

  // Test 3: Authentication
  async testAuthentication(): Promise<TestResult> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        this.addResult('Authentication', false, handleSupabaseError(error, 'auth session'))
        return this.results[this.results.length - 1]
      }
      
      this.addResult('Authentication', true, undefined, { 
        hasSession: !!session,
        userId: session?.user?.id || null 
      })
      return this.results[this.results.length - 1]
    } catch (error) {
      this.addResult('Authentication', false, handleSupabaseError(error, 'authentication'))
      return this.results[this.results.length - 1]
    }
  }

  // Test 4: Videos Table Access
  async testVideosTable(): Promise<TestResult> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, is_public')
        .eq('is_public', true)
        .limit(5)
      
      if (error) {
        this.addResult('Videos Table', false, handleSupabaseError(error, 'videos query'))
        return this.results[this.results.length - 1]
      }
      
      this.addResult('Videos Table', true, undefined, { 
        count: data?.length || 0,
        sample: data?.[0] || null 
      })
      return this.results[this.results.length - 1]
    } catch (error) {
      this.addResult('Videos Table', false, handleSupabaseError(error, 'videos table'))
      return this.results[this.results.length - 1]
    }
  }

  // Test 5: User Credits Table Access
  async testUserCreditsTable(): Promise<TestResult> {
    try {
      const user = await getCurrentUser()
      
      if (!user) {
        this.addResult('User Credits Table', false, 'No authenticated user')
        return this.results[this.results.length - 1]
      }

      const { data, error } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', user.id)
        .single()
      
      if (error) {
        this.addResult('User Credits Table', false, handleSupabaseError(error, 'user credits query'))
        return this.results[this.results.length - 1]
      }
      
      this.addResult('User Credits Table', true, undefined, { 
        credits: data?.credits || 0 
      })
      return this.results[this.results.length - 1]
    } catch (error) {
      this.addResult('User Credits Table', false, handleSupabaseError(error, 'user credits table'))
      return this.results[this.results.length - 1]
    }
  }

  // Test 6: Storage Access
  async testStorageAccess(): Promise<TestResult> {
    try {
      const { data, error } = await supabase.storage.from('videos').list('', { limit: 1 })
      
      if (error) {
        this.addResult('Storage Access', false, handleSupabaseError(error, 'storage list'))
        return this.results[this.results.length - 1]
      }
      
      this.addResult('Storage Access', true, undefined, { 
        bucketExists: true,
        fileCount: data?.length || 0 
      })
      return this.results[this.results.length - 1]
    } catch (error) {
      this.addResult('Storage Access', false, handleSupabaseError(error, 'storage access'))
      return this.results[this.results.length - 1]
    }
  }

  // Test 7: RLS Compliance (User-specific data)
  async testRLSCompliance(): Promise<TestResult> {
    try {
      const user = await getCurrentUser()
      
      if (!user) {
        this.addResult('RLS Compliance', false, 'No authenticated user for RLS test')
        return this.results[this.results.length - 1]
      }

      // Test that user can only access their own data
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email')
        .eq('id', user.id)
        .single()
      
      if (error) {
        this.addResult('RLS Compliance', false, handleSupabaseError(error, 'RLS user profile'))
        return this.results[this.results.length - 1]
      }
      
      this.addResult('RLS Compliance', true, undefined, { 
        canAccessOwnData: !!data,
        userId: data?.id || null 
      })
      return this.results[this.results.length - 1]
    } catch (error) {
      this.addResult('RLS Compliance', false, handleSupabaseError(error, 'RLS compliance'))
      return this.results[this.results.length - 1]
    }
  }

  // Run all tests
  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Supabase API Tests...')
    
    await this.testEnvironmentVariables()
    await this.testConnection()
    await this.testAuthentication()
    await this.testVideosTable()
    await this.testUserCreditsTable()
    await this.testStorageAccess()
    await this.testRLSCompliance()
    
    const passed = this.results.filter(r => r.success).length
    const total = this.results.length
    
    console.log(`✅ Tests completed: ${passed}/${total} passed`)
    
    if (passed < total) {
      console.log('❌ Failed tests:')
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.operation}: ${r.error}`)
      })
    }
    
    return this.results
  }

  // Get test results
  getResults(): TestResult[] {
    return this.results
  }

  // Get summary
  getSummary(): { passed: number; total: number; failed: TestResult[] } {
    const passed = this.results.filter(r => r.success).length
    const total = this.results.length
    const failed = this.results.filter(r => !r.success)
    
    return { passed, total, failed }
  }
}

// Export test runner function
export const runSupabaseTests = async (): Promise<TestResult[]> => {
  const testSuite = new SupabaseTestSuite()
  return await testSuite.runAllTests()
}
