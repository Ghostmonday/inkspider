"use client"

import { supabase } from "@/lib/supabaseClient"
import { Project, UserProfile } from "@/types"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ErrorBanner from "@/components/ErrorBanner"
import LoadingSpinner from "@/components/LoadingSpinner"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface ProjectWithProfile extends Project {
  user_profiles: UserProfile
  project_boosts: any[]
}

export default function Home() {
  const [projects, setProjects] = useState<ProjectWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'trending' | 'boosted' | 'recent'>('all')
  const [userMode, setUserMode] = useState<'viewer' | 'creator'>('viewer')
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
    }
    checkAuth()
  }, [])

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/projects?filter=${filter}&limit=20`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch projects')
        }
        
        const data = await response.json()
        setProjects(data.projects || [])
      } catch (err) {
        setError('Failed to load projects')
        console.error('Projects fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [filter])

  const handleProjectClick = (projectId: string) => {
    router.push(`/project/${projectId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SpiderInk.art</h1>
              <p className="text-gray-600">AI-Generated Video Platform</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setUserMode('viewer')}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    userMode === 'viewer'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Viewer
                </button>
                <button
                  onClick={() => setUserMode('creator')}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    userMode === 'creator'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Creator
                </button>
              </div>

              {/* User Actions */}
              {user ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">
                    Welcome, {user.email}
                  </span>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Dashboard
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => router.push('/login')}
                    className="px-4 py-2 text-gray-600 hover:text-gray-900"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => router.push('/register')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'all', label: 'All Projects' },
              { id: 'trending', label: 'Trending' },
              { id: 'boosted', label: 'Boosted' },
              { id: 'recent', label: 'Recent' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  filter === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onClose={() => setError(null)} />
          </div>
        )}

        {/* Creator Mode - Dense Grid */}
        {userMode === 'creator' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="aspect-video bg-gray-200 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">🎬</div>
                    <p className="text-sm">AI Generated</p>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 truncate">{project.film_title}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    by {project.user_profiles?.username || 'Unknown'}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-500">
                      {project.tokens_used} tokens
                    </span>
                    {project.is_boosted && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                        🔥 Boosted
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Viewer Mode - Poster Style */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="text-center text-white">
                    <div className="text-6xl mb-4">🎬</div>
                    <p className="text-lg font-medium">{project.film_title}</p>
                    <p className="text-sm opacity-90">
                      by {project.user_profiles?.username || 'Unknown Director'}
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{project.film_title}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {project.description || 'No description available.'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 text-sm font-medium">
                          {project.user_profiles?.username?.charAt(0).toUpperCase() || 'D'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {project.user_profiles?.username || 'Unknown Director'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(project.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{project.tokens_used} tokens</p>
                      {project.is_boosted && (
                        <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs mt-1">
                          🔥 Boosted
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {projects.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'No projects have been created yet.' 
                : `No ${filter} projects found.`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
