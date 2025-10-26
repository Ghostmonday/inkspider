"use client"

import { useEffect, useState } from "react"

interface ErrorBannerProps {
  message: string
  type?: 'error' | 'warning' | 'info'
  onClose?: () => void
  autoClose?: boolean
  duration?: number
}

export default function ErrorBanner({ 
  message, 
  type = 'error',
  onClose,
  autoClose = true,
  duration = 5000
}: ErrorBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoClose && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [autoClose, duration, isVisible, onClose])

  if (!isVisible) return null

  const bgColor = {
    error: 'bg-red-100 border-red-400 text-red-700',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700'
  }[type]

  return (
    <div className={`border ${bgColor} px-4 py-3 rounded relative mb-4`} role="alert">
      <span className="block sm:inline">{message}</span>
      {onClose && (
        <span className="absolute top-0 bottom-0 right-0 py-3 px-4">
          <button
            onClick={() => {
              setIsVisible(false)
              onClose()
            }}
            className="font-bold text-lg leading-none"
          >
            ×
          </button>
        </span>
      )}
    </div>
  )
}

