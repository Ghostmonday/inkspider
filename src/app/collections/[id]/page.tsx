"use client"

import { supabase } from "@/lib/supabaseClient"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface CollectionPageProps {
  params: {
    id: string
  }
}

export default function CollectionDetail({ params }: CollectionPageProps) {
  const [collection, setCollection] = useState<any>(null)
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchCollection = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
        return
      }

      // Fetch collection details
      const { data: collectionData, error: collectionError } = await supabase
        .from("collections")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", session.user.id)
        .single()

      if (collectionError) {
        console.error("Error fetching collection:", collectionError)
        router.push("/collections")
        return
      }

      setCollection(collectionData)

      // Fetch videos in collection
      const { data: videosData, error: videosError } = await supabase
        .from("collection_videos")
        .select(`
          video_id,
          videos (
            id,
            title,
            description,
            file_url,
            thumbnail_url,
            created_at,
            is_public
          )
        `)
        .eq("collection_id", params.id)

      if (videosError) {
        console.error("Error fetching collection videos:", videosError)
      } else {
        setVideos(videosData?.map(item => item.videos).filter(Boolean) || [])
      }

      setLoading(false)
    }

    fetchCollection()
  }, [params.id, router])

  const removeVideoFromCollection = async (videoId: string) => {
    if (!confirm("Remove this video from collection?")) return

    const { error } = await supabase
      .from("collection_videos")
      .delete()
      .eq("collection_id", params.id)
      .eq("video_id", videoId)

    if (error) {
      alert("Error removing video: " + error.message)
    } else {
      setVideos(videos.filter(v => v.id !== videoId))
    }
  }

  const addVideoToCollection = async () => {
    const videoId = prompt("Enter video ID to add:")
    if (!videoId) return

    const { error } = await supabase
      .from("collection_videos")
      .insert({
        collection_id: params.id,
        video_id: videoId
      })

    if (error) {
      alert("Error adding video: " + error.message)
    } else {
      // Refresh videos list
      const { data: videosData } = await supabase
        .from("collection_videos")
        .select(`
          video_id,
          videos (
            id,
            title,
            description,
            file_url,
            thumbnail_url,
            created_at,
            is_public
          )
        `)
        .eq("collection_id", params.id)

      setVideos(videosData?.map(item => item.videos).filter(Boolean) || [])
    }
  }

  if (loading) {
    return <div>Loading collection...</div>
  }

  if (!collection) {
    return <div>Collection not found</div>
  }

  return (
    <div>
      <h1>{collection.name}</h1>
      <p>{collection.description}</p>
      <p>Public: {collection.is_public ? "Yes" : "No"}</p>
      
      <div>
        <button onClick={addVideoToCollection}>Add Video</button>
        <h2>Videos in Collection ({videos.length})</h2>
        
        {videos.length === 0 ? (
          <p>No videos in this collection yet.</p>
        ) : (
          <div>
            {videos.map((video) => (
              <div key={video.id}>
                <h3>{video.title}</h3>
                <p>{video.description}</p>
                <p>Public: {video.is_public ? "Yes" : "No"}</p>
                <button onClick={() => router.push(`/video/${video.id}`)}>
                  View Video
                </button>
                <button onClick={() => removeVideoFromCollection(video.id)}>
                  Remove from Collection
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <a href="/collections">Back to Collections</a>
    </div>
  )
}
