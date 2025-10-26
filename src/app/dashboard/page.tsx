"use client"

import { supabase } from "@/lib/supabaseClient"
import { User, Video } from "@/types"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ErrorBanner from "@/components/ErrorBanner"
import LoadingSpinner from "@/components/LoadingSpinner"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [credits, setCredits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push("/login")
          return
        }
        setUser(session.user)

        const { data: videosData, error: videosError } = await supabase
          .from("videos")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
        
        if (videosError) {
          setError(`Error loading videos: ${videosError.message}`)
        } else {
          setVideos(videosData || [])
        }

        const { data: creditsData, error: creditsError } = await supabase
          .from("user_credits")
          .select("credits")
          .eq("user_id", session.user.id)
          .single()
        
        if (creditsError) {
          console.error("Error loading credits:", creditsError)
        } else {
          setCredits(creditsData?.credits || 0)
        }
      } catch (err) {
        setError('An unexpected error occurred')
      }
    }

    checkAuth()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const toggleVisibility = async (videoId: string, currentVisibility: boolean) => {
    setLoading(true)
    await supabase
      .from("videos")
      .update({ is_public: !currentVisibility })
      .eq("id", videoId)
    
    const { data: videosData } = await supabase
      .from("videos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    
    setVideos(videosData || [])
    setLoading(false)
  }

  const deleteVideo = async (videoId: string) => {
    const confirmed = window.confirm("Are you sure you want to delete this video?")
    if (!confirmed) return
    
    setLoading(true)
    try {
      const { error } = await supabase.from("videos").delete().eq("id", videoId)
      
      if (error) {
        setError(`Error deleting video: ${error.message}`)
      } else {
        const { data: videosData } = await supabase
          .from("videos")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
        
        setVideos(videosData || [])
      }
    } catch (err) {
      setError('An unexpected error occurred while deleting the video')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 px-4 py-2 rounded">
              <span className="text-blue-800 font-semibold">Credits: {credits}</span>
            </div>
            <button 
              onClick={handleSignOut}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            >
              Sign Out
            </button>
          </div>
        </div>
        
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
        
        <div className="mb-6">
          <a 
            href="/upload"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold inline-block"
          >
            Upload New Video
          </a>
        </div>
        
        <h2 className="text-2xl font-semibold mb-4">Your Videos</h2>
        
        {loading && <LoadingSpinner message="Loading..." />}
        
        {videos.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No videos yet. Upload your first video!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div key={video.id} className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-2">{video.title}</h3>
                <p className="text-gray-600 mb-4">{video.description}</p>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`px-2 py-1 rounded text-sm ${video.is_public ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {video.is_public ? "Public" : "Private"}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button 
                    onClick={() => toggleVisibility(video.id, video.is_public)}
                    disabled={loading}
                    className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm disabled:opacity-50"
                  >
                    {video.is_public ? "Make Private" : "Make Public"}
                  </button>
                  <button 
                    onClick={() => deleteVideo(video.id)}
                    disabled={loading}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <a 
                    href={`/video/${video.id}`}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                  >
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
