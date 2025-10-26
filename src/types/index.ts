// DirectorStudio Type Definitions
// Complete type system for production ecosystem

// ============================================================================
// CORE PROJECT TYPES
// ============================================================================

export type UploadStatus = 'pending' | 'uploaded' | 'verified' | 'failed';

export type AIProvider = 'runway' | 'sora' | 'pika' | 'luma' | 'stable-diffusion' | 'other';

export type QualityTier = 'standard' | 'hd' | '4k' | 'premium';

export type PaymentProvider = 'stripe' | 'apple' | 'google' | 'crypto' | 'credits';

export type TransactionType = 'sale' | 'refund' | 'adjustment' | 'bonus';

export type UserRole = 'director' | 'producer' | 'editor' | 'crew' | 'viewer';

export interface Project {
  id: string;
  user_id: string;
  
  // Basic info
  title: string;
  film_title?: string;
  description?: string;
  
  // Production metadata
  total_duration?: number; // seconds
  continuity_score?: number; // 0-100
  tokens_used?: number;
  model_used?: string;
  directostudio_version?: string;
  
  // Director notes
  director_notes?: string;
  
  // Visibility
  is_public: boolean;
  
  // Idempotency for DirectorStudio exports
  idempotency_key?: string;
  
  // Timestamps
  client_created_at?: string;
  created_at: string;
  updated_at: string;
  
  // Computed/joined fields (not in DB)
  clips?: Clip[];
  script_segments?: ScriptSegment[];
  transactions?: Transaction[];
  user_profile?: UserProfile;
  view_count?: number;
  boost?: ProjectBoost;
  reconciliation_status?: 'reconciled' | 'mismatch';
}

export interface Clip {
  id: string;
  project_id: string;
  
  // Ordering
  order_index: number;
  
  // File references
  file_url: string;
  thumbnail_url?: string;
  
  // Metadata
  duration?: number; // seconds
  model_used?: string;
  actual_tokens_consumed?: number;
  
  // Upload tracking
  upload_status: UploadStatus;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Joined fields
  generation_metadata?: GenerationMetadata[];
  voiceover_sessions?: VoiceoverSession[];
}

export interface ScriptSegment {
  id: string;
  project_id: string;
  clip_id?: string | null;
  
  // Ordering
  segment_order: number;
  
  // Content
  scene_description?: string;
  original_script_text?: string;
  duration?: number; // expected duration in seconds
  
  // Timestamps
  created_at: string;
  
  // Joined fields
  clip?: Clip;
}

export interface GenerationMetadata {
  id: string;
  clip_id: string;
  
  // AI details
  ai_provider?: AIProvider;
  prompt_used?: string;
  continuity_notes?: string;
  generation_timestamp?: string;
  
  // Additional metadata
  model_version?: string;
  parameters?: Record<string, any>; // JSONB
  
  // Timestamps
  created_at: string;
}

export interface VoiceoverSession {
  id: string;
  clip_id: string;
  
  // Audio file
  audio_url: string;
  
  // Timing
  duration?: number; // seconds
  timestamp_start?: number; // ms offset in clip
  timestamp_end?: number; // ms offset in clip
  
  // Takes
  take_number: number;
  
  // Timestamps
  created_at: string;
}

// ============================================================================
// FINANCIAL TYPES
// ============================================================================

export interface Transaction {
  id: string;
  project_id?: string | null;
  user_id: string;
  
  // External reference
  external_tx_id?: string;
  
  // Amounts
  tokens_debited: number;
  price_cents?: number;
  currency: string;
  
  // Provider info
  payment_provider?: PaymentProvider;
  quality_tier?: QualityTier;
  
  // Status
  success: boolean;
  
  // Timestamps
  client_created_at?: string;
  created_at: string;
}

export interface TransactionLedgerEntry {
  id: string;
  transaction_id?: string | null;
  user_id: string;
  
  // Entry type
  type: TransactionType;
  
  // Amount
  amount_cents: number;
  
  // Notes
  notes?: string;
  
  // Timestamps (immutable)
  created_at: string;
}

export interface ReconciliationIssue {
  id: string;
  project_id: string;
  
  // Discrepancy details
  expected_tokens: number;
  actual_tokens: number;
  variance_percent: number;
  
  // Resolution
  resolved: boolean;
  resolved_at?: string | null;
  resolution_notes?: string;
  
  // Timestamps
  created_at: string;
}

export interface UserCredits {
  id: string;
  user_id: string;
  credits: number;
  boost_credits: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SOCIAL TYPES
// ============================================================================

export interface Follow {
  id: string;
  follower_id: string;
  followed_id: string;
  created_at: string;
  
  // Joined fields
  follower?: UserProfile;
  followed?: UserProfile;
}

export interface ProjectBoost {
  id: string;
  project_id: string;
  user_id: string;
  
  // Boost details
  credits_spent: number;
  boost_start: string;
  boost_end: string;
  
  // Analytics
  impressions_gained: number;
  
  // Timestamps
  created_at: string;
  
  // Computed
  is_active?: boolean;
}

export interface ProjectView {
  id: string;
  project_id: string;
  
  // Viewer info (nullable for anonymous)
  viewer_id?: string | null;
  ip_address?: string;
  user_agent?: string;
  
  // Timestamps
  viewed_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  username?: string | null;
  bio?: string;
  avatar_url?: string;
  is_director_verified: boolean;
  created_at: string;
  updated_at: string;
  
  // Computed stats
  project_count?: number;
  follower_count?: number;
  following_count?: number;
  total_views?: number;
}

// ============================================================================
// OPERATIONAL TYPES
// ============================================================================

export interface AuditLogEntry {
  id: string;
  
  // Request identification
  request_id?: string;
  idempotency_key?: string;
  
  // Endpoint info
  endpoint: string;
  method?: string;
  
  // Client info
  ip_address?: string;
  user_agent?: string;
  client_version?: string;
  user_id?: string | null;
  
  // Response
  response_code?: number;
  error_message?: string;
  
  // Timing
  duration_ms?: number;
  
  // Timestamps
  created_at: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface UploadPayload {
  project: {
    id: string;
    user_id: string;
    title: string;
    film_title?: string;
    description?: string;
    total_duration?: number;
    continuity_score?: number;
    tokens_used?: number;
    model_used?: string;
    directostudio_version?: string;
    client_created_at?: string;
    idempotency_key: string;
  };
  clips: {
    id: string;
    order_index: number;
    file_url: string;
    thumbnail_url?: string;
    duration?: number;
    model_used?: string;
    actual_tokens_consumed?: number;
  }[];
  script_segments?: {
    clip_id?: string;
    segment_order: number;
    scene_description?: string;
    original_script_text?: string;
    duration?: number;
  }[];
  generation_metadata?: {
    clip_id: string;
    ai_provider?: string;
    prompt_used?: string;
    continuity_notes?: string;
    generation_timestamp?: string;
  }[];
  voiceover_sessions?: {
    clip_id: string;
    audio_url: string;
    duration?: number;
    take_number?: number;
    timestamp_start?: number;
    timestamp_end?: number;
  }[];
  transactions?: {
    external_tx_id?: string;
    tokens_debited: number;
    price_cents?: number;
    payment_provider?: string;
    currency?: string;
    quality_tier?: string;
    success: boolean;
    client_created_at?: string;
  }[];
}

export interface UploadResponse {
  success: boolean;
  project_id?: string;
  project_url?: string;
  error?: string;
  errors?: string[];
}

export interface PresignRequest {
  filename: string;
  contentType: string;
  fileSize: number;
}

export interface PresignResponse {
  presignedUrl: string;
  filePath: string;
  expiresIn: number;
}

export interface UploadCompleteRequest {
  clipId: string;
  filePath: string;
  checksum?: string;
}

export interface UploadCompleteResponse {
  success: boolean;
  status: UploadStatus;
}

export interface BoostRequest {
  project_id: string;
  duration: '24h' | '7d';
}

export interface BoostResponse {
  success: boolean;
  boost: ProjectBoost;
  remaining_boost_credits: number;
}

export interface FollowRequest {
  followed_id: string;
}

export interface FollowResponse {
  success: boolean;
  follow?: Follow;
}

export interface ProjectsListQuery {
  user_id?: string;
  page?: number;
  limit?: number;
  filter?: 'trending' | 'recent' | 'boosted';
  model?: AIProvider;
}

export interface ProjectsListResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface ReconciliationResult {
  success: boolean;
  issues_found: number;
  issues: ReconciliationIssue[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PingResponse {
  version: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  challenge_response?: string;
}

// ============================================================================
// UI COMPONENT PROPS
// ============================================================================

export interface BoostModalProps {
  projectId: string;
  currentBoostCredits: number;
  onSuccess: (boost: ProjectBoost) => void;
  onClose: () => void;
}

export interface ProductionTimelineProps {
  project: Project;
  clips: Clip[];
  scriptSegments?: ScriptSegment[];
  onClipClick?: (clip: Clip) => void;
}

export interface ScriptViewerProps {
  scriptSegments: ScriptSegment[];
  onSegmentClick?: (segment: ScriptSegment) => void;
  highlightedSegmentId?: string;
}

export interface VoiceoverPlayerProps {
  voiceoverSessions: VoiceoverSession[];
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
}

export interface VideoPlayerProps {
  clip: Clip;
  autoplay?: boolean;
  controls?: boolean;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
}

export interface DirectorCardProps {
  profile: UserProfile;
  showFollowButton?: boolean;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
}

export interface ProjectCardProps {
  project: Project;
  showStats?: boolean;
  showActions?: boolean;
  variant?: 'viewer' | 'creator';
}

// ============================================================================
// FILTER & SEARCH TYPES
// ============================================================================

export interface ProjectFilters {
  model?: AIProvider;
  hasScript?: boolean;
  hasVoiceover?: boolean;
  minDuration?: number;
  maxDuration?: number;
  minContinuityScore?: number;
  sortBy?: 'recent' | 'views' | 'tokens' | 'continuity';
  isPublic?: boolean;
}

export interface SearchFilters extends ProjectFilters {
  query?: string;
  tags?: string[];
  director?: string;
}
