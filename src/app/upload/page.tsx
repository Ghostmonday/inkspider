"use client"

import { supabase } from "@/lib/supabaseClient"
import { useState } from "react"
import { useRouter } from "next/navigation"
import ErrorBanner from "@/components/ErrorBanner"
import LoadingSpinner from "@/components/LoadingSpinner"
import { validateVideoFile, validateText, validateTags } from "@/utils/validation"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function Upload() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Validate file
    const fileValidation = validateVideoFile(file)
    if (!fileValidation.isValid) {
      setError(fileValidation.errors.join(', '))
      return
    }
    
    // Validate title
    const titleValidation = validateText(title, 'Title', 1, 200)
    if (!titleValidation.isValid) {
      setError(titleValidation.errors.join(', '))
      return
    }
    
    // Validate tags if provided
    if (tags) {
      const tagsValidation = validateTags(tags)
      if (!tagsValidation.isValid) {
        setError(tagsValidation.errors.join(', '))
        return
      }
    }

    setLoading(true)
    
    try {
      // Check user authentication
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Please login first")
        setTimeout(() => router.push("/login"), 2000)
        return
      }

      // Check user credits
      const { data: creditsData } = await supabase
        .from("user_credits")
        .select("credits")
        .eq("user_id", user.id)
        .single()

      if (!creditsData || creditsData.credits < 1) {
        setError("Insufficient credits")
        setLoading(false)
        return
      }

      // Upload file to Supabase Storage
      const fileExt = file!.name.split(".").pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, file!)

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`)
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
        setError(`Error saving video metadata: ${videoError.message}`)
        setLoading(false)
        return
      }

      // Insert tags
      if (tags) {
        const tagArray = tags.split(",").map(tag => tag.trim()).filter(Boolean)
        for (const tag of tagArray) {
          await supabase.from("video_tags").insert({
            video_id: videoData.id,
            tag,
          })
        }
      }

      // Deduct credit (transaction record)
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        amount: -1,
        type: "video_upload",
        video_id: videoData.id,
      })

      // Update credits
      await supabase
        .from("user_credits")
        .update({ credits: creditsData.credits - 1 })
        .eq("user_id", user.id)

      // Success - redirect to dashboard
      router.push("/dashboard")
    } catch (err) {
      setError('An unexpected error occurred during upload')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Upload Video</h1>
        
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
        
        <form onSubmit={handleUpload} className="bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Video File
            </label>
            <input
              type="file"
              accept=".mp4,.webm,.mov,.avi"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-1">Max size: 500MB. Formats: MP4, WebM, MOV, AVI</p>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Enter video title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Description
            </label>
            <textarea
              placeholder="Enter video description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tags
            </label>
            <input
              type="text"
              placeholder="Comma-separated tags (max 10)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            />
            <p className="text-xs text-gray-500 mt-1">Example: art, animation, tutorial</p>
          </div>
          
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-700 text-sm font-bold">Make this video public</span>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <LoadingSpinner size="sm" /> : "Upload Video"}
            </button>
            <a href="/dashboard" className="text-gray-600 hover:text-gray-800">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
