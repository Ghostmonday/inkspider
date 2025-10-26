"use client"

import { supabase } from "@/lib/supabaseClient"
import { useState } from "react"
import { useRouter } from "next/navigation"
import ErrorBanner from "@/components/ErrorBanner"
import LoadingSpinner from "@/components/LoadingSpinner"
import { validateEmail, validatePassword } from "@/utils/validation"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default function Register() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Validate inputs
    const emailValidation = validateEmail(email)
    const passwordValidation = validatePassword(password)
    
    if (!emailValidation.isValid || !passwordValidation.isValid) {
      setError([...emailValidation.errors, ...passwordValidation.errors].join(', '))
      return
    }
    
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase.from("user_profiles").insert({
          id: data.user.id,
          email: data.user.email,
        })
        
        if (profileError) {
          setError(`Error creating profile: ${profileError.message}`)
          setLoading(false)
          return
        }
        
        // Initialize user credits
        const { error: creditsError } = await supabase.from("user_credits").insert({
          user_id: data.user.id,
          credits: 0,
        })
        
        if (creditsError) {
          setError(`Error initializing credits: ${creditsError.message}`)
          setLoading(false)
          return
        }
        
        setSuccess(true)
        setTimeout(() => {
          router.push("/login")
        }, 2000)
      }
    } catch (err) {
      setError('An unexpected error occurred during registration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-gray-900">Register</h1>
        </div>
        
        {error && <ErrorBanner message={error} onClose={() => setError(null)} />}
        {success && <ErrorBanner message="Registration successful! Redirecting to login..." type="info" />}
        
        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              />
            </div>
          </div>
          
          <div>
            <button 
              type="submit" 
              disabled={loading || success}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <LoadingSpinner size="sm" /> : "Register"}
            </button>
          </div>
          
          <div className="text-center">
            <a href="/login" className="text-blue-600 hover:text-blue-800">
              Already have an account?
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
