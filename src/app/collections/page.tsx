"use client"

import { supabase } from "@/lib/supabaseClient"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Collections() {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchCollections = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/login")
        return
      }

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
      } else {
        setCollections(collectionsData || [])
      }
      setLoading(false)
    }

    fetchCollections()
  }, [router])

  const createCollection = async () => {
    const name = prompt("Enter collection name:")
    if (!name) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from("collections")
      .insert({
        name,
        description: "",
        user_id: user.id,
        is_public: false
      })
      .select()
      .single()

    if (error) {
      alert("Error creating collection: " + error.message)
    } else {
      setCollections([data, ...collections])
    }
  }

  const deleteCollection = async (collectionId: string) => {
    if (!confirm("Are you sure you want to delete this collection?")) return

    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", collectionId)

    if (error) {
      alert("Error deleting collection: " + error.message)
    } else {
      setCollections(collections.filter(c => c.id !== collectionId))
    }
  }

  if (loading) {
    return <div>Loading collections...</div>
  }

  return (
    <div>
      <h1>My Collections</h1>
      <button onClick={createCollection}>Create New Collection</button>
      
      {collections.length === 0 ? (
        <p>No collections yet. Create your first collection!</p>
      ) : (
        <div>
          {collections.map((collection) => (
            <div key={collection.id}>
              <h3>{collection.name}</h3>
              <p>{collection.description}</p>
              <p>Videos: {collection.collection_videos?.length || 0}</p>
              <p>Public: {collection.is_public ? "Yes" : "No"}</p>
              <button onClick={() => router.push(`/collections/${collection.id}`)}>
                View Collection
              </button>
              <button onClick={() => deleteCollection(collection.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      
      <a href="/dashboard">Back to Dashboard</a>
    </div>
  )
}
