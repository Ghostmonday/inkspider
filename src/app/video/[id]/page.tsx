"use client"

import { supabase } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface VideoPageProps {
  params: Promise<{
    id: string
  }>
}

export default function VideoDetail({ params }: VideoPageProps) {
  const [video, setVideo] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [likes, setLikes] = useState(0)
  const [userLiked, setUserLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState("")
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchVideoData = async () => {
      const resolvedParams = await params
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)

      // Fetch video details
      const { data: videoData, error: videoError } = await supabase
        .from("videos")
        .select(`
          *,
          user_profiles (
            id,
            email
          )
        `)
        .eq("id", resolvedParams.id)
        .single()

      if (videoError) {
        console.error("Error fetching video:", videoError)
        router.push("/")
        return
      }

      setVideo(videoData)

      // Fetch comments
      const { data: commentsData } = await supabase
        .from("video_comments")
        .select(`
          *,
          user_profiles (
            id,
            email
          )
        `)
        .eq("video_id", resolvedParams.id)
        .order("created_at", { ascending: false })

      setComments(commentsData || [])

      // Fetch likes
      const { data: likesData } = await supabase
        .from("video_likes")
        .select("count")
        .eq("video_id", resolvedParams.id)

      setLikes(likesData?.length || 0)

      // Check if current user liked this video
      if (session?.user) {
        const { data: userLikeData } = await supabase
          .from("video_likes")
          .select("id")
          .eq("video_id", resolvedParams.id)
          .eq("user_id", session.user.id)
          .single()

        setUserLiked(!!userLikeData)
      }

      setLoading(false)
    }

    fetchVideoData()
  }, [params, router])

  const handleLike = async () => {
    if (!user) {
      router.push("/login")
      return
    }

    const resolvedParams = await params
    if (userLiked) {
      // Unlike
      await supabase
        .from("video_likes")
        .delete()
        .eq("video_id", resolvedParams.id)
        .eq("user_id", user.id)
      
      setLikes(prev => prev - 1)
      setUserLiked(false)
    } else {
      // Like
      await supabase
        .from("video_likes")
        .insert({
          video_id: resolvedParams.id,
          user_id: user.id
        })
      
      setLikes(prev => prev + 1)
      setUserLiked(true)
    }
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !commentText.trim()) return

    const resolvedParams = await params
    const { data, error } = await supabase
      .from("video_comments")
      .insert({
        video_id: resolvedParams.id,
        user_id: user.id,
        comment: commentText.trim()
      })
      .select(`
        *,
        user_profiles (
          id,
          email
        )
      `)
      .single()

    if (error) {
      alert("Error posting comment: " + error.message)
    } else {
      setComments([data, ...comments])
      setCommentText("")
    }
  }

  const addToCollection = async () => {
    if (!user) {
      router.push("/login")
      return
    }

    // Get user's collections
    const { data: collectionsData } = await supabase
      .from("collections")
      .select("id, name")
      .eq("user_id", user.id)

    if (!collectionsData || collectionsData.length === 0) {
      alert("You don't have any collections. Create one first!")
      router.push("/collections")
      return
    }

    const collectionNames = collectionsData.map(c => `${c.id}: ${c.name}`).join("\n")
    const selection = prompt(`Select collection ID:\n${collectionNames}`)
    
    if (!selection) return

    const collectionId = selection.split(":")[0].trim()

    const { error } = await supabase
      .from("collection_videos")
      .insert({
        collection_id: collectionId,
        video_id: params.id
      })

    if (error) {
      alert("Error adding to collection: " + error.message)
    } else {
      alert("Video added to collection!")
    }
  }

  if (loading) {
    return <div>Loading video...</div>
  }

  if (!video) {
    return <div>Video not found</div>
  }

  return (
    <div>
      <h1>{video.title}</h1>
      <p>By: {video.user_profiles?.email || "Unknown"}</p>
      <p>{video.description}</p>
      
      <div>
        <video 
          controls 
          width="800" 
          height="450"
          src={video.file_url}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <div>
        <button onClick={handleLike}>
          {userLiked ? "❤️" : "🤍"} {likes} likes
        </button>
        <button onClick={addToCollection}>
          Add to Collection
        </button>
      </div>

      <div>
        <h3>Comments ({comments.length})</h3>
        
        {user && (
          <form onSubmit={handleComment}>
            <textarea
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
            />
            <button type="submit">Post Comment</button>
          </form>
        )}

        {comments.length === 0 ? (
          <p>No comments yet. Be the first to comment!</p>
        ) : (
          <div>
            {comments.map((comment) => (
              <div key={comment.id}>
                <strong>{comment.user_profiles?.email || "Anonymous"}</strong>
                <p>{comment.comment}</p>
                <small>{new Date(comment.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        )}
      </div>

      <a href="/">Back to Home</a>
    </div>
  )
}