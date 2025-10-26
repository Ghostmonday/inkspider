// Validation utilities

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

// Email validation
export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = []
  
  if (!email || email.trim() === '') {
    errors.push('Email is required')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please enter a valid email address')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Password validation
export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = []
  
  if (!password || password.trim() === '') {
    errors.push('Password is required')
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// File validation
export const validateVideoFile = (file: File | null): ValidationResult => {
  const errors: string[] = []
  
  if (!file) {
    errors.push('Please select a video file')
    return { isValid: false, errors }
  }
  
  // Check file extension
  const validExtensions = ['.mp4', '.webm', '.mov', '.avi']
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
  
  if (!validExtensions.includes(fileExtension)) {
    errors.push(`Invalid file type. Allowed formats: ${validExtensions.join(', ')}`)
  }
  
  // Check file size (e.g., max 500MB)
  const maxSize = 500 * 1024 * 1024 // 500MB in bytes
  if (file.size > maxSize) {
    errors.push('File size exceeds maximum limit of 500MB')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Text validation
export const validateText = (text: string, fieldName: string, minLength = 1, maxLength = 1000): ValidationResult => {
  const errors: string[] = []
  
  if (!text || text.trim() === '') {
    errors.push(`${fieldName} is required`)
  } else if (text.trim().length < minLength) {
    errors.push(`${fieldName} must be at least ${minLength} characters long`)
  } else if (text.trim().length > maxLength) {
    errors.push(`${fieldName} must not exceed ${maxLength} characters`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Tag validation
export const validateTags = (tags: string): ValidationResult => {
  const errors: string[] = []
  
  if (tags.trim() === '') {
    return { isValid: true, errors: [] }
  }
  
  const tagArray = tags.split(',').map(tag => tag.trim())
  
  if (tagArray.length > 10) {
    errors.push('Maximum 10 tags allowed')
  }
  
  const invalidTags = tagArray.filter(tag => tag.length === 0 || tag.length > 30)
  if (invalidTags.length > 0) {
    errors.push('Each tag must be between 1 and 30 characters')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// UUID validation
export const validateUUID = (uuid: string): ValidationResult => {
  const errors: string[] = []
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  if (!uuid || uuid.trim() === '') {
    errors.push('ID is required')
  } else if (!uuidRegex.test(uuid)) {
    errors.push('Invalid ID format')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

