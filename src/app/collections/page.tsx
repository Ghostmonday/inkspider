"use client"

import { supabase } from "@/lib/supabaseClient"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import ErrorBanner from "@/components/ErrorBanner"
import LoadingSpinner from "@/components/LoadingSpinner"
import { Collection, User } from "@/types"
import { validateText } from "@/utils/validation"

export default function Collections() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [newCollectionDescription, setNewCollectionDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push("/login")
          return
        }

        setUser(session.user)

        const { data: collectionsData, error } = await supabase
          .from("collections")
          .select(`
            *,
            collection_videos (
              video_id,
              videos (
                id,
                title,
                file_url,
                thumbnail_url
              )
            )
          `)
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error fetching collections:", error)
          setError("Failed to load collections")
        } else {
          setCollections(collectionsData || [])
        }
        setLoading(false)
      } catch (err) {
        console.error("Unexpected error:", err)
        setError("An unexpected error occurred while loading collections")
        setLoading(false)
      }
    }

    fetchCollections()
  }, [router])

  const createCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (creating || !user) return

    // Validate collection name
    const nameValidation = validateText(newCollectionName, "Collection name", 1, 100)
    if (!nameValidation.isValid) {
      setError(nameValidation.errors.join(', '))
      return
    }

    setCreating(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from("collections")
        .insert({
          name: newCollectionName.trim(),
          description: newCollectionDescription.trim() || "",
          user_id: user.id,
          is_public: false
        })
        .select()
        .single()

      if (error) {
        setError("Failed to create collection")
      } else {
        setCollections([data, ...collections])
        setNewCollectionName("")
        setNewCollectionDescription("")
        setShowCreateForm(false)
      }
    } catch (err) {
      console.error("Error creating collection:", err)
      setError("An unexpected error occurred while creating collection")
    } finally {
      setCreating(false)
    }
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const deleteCollection = async (collectionId: string) => {
    try {
      const { error } = await supabase
        .from("collections")
        .delete()
        .eq("id", collectionId)

      if (error) {
        setError("Failed to delete collection")
      } else {
        setCollections(collections.filter(c => c.id !== collectionId))
        setShowDeleteConfirm(null)
      }
    } catch (err) {
      console.error("Error deleting collection:", err)
      setError("An unexpected error occurred while deleting collection")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner message="Loading collections..." size="lg" />
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

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Collections</h1>
          <button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showCreateForm ? "Cancel" : "Create New Collection"}
          </button>
        </div>

        {/* Create Collection Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Collection</h2>
            <form onSubmit={createCollection}>
              <div className="mb-4">
                <label htmlFor="collectionName" className="block text-sm font-medium text-gray-700 mb-2">
                  Collection Name *
                </label>
                <input
                  type="text"
                  id="collectionName"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter collection name"
                  disabled={creating}
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="collectionDescription" className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  id="collectionDescription"
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Enter collection description"
                  disabled={creating}
                />
              </div>
              <div className="flex gap-3">
                <button 
                  type="submit" 
                  disabled={creating || !newCollectionName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? "Creating..." : "Create Collection"}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewCollectionName("")
                    setNewCollectionDescription("")
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

        {/* Collections Grid */}
        {collections.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📁</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Collections Yet</h3>
            <p className="text-gray-600 mb-6">Create your first collection to organize your videos!</p>
            <button 
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <div key={collection.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{collection.name}</h3>
                {collection.description && (
                  <p className="text-gray-600 mb-4 text-sm">{collection.description}</p>
                )}
                
                <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <span>📹</span>
                    <span>{collection.collection_videos?.length || 0} videos</span>
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    collection.is_public 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {collection.is_public ? "Public" : "Private"}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => router.push(`/collections/${collection.id}`)}
                    className="flex-1 bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                  >
                    View Collection
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(collection.id)}
                    className="bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200 transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Collection</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this collection? This action cannot be undone and will remove all videos from the collection.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => deleteCollection(showDeleteConfirm)}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Collection
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
