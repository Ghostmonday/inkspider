// Comprehensive Test Suite for SpiderInk.art
// This file contains all the tests needed for production validation

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { performanceOptimizer } from '../src/utils/performance'
import { monitoring } from '../src/utils/monitoring'

// Test configuration
const TEST_CONFIG = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key',
  testUserId: 'test-user-id',
  testProjectId: 'test-project-id',
  timeout: 30000
}

// Create test Supabase client
const supabase = createClient(TEST_CONFIG.supabaseUrl, TEST_CONFIG.supabaseKey)

// ==============================================
// DATABASE TESTS
// ==============================================

describe('Database Schema Tests', () => {
  beforeAll(async () => {
    // Set up test data
    await setupTestData()
  })

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData()
  })

  it('should have all required tables', async () => {
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')

    expect(error).toBeNull()
    expect(tables).toBeDefined()

    const requiredTables = [
      'user_profiles',
      'user_credits',
      'projects',
      'script_segments',
      'generation_metadata',
      'voiceover_sessions',
      'project_boosts',
      'transactions',
      'transactions_ledger',
      'reconciliation_issues',
      'videos',
      'video_comments',
      'video_likes',
      'collections',
      'collection_videos',
      'follows'
    ]

    const tableNames = tables?.map(t => t.table_name) || []
    requiredTables.forEach(table => {
      expect(tableNames).toContain(table)
    })
  })

  it('should have proper indexes', async () => {
    const { data: indexes, error } = await supabase
      .from('pg_indexes')
      .select('indexname, tablename')
      .eq('schemaname', 'public')

    expect(error).toBeNull()
    expect(indexes).toBeDefined()

    const requiredIndexes = [
      'idx_projects_user_id',
      'idx_projects_public',
      'idx_projects_boosted',
      'idx_transactions_project_id',
      'idx_reconciliation_issues_status'
    ]

    const indexNames = indexes?.map(i => i.indexname) || []
    requiredIndexes.forEach(index => {
      expect(indexNames).toContain(index)
    })
  })

  it('should have Row Level Security enabled', async () => {
    const { data: policies, error } = await supabase
      .from('pg_policies')
      .select('tablename, policyname')
      .eq('schemaname', 'public')

    expect(error).toBeNull()
    expect(policies).toBeDefined()
    expect(policies?.length).toBeGreaterThan(0)
  })
})

// ==============================================
// API ENDPOINT TESTS
// ==============================================

describe('API Endpoint Tests', () => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  it('should respond to health check', async () => {
    const response = await fetch(`${baseUrl}/api/health`)
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.status).toBe('healthy')
    expect(data.timestamp).toBeDefined()
  })

  it('should handle project export', async () => {
    const testProject = {
      project: {
        id: TEST_CONFIG.testProjectId,
        user_id: TEST_CONFIG.testUserId,
        film_title: 'Test Film',
        description: 'Test Description',
        directorstudio_version: '1.0.0',
        tokens_used: 100,
        continuity_score: 0.85,
        is_public: true,
        idempotency_key: 'test-key-123'
      },
      script_segments: [],
      generation_metadata: [],
      voiceover_sessions: [],
      transactions: []
    }

    const response = await fetch(`${baseUrl}/api/directostudio/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'test-key-123',
        'X-Client-Signature': generateTestSignature(JSON.stringify(testProject)),
        'X-Client-Version': '1.0.0'
      },
      body: JSON.stringify(testProject)
    })

    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.project_id).toBeDefined()
  })

  it('should handle upload presign', async () => {
    const uploadRequest = {
      project_id: TEST_CONFIG.testProjectId,
      file_name: 'test.mp4',
      file_type: 'video/mp4',
      size: 1048576
    }

    const response = await fetch(`${baseUrl}/api/upload/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(uploadRequest)
    })

    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.presigned_url).toBeDefined()
    expect(data.file_path).toBeDefined()
    expect(data.expires_at).toBeDefined()
  })

  it('should handle transaction creation', async () => {
    const transaction = {
      project_id: TEST_CONFIG.testProjectId,
      external_tx_id: 'tx_test_123',
      tokens_debited: 100,
      price_cents: 100,
      payment_provider: 'stripe',
      currency: 'USD',
      success: true,
      client_created_at: new Date().toISOString()
    }

    const response = await fetch(`${baseUrl}/api/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transaction)
    })

    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.transaction_id).toBeDefined()
  })

  it('should handle reconciliation', async () => {
    const response = await fetch(`${baseUrl}/api/reconciliation/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    })

    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.processed_projects).toBeDefined()
  })
})

// ==============================================
// PERFORMANCE TESTS
// ==============================================

describe('Performance Tests', () => {
  it('should have fast API response times', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const startTime = Date.now()

    const response = await fetch(`${baseUrl}/api/health`)
    const endTime = Date.now()
    const responseTime = endTime - startTime

    expect(response.status).toBe(200)
    expect(responseTime).toBeLessThan(500) // Should respond within 500ms
  })

  it('should handle concurrent requests', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const concurrentRequests = 10

    const promises = Array(concurrentRequests).fill(null).map(async () => {
      const startTime = Date.now()
      const response = await fetch(`${baseUrl}/api/health`)
      const endTime = Date.now()
      return {
        status: response.status,
        responseTime: endTime - startTime
      }
    })

    const results = await Promise.all(promises)

    results.forEach(result => {
      expect(result.status).toBe(200)
      expect(result.responseTime).toBeLessThan(1000) // Should respond within 1s even under load
    })
  })

  it('should have efficient caching', async () => {
    const cacheKey = 'test-cache-key'
    const testData = { message: 'test data' }

    // Set cache
    performanceOptimizer.set(cacheKey, testData, 1000)

    // Get from cache
    const cachedData = performanceOptimizer.get(cacheKey)
    expect(cachedData).toEqual(testData)

    // Test cache expiration
    await new Promise(resolve => setTimeout(resolve, 1100))
    const expiredData = performanceOptimizer.get(cacheKey)
    expect(expiredData).toBeNull()
  })
})

// ==============================================
// SECURITY TESTS
// ==============================================

describe('Security Tests', () => {
  it('should validate HMAC signatures', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const invalidSignature = 'invalid-signature'

    const response = await fetch(`${baseUrl}/api/directostudio/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'test-key-123',
        'X-Client-Signature': invalidSignature,
        'X-Client-Version': '1.0.0'
      },
      body: JSON.stringify({})
    })

    expect(response.status).toBe(401)
  })

  it('should enforce rate limiting', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const requests = 150 // Exceed rate limit

    const promises = Array(requests).fill(null).map(async () => {
      return fetch(`${baseUrl}/api/health`)
    })

    const responses = await Promise.all(promises)
    const rateLimitedResponses = responses.filter(r => r.status === 429)

    expect(rateLimitedResponses.length).toBeGreaterThan(0)
  })

  it('should sanitize error messages', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const response = await fetch(`${baseUrl}/api/nonexistent-endpoint`)
    const data = await response.json()

    // Error messages should not contain sensitive information
    expect(data.error).toBeDefined()
    expect(data.error).not.toContain('password')
    expect(data.error).not.toContain('secret')
    expect(data.error).not.toContain('key')
  })
})

// ==============================================
// MONITORING TESTS
// ==============================================

describe('Monitoring Tests', () => {
  it('should track errors', () => {
    const errorMessage = 'Test error message'
    
    monitoring.trackError({
      message: errorMessage,
      severity: 'medium'
    })

    const stats = monitoring.getStats()
    expect(stats.errors).toBeGreaterThan(0)
  })

  it('should track performance metrics', () => {
    monitoring.trackPerformance('test-operation', {
      duration: 100,
      operation: 'test'
    })

    const stats = monitoring.getStats()
    expect(stats.performanceEvents).toBeGreaterThan(0)
    expect(stats.averagePerformance).toBeGreaterThan(0)
  })

  it('should track user events', () => {
    monitoring.trackUserEvent('test-event', {
      property: 'value'
    })

    const stats = monitoring.getStats()
    expect(stats.userEvents).toBeGreaterThan(0)
  })
})

// ==============================================
// INTEGRATION TESTS
// ==============================================

describe('Integration Tests', () => {
  it('should complete full project workflow', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // 1. Create project
    const projectData = {
      project: {
        id: TEST_CONFIG.testProjectId,
        user_id: TEST_CONFIG.testUserId,
        film_title: 'Integration Test Film',
        description: 'Test Description',
        directorstudio_version: '1.0.0',
        tokens_used: 100,
        continuity_score: 0.85,
        is_public: true,
        idempotency_key: 'integration-test-key'
      },
      script_segments: [],
      generation_metadata: [],
      voiceover_sessions: [],
      transactions: []
    }

    const createResponse = await fetch(`${baseUrl}/api/directostudio/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'integration-test-key',
        'X-Client-Signature': generateTestSignature(JSON.stringify(projectData)),
        'X-Client-Version': '1.0.0'
      },
      body: JSON.stringify(projectData)
    })

    expect(createResponse.status).toBe(200)
    const createData = await createResponse.json()

    // 2. Get project
    const getResponse = await fetch(`${baseUrl}/api/project/${createData.project_id}`)
    expect(getResponse.status).toBe(200)
    const getData = await getResponse.json()
    expect(getData.project.film_title).toBe('Integration Test Film')

    // 3. Boost project
    const boostData = {
      project_id: createData.project_id,
      duration: '24h',
      credits_spent: 5
    }

    const boostResponse = await fetch(`${baseUrl}/api/projects/boost`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(boostData)
    })

    expect(boostResponse.status).toBe(200)
    const boostResult = await boostResponse.json()
    expect(boostResult.success).toBe(true)
  })

  it('should handle upload workflow', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // 1. Get presigned URL
    const presignData = {
      project_id: TEST_CONFIG.testProjectId,
      file_name: 'integration-test.mp4',
      file_type: 'video/mp4',
      size: 1048576
    }

    const presignResponse = await fetch(`${baseUrl}/api/upload/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(presignData)
    })

    expect(presignResponse.status).toBe(200)
    const presignResult = await presignResponse.json()

    // 2. Complete upload
    const completeData = {
      project_id: TEST_CONFIG.testProjectId,
      clip_id: 'test-clip-id',
      file_url: presignResult.file_path,
      checksum: 'test-checksum'
    }

    const completeResponse = await fetch(`${baseUrl}/api/upload/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(completeData)
    })

    expect(completeResponse.status).toBe(200)
    const completeResult = await completeResponse.json()
    expect(completeResult.success).toBe(true)
  })
})

// ==============================================
// LOAD TESTS
// ==============================================

describe('Load Tests', () => {
  it('should handle high concurrent load', async () => {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const concurrentUsers = 50
    const requestsPerUser = 10

    const startTime = Date.now()

    const promises = Array(concurrentUsers).fill(null).map(async (_, userIndex) => {
      const userPromises = Array(requestsPerUser).fill(null).map(async (_, requestIndex) => {
        const response = await fetch(`${baseUrl}/api/health`)
        return {
          user: userIndex,
          request: requestIndex,
          status: response.status,
          responseTime: Date.now() - startTime
        }
      })
      return Promise.all(userPromises)
    })

    const results = await Promise.all(promises)
    const allResults = results.flat()

    const endTime = Date.now()
    const totalTime = endTime - startTime

    // All requests should succeed
    const failedRequests = allResults.filter(r => r.status !== 200)
    expect(failedRequests.length).toBe(0)

    // Should handle load within reasonable time
    expect(totalTime).toBeLessThan(30000) // 30 seconds max

    // Calculate throughput
    const throughput = (concurrentUsers * requestsPerUser) / (totalTime / 1000)
    expect(throughput).toBeGreaterThan(10) // At least 10 requests per second
  })
})

// ==============================================
// HELPER FUNCTIONS
// ==============================================

async function setupTestData() {
  // Create test user profile
  await supabase
    .from('user_profiles')
    .upsert({
      id: TEST_CONFIG.testUserId,
      email: 'test@example.com',
      username: 'testuser',
      is_admin: false
    })

  // Create test user credits
  await supabase
    .from('user_credits')
    .upsert({
      user_id: TEST_CONFIG.testUserId,
      boost_credits: 100
    })
}

async function cleanupTestData() {
  // Clean up test data
  await supabase
    .from('user_credits')
    .delete()
    .eq('user_id', TEST_CONFIG.testUserId)

  await supabase
    .from('user_profiles')
    .delete()
    .eq('id', TEST_CONFIG.testUserId)
}

function generateTestSignature(body: string): string {
  const crypto = require('crypto')
  const secret = process.env.APP_UPLOAD_SECRET || 'test-secret'
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')
}

// ==============================================
// TEST CONFIGURATION
// ==============================================

export default {
  testTimeout: TEST_CONFIG.timeout,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
