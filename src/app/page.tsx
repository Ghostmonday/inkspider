"use client"

import { supabase } from "@/lib/supabaseClient"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useEffect, useState } from "react"

export default function Home() {
  const [videos, setVideos] = useState<any[]>([])

  useEffect(() => {
    const fetchVideos = async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
      
      if (error) {
        console.error("Error fetching videos:", error)
      } else {
        setVideos(data || [])
      }
    }

    fetchVideos()
  }, [])

  return (
    <div>
      <h1>Public Videos</h1>
      {videos.map((video) => (
        <div key={video.id}>
          <h2>{video.title}</h2>
          <p>{video.description}</p>
          <a href={`/video/${video.id}`}>View Video</a>
        </div>
      ))}
    </div>
  )
}
