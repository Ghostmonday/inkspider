"use client"

import { supabase } from "@/lib/supabaseClient"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Upload() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    
    // Check user credits
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("Please login first")
      router.push("/login")
      return
    }

    const { data: creditsData } = await supabase
      .from("user_credits")
      .select("credits")
      .eq("user_id", user.id)
      .single()

    if (!creditsData || creditsData.credits < 1) {
      alert("Insufficient credits")
      setLoading(false)
      return
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split(".").pop()
    const fileName = `${Math.random()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from("videos")
      .upload(fileName, file)

    if (uploadError) {
      alert("Upload failed: " + uploadError.message)
      setLoading(false)
      return
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("videos")
      .getPublicUrl(fileName)

    // Insert video metadata
    const { data: videoData, error: videoError } = await supabase
      .from("videos")
      .insert({
        title,
        description,
        file_url: urlData.publicUrl,
        user_id: user.id,
        is_public: isPublic,
      })
      .select()
      .single()

    if (videoError) {
      alert("Error saving video metadata: " + videoError.message)
      setLoading(false)
      return
    }

    // Insert tags
    if (tags) {
      const tagArray = tags.split(",").map(tag => tag.trim())
      for (const tag of tagArray) {
        await supabase.from("video_tags").insert({
          video_id: videoData.id,
          tag,
        })
      }
    }

    // Deduct credit
    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: -1,
      type: "video_upload",
      video_id: videoData.id,
    })

    await supabase
      .from("user_credits")
      .update({ credits: creditsData.credits - 1 })
      .eq("user_id", user.id)

    alert("Video uploaded successfully!")
    router.push("/dashboard")
    setLoading(false)
  }

  return (
    <div>
      <h1>Upload Video</h1>
      <form onSubmit={handleUpload}>
        <input
          type="file"
          accept=".mp4"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          required
        />
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          type="text"
          placeholder="Tags (comma-separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Public
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>
    </div>
  )
}
