"use client"

import { supabase } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ErrorBanner from "@/components/ErrorBanner"
import LoadingSpinner from "@/components/LoadingSpinner"
import { Video, Comment, User } from "@/types"
import { validateText, validateUUID } from "@/utils/validation"

interface VideoPageProps {
  params: Promise<{
    id: string
  }>
}

export default function VideoDetail({ params }: VideoPageProps) {
  const [video, setVideo] = useState<Video | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [likes, setLikes] = useState(0)
  const [userLiked, setUserLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState("")
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submittingComment, setSubmittingComment] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        const resolvedParams = await params
        
        // Validate video ID
        const idValidation = validateUUID(resolvedParams.id)
        if (!idValidation.isValid) {
          setError("Invalid video ID")
          setLoading(false)
          return
        }

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
          setError("Video not found or access denied")
          setLoading(false)
          return
        }

        setVideo(videoData)

        // Fetch comments
        const { data: commentsData, error: commentsError } = await supabase
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

        if (commentsError) {
          console.error("Error fetching comments:", commentsError)
        } else {
          setComments(commentsData || [])
        }

        // Fetch likes
        const { data: likesData, error: likesError } = await supabase
          .from("video_likes")
          .select("id")
          .eq("video_id", resolvedParams.id)

        if (likesError) {
          console.error("Error fetching likes:", likesError)
        } else {
          setLikes(likesData?.length || 0)
        }

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
      } catch (err) {
        console.error("Unexpected error:", err)
        setError("An unexpected error occurred while loading the video")
        setLoading(false)
      }
    }

    fetchVideoData()
  }, [params, router])

  const handleLike = async () => {
    if (!user) {
      router.push("/login")
      return
    }

    try {
      const resolvedParams = await params
      if (userLiked) {
        // Unlike
        const { error } = await supabase
          .from("video_likes")
          .delete()
          .eq("video_id", resolvedParams.id)
          .eq("user_id", user.id)
        
        if (error) {
          setError("Failed to unlike video")
          return
        }
        
        setLikes(prev => prev - 1)
        setUserLiked(false)
      } else {
        // Like
        const { error } = await supabase
          .from("video_likes")
          .insert({
            video_id: resolvedParams.id,
            user_id: user.id
          })
        
        if (error) {
          setError("Failed to like video")
          return
        }
        
        setLikes(prev => prev + 1)
        setUserLiked(true)
      }
    } catch (err) {
      console.error("Error handling like:", err)
      setError("An unexpected error occurred")
    }
  }

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || submittingComment) return

    // Validate comment text
    const commentValidation = validateText(commentText, "Comment", 1, 500)
    if (!commentValidation.isValid) {
      setError(commentValidation.errors.join(', '))
      return
    }

    setSubmittingComment(true)
    setError(null)

    try {
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
        setError("Failed to post comment")
      } else {
        setComments([data, ...comments])
        setCommentText("")
      }
    } catch (err) {
      console.error("Error posting comment:", err)
      setError("An unexpected error occurred while posting comment")
    } finally {
      setSubmittingComment(false)
    }
  }

  const addToCollection = async () => {
    if (!user) {
      router.push("/login")
      return
    }

    try {
      const resolvedParams = await params

      // Get user's collections
      const { data: collectionsData, error: collectionsError } = await supabase
        .from("collections")
        .select("id, name")
        .eq("user_id", user.id)

      if (collectionsError) {
        setError("Failed to load collections")
        return
      }

      if (!collectionsData || collectionsData.length === 0) {
        setError("You don't have any collections. Create one first!")
        return
      }

      // For now, add to the first collection (in a real app, you'd show a modal to select)
      const firstCollection = collectionsData[0]
      
      const { error } = await supabase
        .from("collection_videos")
        .insert({
          collection_id: firstCollection.id,
          video_id: resolvedParams.id
        })

      if (error) {
        setError("Failed to add video to collection")
      } else {
        setError(null)
        // Show success message briefly
        const successMessage = "Video added to collection!"
        setError(successMessage)
        setTimeout(() => setError(null), 3000)
      }
    } catch (err) {
      console.error("Error adding to collection:", err)
      setError("An unexpected error occurred")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner message="Loading video..." size="lg" />
      </div>
    )
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Video Not Found</h1>
          <p className="text-gray-600 mb-6">The video you're looking for doesn't exist or has been removed.</p>
          <a 
            href="/" 
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <ErrorBanner 
            message={error} 
            type={error.includes("added to collection") ? "info" : "error"}
            onClose={() => setError(null)} 
          />
        )}

        {/* Video Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{video.title}</h1>
          <p className="text-gray-600 mb-4">By: {video.user_profiles?.email || "Unknown"}</p>
          {video.description && (
            <p className="text-gray-700 mb-6">{video.description}</p>
          )}
          
          {/* Video Player */}
          <div className="mb-6">
            <video 
              controls 
              className="w-full max-w-4xl rounded-lg shadow-lg"
              src={video.file_url}
            >
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mb-6">
            <button 
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                userLiked 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-xl">{userLiked ? "❤️" : "🤍"}</span>
              <span>{likes} likes</span>
            </button>
            
            <button 
              onClick={addToCollection}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              <span>📁</span>
              <span>Add to Collection</span>
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            Comments ({comments.length})
          </h3>
          
          {user && (
            <form onSubmit={handleComment} className="mb-6">
              <textarea
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={submittingComment}
              />
              <div className="mt-3 flex justify-end">
                <button 
                  type="submit" 
                  disabled={submittingComment || !commentText.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingComment ? "Posting..." : "Post Comment"}
                </button>
              </div>
            </form>
          )}

          {comments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-center gap-2 mb-2">
                    <strong className="text-gray-900">
                      {comment.user_profiles?.email || "Anonymous"}
                    </strong>
                    <span className="text-sm text-gray-500">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-700">{comment.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <a 
            href="/" 
            className="inline-block bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}