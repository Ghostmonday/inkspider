// Type definitions for SpiderInk.art

export interface User {
  id: string
  email?: string
  created_at?: string
}

export interface UserProfile {
  id: string
  email: string
  created_at?: string
}

export interface Video {
  id: string
  title: string
  description?: string
  file_url: string
  thumbnail_url?: string
  user_id: string
  is_public: boolean
  created_at: string
  updated_at?: string
  user_profiles?: UserProfile
}

export interface Comment {
  id: string
  video_id: string
  user_id: string
  comment: string
  created_at: string
  user_profiles?: UserProfile
}

export interface Like {
  id: string
  video_id: string
  user_id: string
  created_at?: string
}

export interface Tag {
  id: string
  video_id: string
  tag: string
}

export interface Collection {
  id: string
  name: string
  description?: string
  user_id: string
  is_public: boolean
  created_at: string
  updated_at?: string
  collection_videos?: CollectionVideo[]
}

export interface CollectionVideo {
  id: string
  collection_id: string
  video_id: string
  created_at?: string
  videos?: Video
}

export interface UserCredits {
  id: string
  user_id: string
  credits: number
  created_at?: string
  updated_at?: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  amount: number
  type: string
  video_id?: string
  created_at?: string
}

export interface FormState {
  [key: string]: string | number | boolean | File | null
}

export interface ErrorState {
  message: string
  type: 'error' | 'warning' | 'info'
}

export interface LoadingState {
  isLoading: boolean
  message?: string
}

// DirectorStudio Integration Types
export interface Project {
  id: string
  user_id: string
  film_title: string
  description?: string
  director_notes?: string
  directorstudio_version: string
  tokens_used: number
  continuity_score: number
  is_public: boolean
  is_boosted: boolean
  client_created_at?: string
  idempotency_key: string
  created_at: string
  updated_at?: string
}

export interface ScriptSegment {
  id: string
  project_id: string
  segment_order: number
  scene_description: string
  original_script_text: string
  duration: number
  created_at: string
}

export interface GenerationMetadata {
  id: string
  segment_id: string
  ai_provider: string
  prompt_used: string
  continuity_notes?: string
  generation_timestamp: string
  actual_tokens_consumed: number
  estimated_tokens: number
  created_at: string
}

export interface VoiceoverSession {
  id: string
  clip_id: string
  take_number: number
  timestamp_start: number
  timestamp_end: number
  audio_file_url?: string
  upload_status: 'pending' | 'uploading' | 'verified' | 'failed'
  created_at: string
}

export interface ProjectBoost {
  id: string
  project_id: string
  credits_spent: number
  boost_start: string
  boost_end: string
  impressions_gained: number
  created_at: string
}

export interface Transaction {
  id: string
  project_id: string
  external_tx_id: string
  tokens_debited: number
  price_cents: number
  payment_provider: string
  currency: string
  success: boolean
  client_created_at?: string
  created_at: string
}

export interface TransactionLedger {
  id: string
  transaction_id: string
  external_tx_id: string
  operation_type: 'debit' | 'credit' | 'refund'
  amount: number
  balance_after: number
  created_at: string
}

export interface ReconciliationIssue {
  id: string
  project_id: string
  discrepancy_percentage: number
  tokens_expected: number
  tokens_actual: number
  status: 'open' | 'investigating' | 'resolved'
  created_at: string
  resolved_at?: string
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

