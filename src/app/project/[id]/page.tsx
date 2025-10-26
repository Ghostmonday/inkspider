"use client"

import { supabase } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ErrorBanner from "@/components/ErrorBanner"
import LoadingSpinner from "@/components/LoadingSpinner"
import { Video, UserProfile, ScriptSegment, GenerationMetadata, VoiceoverSession, ProjectBoost, Transaction } from "@/types"

interface ProjectPageProps {
  params: Promise<{
    id: string
  }>
}

interface ProjectData {
  project: Video & {
    user_profiles: UserProfile
    script_segments: (ScriptSegment & {
      generation_metadata: (GenerationMetadata & {
        voiceover_sessions: VoiceoverSession[]
      })[]
    })[]
    project_boosts: ProjectBoost[]
    transactions: Transaction[]
  }
  reconciliation_status: {
    project_id: string
    tokens_expected: number
    tokens_actual: number
    discrepancy_percentage: number
  }
}

export default function ProjectDetail({ params }: ProjectPageProps) {
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'script' | 'production' | 'voiceovers'>('overview')
  const [showBoostModal, setShowBoostModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const resolvedParams = await params
        const response = await fetch(`/api/project/${resolvedParams.id}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch project')
        }
        
        const data = await response.json()
        setProjectData(data)
      } catch (err) {
        setError('Failed to load project')
        console.error('Project fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [params])

  const handleBoost = async (duration: '24h' | '7d') => {
    if (!projectData) return

    const creditsSpent = duration === '24h' ? 5 : 20
    
    try {
      const response = await fetch('/api/projects/boost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: projectData.project.id,
          duration,
          credits_spent: creditsSpent
        })
      })

      if (!response.ok) {
        throw new Error('Failed to boost project')
      }

      const result = await response.json()
      setShowBoostModal(false)
      // Refresh project data
      window.location.reload()
    } catch (err) {
      setError('Failed to boost project')
      console.error('Boost error:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorBanner message={error} onClose={() => setError(null)} />
      </div>
    )
  }

  if (!projectData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Project not found</h1>
          <p className="text-gray-600 mt-2">The project you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  const { project, reconciliation_status } = projectData

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.film_title}</h1>
              <p className="text-gray-600">By {project.user_profiles?.username || 'Unknown Director'}</p>
            </div>
            <div className="flex items-center space-x-4">
              {project.is_boosted && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  🔥 Boosted
                </span>
              )}
              <button
                onClick={() => setShowBoostModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Boost Project
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="aspect-video bg-black">
                {/* Video player would go here */}
                <div className="flex items-center justify-center h-full text-white">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🎬</div>
                    <p className="text-lg">Video Player</p>
                    <p className="text-sm text-gray-400">Presigned URL playback</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-6 bg-white rounded-lg shadow-sm">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'script', label: 'Script' },
                    { id: 'production', label: 'Production' },
                    { id: 'voiceovers', label: 'Voiceovers' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Description</h3>
                      <p className="text-gray-600 mt-2">{project.description || 'No description provided.'}</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Director Notes</h3>
                      <p className="text-gray-600 mt-2">{project.director_notes || 'No director notes provided.'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-gray-900">Tokens Used</h4>
                        <p className="text-2xl font-bold text-blue-600">{project.tokens_used}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Continuity Score</h4>
                        <p className="text-2xl font-bold text-green-600">{(project.continuity_score * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'script' && (
                  <div className="space-y-4">
                    {project.script_segments?.map((segment, index) => (
                      <div key={segment.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">Segment {segment.segment_order}</h4>
                          <span className="text-sm text-gray-500">{segment.duration}s</span>
                        </div>
                        <p className="text-gray-600 mb-2">{segment.scene_description}</p>
                        <p className="text-sm text-gray-500 italic">{segment.original_script_text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'production' && (
                  <div className="space-y-4">
                    {project.script_segments?.map((segment) =>
                      segment.generation_metadata?.map((metadata) => (
                        <div key={metadata.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-900">{metadata.ai_provider}</h4>
                            <span className="text-sm text-gray-500">{metadata.actual_tokens_consumed} tokens</span>
                          </div>
                          <p className="text-gray-600 mb-2">{metadata.prompt_used}</p>
                          {metadata.continuity_notes && (
                            <p className="text-sm text-gray-500 italic">{metadata.continuity_notes}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'voiceovers' && (
                  <div className="space-y-4">
                    {project.script_segments?.map((segment) =>
                      segment.generation_metadata?.map((metadata) =>
                        metadata.voiceover_sessions?.map((session) => (
                          <div key={session.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-gray-900">Take {session.take_number}</h4>
                              <span className="text-sm text-gray-500">
                                {session.timestamp_start}s - {session.timestamp_end}s
                              </span>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="flex-1 bg-gray-200 rounded h-8">
                                {/* Waveform would go here */}
                                <div className="flex items-center justify-center h-full text-gray-500">
                                  Audio Waveform
                                </div>
                              </div>
                              {session.audio_file_url && (
                                <a
                                  href={session.audio_file_url}
                                  download
                                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                                >
                                  Download
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Director Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Director</h3>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                  {project.user_profiles?.avatar_url ? (
                    <img
                      src={project.user_profiles.avatar_url}
                      alt="Director"
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <span className="text-gray-600 font-medium">
                      {project.user_profiles?.username?.charAt(0).toUpperCase() || 'D'}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {project.user_profiles?.username || 'Unknown Director'}
                  </p>
                  {project.user_profiles?.is_director_verified && (
                    <span className="text-blue-600 text-sm">✓ Verified</span>
                  )}
                </div>
              </div>
            </div>

            {/* Reconciliation Status */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reconciliation</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Expected Tokens:</span>
                  <span className="font-medium">{reconciliation_status.tokens_expected}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Actual Tokens:</span>
                  <span className="font-medium">{reconciliation_status.tokens_actual}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discrepancy:</span>
                  <span className={`font-medium ${
                    reconciliation_status.discrepancy_percentage > 5 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {reconciliation_status.discrepancy_percentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Boost History */}
            {project.project_boosts && project.project_boosts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Boost History</h3>
                <div className="space-y-3">
                  {project.project_boosts.map((boost) => (
                    <div key={boost.id} className="border rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{boost.credits_spent} credits</span>
                        <span className="text-sm text-gray-500">
                          {new Date(boost.boost_end).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{boost.impressions_gained} impressions</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Boost Modal */}
      {showBoostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Boost Project</h3>
            <p className="text-gray-600 mb-6">Choose a boost duration to increase visibility:</p>
            
            <div className="space-y-3">
              <button
                onClick={() => handleBoost('24h')}
                className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">24 Hours</p>
                    <p className="text-sm text-gray-600">Short-term visibility boost</p>
                  </div>
                  <span className="font-bold text-blue-600">5 credits</span>
                </div>
              </button>
              
              <button
                onClick={() => handleBoost('7d')}
                className="w-full p-4 border rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">7 Days</p>
                    <p className="text-sm text-gray-600">Extended visibility boost</p>
                  </div>
                  <span className="font-bold text-blue-600">20 credits</span>
                </div>
              </button>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowBoostModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

