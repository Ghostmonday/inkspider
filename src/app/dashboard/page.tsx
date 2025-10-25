"use client"

import { supabase } from "@/lib/supabaseClient"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [videos, setVideos] = useState<any[]>([])
  const [credits, setCredits] = useState(0)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
        return
      }
      setUser(session.user)

      const { data: videosData } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
      
      setVideos(videosData || [])

      const { data: creditsData } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("user_id", session.user.id)
        .single()
      
      setCredits(creditsData?.credits || 0)
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
    if (!confirm("Are you sure you want to delete this video?")) return
    
    setLoading(true)
    await supabase.from("videos").delete().eq("id", videoId)
    
    const { data: videosData } = await supabase
      .from("videos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    
    setVideos(videosData || [])
    setLoading(false)
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Credits: {credits}</p>
      <button onClick={handleSignOut}>Sign Out</button>
      
      <h2>Your Videos</h2>
      {videos.map((video) => (
        <div key={video.id}>
          <h3>{video.title}</h3>
          <p>{video.description}</p>
          <p>Public: {video.is_public ? "Yes" : "No"}</p>
          <button 
            onClick={() => toggleVisibility(video.id, video.is_public)}
            disabled={loading}
          >
            {video.is_public ? "Make Private" : "Make Public"}
          </button>
          <button 
            onClick={() => deleteVideo(video.id)}
            disabled={loading}
          >
            Delete
          </button>
          <a href={`/video/${video.id}`}>View</a>
        </div>
      ))}
      
      <a href="/upload">Upload New Video</a>
    </div>
  )
}
