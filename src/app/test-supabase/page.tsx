'use client'

import { useState } from 'react'
import { runSupabaseTests, TestResult } from '@/lib/supabaseTests'

export default function TestSupabasePage() {
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const runTests = async () => {
    setIsRunning(true)
    try {
      const testResults = await runSupabaseTests()
      setResults(testResults)
    } catch (error) {
      console.error('Test execution failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const getStatusIcon = (success: boolean) => {
    return success ? '✅' : '❌'
  }

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600'
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Supabase API Health Check</h1>
      
      <div className="mb-6">
        <button
          onClick={runTests}
          disabled={isRunning}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium"
        >
          {isRunning ? 'Running Tests...' : 'Run Supabase Tests'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="bg-gray-100 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Test Summary</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {results.filter(r => r.success).length}
                </div>
                <div className="text-sm text-gray-600">Passed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {results.filter(r => !r.success).length}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {results.length}
                </div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Test Results</h2>
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{result.operation}</h3>
                  <span className={`text-lg ${getStatusColor(result.success)}`}>
                    {getStatusIcon(result.success)}
                  </span>
                </div>
                
                {result.error && (
                  <div className="text-red-600 text-sm mb-2">
                    Error: {result.error}
                  </div>
                )}
                
                {result.data && (
                  <div className="text-gray-600 text-sm">
                    <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notes</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• Make sure your .env.local file contains valid Supabase credentials</li>
          <li>• Some tests require authentication - login first for complete results</li>
          <li>• RLS policies must be properly configured in your Supabase dashboard</li>
          <li>• Storage bucket 'videos' must exist and be accessible</li>
        </ul>
      </div>
    </div>
  )
}
