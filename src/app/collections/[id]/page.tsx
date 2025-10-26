"use client"

import { supabase } from "@/lib/supabaseClient"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ErrorBanner from "@/components/ErrorBanner"
import LoadingSpinner from "@/components/LoadingSpinner"
import { Collection, Video, User } from "@/types"
import { validateUUID, validateText } from "@/utils/validation"

interface CollectionPageProps {
  params: Promise<{
    id: string
  }>
}

export default function CollectionDetail({ params }: CollectionPageProps) {
  const [collection, setCollection] = useState<Collection | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newVideoId, setNewVideoId] = useState("")
  const [addingVideo, setAddingVideo] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        const resolvedParams = await params
        
        // Validate collection ID
        const idValidation = validateUUID(resolvedParams.id)
        if (!idValidation.isValid) {
          setError("Invalid collection ID")
          setLoading(false)
          return
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push("/login")
          return
        }

        setUser(session.user)

        // Fetch collection details
        const { data: collectionData, error: collectionError } = await supabase
          .from("collections")
          .select("*")
          .eq("id", resolvedParams.id)
          .eq("user_id", session.user.id)
          .single()

        if (collectionError) {
          console.error("Error fetching collection:", collectionError)
          setError("Collection not found or access denied")
          setLoading(false)
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
          .eq("collection_id", resolvedParams.id)

        if (videosError) {
          console.error("Error fetching collection videos:", videosError)
          setError("Failed to load videos in collection")
        } else {
          setVideos(videosData?.map(item => item.videos).filter(Boolean) || [])
        }

        setLoading(false)
      } catch (err) {
        console.error("Unexpected error:", err)
        setError("An unexpected error occurred while loading the collection")
        setLoading(false)
      }
    }

    fetchCollection()
  }, [params, router])

  const removeVideoFromCollection = async (videoId: string) => {
    try {
      const resolvedParams = await params
      const { error } = await supabase
        .from("collection_videos")
        .delete()
        .eq("collection_id", resolvedParams.id)
        .eq("video_id", videoId)

      if (error) {
        setError("Failed to remove video from collection")
      } else {
        setVideos(videos.filter(v => v.id !== videoId))
        setShowDeleteConfirm(null)
      }
    } catch (err) {
      console.error("Error removing video:", err)
      setError("An unexpected error occurred while removing video")
    }
  }

  const addVideoToCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (addingVideo || !newVideoId.trim()) return

    // Validate video ID
    const idValidation = validateUUID(newVideoId.trim())
    if (!idValidation.isValid) {
      setError("Please enter a valid video ID")
      return
    }

    setAddingVideo(true)
    setError(null)

    try {
      const resolvedParams = await params
      
      // Check if video exists and is accessible
      const { data: videoData, error: videoError } = await supabase
        .from("videos")
        .select("id, title")
        .eq("id", newVideoId.trim())
        .single()

      if (videoError || !videoData) {
        setError("Video not found or not accessible")
        setAddingVideo(false)
        return
      }

      // Check if video is already in collection
      const { data: existingData } = await supabase
        .from("collection_videos")
        .select("id")
        .eq("collection_id", resolvedParams.id)
        .eq("video_id", newVideoId.trim())
        .single()

      if (existingData) {
        setError("This video is already in the collection")
        setAddingVideo(false)
        return
      }

      const { error } = await supabase
        .from("collection_videos")
        .insert({
          collection_id: resolvedParams.id,
          video_id: newVideoId.trim()
        })

      if (error) {
        setError("Failed to add video to collection")
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
          .eq("collection_id", resolvedParams.id)

        setVideos(videosData?.map(item => item.videos).filter(Boolean) || [])
        setNewVideoId("")
        setShowAddForm(false)
      }
    } catch (err) {
      console.error("Error adding video:", err)
      setError("An unexpected error occurred while adding video")
    } finally {
      setAddingVideo(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner message="Loading collection..." size="lg" />
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Collection Not Found</h1>
          <p className="text-gray-600 mb-6">The collection you're looking for doesn't exist or you don't have access to it.</p>
          <a 
            href="/collections" 
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Collections
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <ErrorBanner 
            message={error} 
            onClose={() => setError(null)} 
          />
        )}

        {/* Collection Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{collection.name}</h1>
              {collection.description && (
                <p className="text-gray-600 mb-4">{collection.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  collection.is_public 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {collection.is_public ? "Public" : "Private"}
                </span>
                <span className="flex items-center gap-1">
                  <span>📹</span>
                  <span>{videos.length} videos</span>
                </span>
              </div>
            </div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showAddForm ? "Cancel" : "Add Video"}
            </button>
          </div>

          {/* Add Video Form */}
          {showAddForm && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Video to Collection</h3>
              <form onSubmit={addVideoToCollection}>
                <div className="mb-4">
                  <label htmlFor="videoId" className="block text-sm font-medium text-gray-700 mb-2">
                    Video ID
                  </label>
                  <input
                    type="text"
                    id="videoId"
                    value={newVideoId}
                    onChange={(e) => setNewVideoId(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter video ID"
                    disabled={addingVideo}
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    type="submit" 
                    disabled={addingVideo || !newVideoId.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {addingVideo ? "Adding..." : "Add Video"}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setNewVideoId("")
                      setError(null)
                    }}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Videos Grid */}
        {videos.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📹</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Videos Yet</h3>
            <p className="text-gray-600 mb-6">Add videos to this collection to get started!</p>
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Your First Video
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div key={video.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {video.thumbnail_url ? (
                  <img 
                    src={video.thumbnail_url} 
                    alt={video.title}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-4xl">📹</span>
                  </div>
                )}
                
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {video.title}
                  </h3>
                  {video.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {video.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      video.is_public 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {video.is_public ? "Public" : "Private"}
                    </span>
                    <span>
                      {new Date(video.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => router.push(`/video/${video.id}`)}
                      className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                    >
                      View Video
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(video.id)}
                      className="bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200 transition-colors text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Remove Video</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to remove this video from the collection? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => removeVideoFromCollection(showDeleteConfirm)}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Remove Video
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Back Button */}
        <div className="mt-8 text-center">
          <a 
            href="/collections" 
            className="inline-block bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Collections
          </a>
        </div>
      </div>
    </div>
  )
}
