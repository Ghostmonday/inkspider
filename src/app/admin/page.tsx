"use client"

import { supabase } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ErrorBanner from "@/components/ErrorBanner"
import LoadingSpinner from "@/components/LoadingSpinner"
import { User } from "@/types"

interface ReconciliationIssue {
  id: string
  project_id: string
  tokens_expected: number
  tokens_actual: number
  discrepancy_percentage: number
  status: 'pending' | 'resolved' | 'investigating'
  created_at: string
  resolved_at?: string
  resolution_notes?: string
}

interface ProjectBoost {
  id: string
  project_id: string
  duration: string
  credits_spent: number
  boost_start: string
  boost_end: string
  is_active: boolean
  projects: {
    film_title: string
    user_profiles: {
      username: string
    }
  }
}

interface Transaction {
  id: string
  project_id: string
  external_tx_id: string
  tokens_debited: number
  price_cents: number
  payment_provider: string
  currency: string
  success: boolean
  created_at: string
  projects: {
    film_title: string
    user_profiles: {
      username: string
    }
  }
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'boosts' | 'transactions'>('reconciliation')
  
  // Reconciliation data
  const [reconciliationIssues, setReconciliationIssues] = useState<ReconciliationIssue[]>([])
  const [reconciliationLoading, setReconciliationLoading] = useState(false)
  
  // Boosts data
  const [projectBoosts, setProjectBoosts] = useState<ProjectBoost[]>([])
  const [boostsLoading, setBoostsLoading] = useState(false)
  
  // Transactions data
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  
  const router = useRouter()

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push("/login")
          return
        }

        // Check if user is admin (you can implement your own admin check logic)
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_admin")
          .eq("id", session.user.id)
          .single()

        if (!profile?.is_admin) {
          setError("Access denied. Admin privileges required.")
          setLoading(false)
          return
        }

        setUser(session.user)
        setLoading(false)
      } catch (err) {
        console.error("Error checking admin access:", err)
        setError("An unexpected error occurred while checking access")
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [router])

  const fetchReconciliationIssues = async () => {
    setReconciliationLoading(true)
    try {
      const { data, error } = await supabase
        .from("reconciliation_issues")
        .select(`
          *,
          projects (
            film_title,
            user_profiles (
              username
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) {
        setError("Failed to load reconciliation issues")
      } else {
        setReconciliationIssues(data || [])
      }
    } catch (err) {
      console.error("Error fetching reconciliation issues:", err)
      setError("An unexpected error occurred while loading reconciliation issues")
    } finally {
      setReconciliationLoading(false)
    }
  }

  const fetchProjectBoosts = async () => {
    setBoostsLoading(true)
    try {
      const { data, error } = await supabase
        .from("project_boosts")
        .select(`
          *,
          projects (
            film_title,
            user_profiles (
              username
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) {
        setError("Failed to load project boosts")
      } else {
        setProjectBoosts(data || [])
      }
    } catch (err) {
      console.error("Error fetching project boosts:", err)
      setError("An unexpected error occurred while loading project boosts")
    } finally {
      setBoostsLoading(false)
    }
  }

  const fetchTransactions = async () => {
    setTransactionsLoading(true)
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          projects (
            film_title,
            user_profiles (
              username
            )
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) {
        setError("Failed to load transactions")
      } else {
        setTransactions(data || [])
      }
    } catch (err) {
      console.error("Error fetching transactions:", err)
      setError("An unexpected error occurred while loading transactions")
    } finally {
      setTransactionsLoading(false)
    }
  }

  const runReconciliation = async () => {
    try {
      const { error } = await fetch('/api/reconciliation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (error) {
        setError("Failed to run reconciliation")
      } else {
        setError(null)
        // Refresh reconciliation issues
        fetchReconciliationIssues()
      }
    } catch (err) {
      console.error("Error running reconciliation:", err)
      setError("An unexpected error occurred while running reconciliation")
    }
  }

  const resolveReconciliationIssue = async (issueId: string, resolutionNotes: string) => {
    try {
      const { error } = await supabase
        .from("reconciliation_issues")
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes
        })
        .eq("id", issueId)

      if (error) {
        setError("Failed to resolve reconciliation issue")
      } else {
        // Refresh reconciliation issues
        fetchReconciliationIssues()
      }
    } catch (err) {
      console.error("Error resolving reconciliation issue:", err)
      setError("An unexpected error occurred while resolving issue")
    }
  }

  useEffect(() => {
    if (user && activeTab === 'reconciliation') {
      fetchReconciliationIssues()
    } else if (user && activeTab === 'boosts') {
      fetchProjectBoosts()
    } else if (user && activeTab === 'transactions') {
      fetchTransactions()
    }
  }, [user, activeTab])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner message="Checking admin access..." size="lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
          <a 
            href="/dashboard" 
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <ErrorBanner 
            message={error} 
            onClose={() => setError(null)} 
          />
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage reconciliation, boosts, and transactions</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('reconciliation')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'reconciliation'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Reconciliation Issues
              </button>
              <button
                onClick={() => setActiveTab('boosts')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'boosts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Project Boosts
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'transactions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Transactions
              </button>
            </nav>
          </div>
        </div>

        {/* Reconciliation Tab */}
        {activeTab === 'reconciliation' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Reconciliation Issues</h2>
                <button
                  onClick={runReconciliation}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Run Reconciliation
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {reconciliationLoading ? (
                <LoadingSpinner message="Loading reconciliation issues..." size="md" />
              ) : reconciliationIssues.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-4">✅</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Issues Found</h3>
                  <p className="text-gray-600">All token accounting is balanced!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Expected Tokens
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actual Tokens
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Discrepancy
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reconciliationIssues.map((issue) => (
                        <tr key={issue.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {issue.projects?.film_title || 'Unknown Project'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {issue.projects?.user_profiles?.username || 'Unknown User'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {issue.tokens_expected.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {issue.tokens_actual.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-sm font-medium ${
                              issue.discrepancy_percentage > 5 
                                ? 'text-red-600' 
                                : issue.discrepancy_percentage > 1 
                                  ? 'text-yellow-600' 
                                  : 'text-green-600'
                            }`}>
                              {issue.discrepancy_percentage.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              issue.status === 'resolved' 
                                ? 'bg-green-100 text-green-800'
                                : issue.status === 'investigating'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {issue.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(issue.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {issue.status === 'pending' && (
                              <button
                                onClick={() => resolveReconciliationIssue(issue.id, 'Resolved by admin')}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Boosts Tab */}
        {activeTab === 'boosts' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Project Boosts</h2>
            </div>
            
            <div className="p-6">
              {boostsLoading ? (
                <LoadingSpinner message="Loading project boosts..." size="md" />
              ) : projectBoosts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-4">🚀</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Boosts Found</h3>
                  <p className="text-gray-600">No projects have been boosted yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Credits Spent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {projectBoosts.map((boost) => (
                        <tr key={boost.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {boost.projects?.film_title || 'Unknown Project'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {boost.projects?.user_profiles?.username || 'Unknown User'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {boost.duration}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {boost.credits_spent}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              boost.is_active 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {boost.is_active ? 'Active' : 'Expired'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(boost.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Transactions</h2>
            </div>
            
            <div className="p-6">
              {transactionsLoading ? (
                <LoadingSpinner message="Loading transactions..." size="md" />
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-4">💳</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Transactions Found</h3>
                  <p className="text-gray-600">No transactions have been recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tokens
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Provider
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {transaction.projects?.film_title || 'Unknown Project'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {transaction.projects?.user_profiles?.username || 'Unknown User'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.external_tx_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.tokens_debited.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${(transaction.price_cents / 100).toFixed(2)} {transaction.currency}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.payment_provider}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              transaction.success 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.success ? 'Success' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(transaction.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8 text-center">
          <a 
            href="/dashboard" 
            className="inline-block bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
