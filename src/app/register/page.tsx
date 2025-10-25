"use client"

import { supabase } from "@/lib/supabaseClient"

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Register() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else if (data.user) {
      await supabase.from("user_profiles").insert({
        id: data.user.id,
        email: data.user.email,
      })
      
      await supabase.from("user_credits").insert({
        user_id: data.user.id,
        credits: 0,
      })
      
      alert("Registration successful!")
      router.push("/login")
    }
    setLoading(false)
  }

  return (
    <div>
      <h1>Register</h1>
      <form onSubmit={handleRegister}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Loading..." : "Register"}
        </button>
      </form>
      <a href="/login">Already have an account?</a>
    </div>
  )
}
