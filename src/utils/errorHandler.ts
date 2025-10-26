// Error handling utilities

export interface ErrorResponse {
  message: string
  type: 'error' | 'warning' | 'info'
  code?: string
}

export const handleError = (error: unknown, context?: string): ErrorResponse => {
  console.error(`Error${context ? ` in ${context}` : ''}:`, error)
  
  if (error instanceof Error) {
    return {
      message: error.message,
      type: 'error',
      code: (error as any).code
    }
  }
  
  if (typeof error === 'string') {
    return {
      message: error,
      type: 'error'
    }
  }
  
  return {
    message: 'An unexpected error occurred',
    type: 'error'
  }
}

export const handleSupabaseError = (error: any, operation: string): ErrorResponse => {
  console.error(`Supabase ${operation} error:`, error)
  
  if (error?.message) {
    return {
      message: error.message,
      type: 'error',
      code: error.code
    }
  }
  
  return {
    message: `An error occurred during ${operation}`,
    type: 'error'
  }
}

export const handleNetworkError = (): ErrorResponse => {
  return {
    message: 'Network error. Please check your connection and try again.',
    type: 'error'
  }
}

export const handleAuthError = (): ErrorResponse => {
  return {
    message: 'Authentication required. Please log in.',
    type: 'warning'
  }
}

export const handleValidationError = (errors: string[]): ErrorResponse => {
  return {
    message: errors.join(', '),
    type: 'error'
  }
}

