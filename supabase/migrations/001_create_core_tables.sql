-- DirectorStudio Core Tables Migration
-- Phase 1: Database Foundation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE PROJECT DATA
-- ============================================================================

-- Projects table (enhanced from videos)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  title TEXT NOT NULL,
  film_title TEXT,
  description TEXT,
  
  -- Production metadata
  total_duration INTEGER, -- seconds
  continuity_score DECIMAL(5,2), -- 0-100
  tokens_used INTEGER DEFAULT 0,
  model_used TEXT, -- 'runway', 'sora', 'pika', etc.
  directostudio_version TEXT,
  
  -- Director notes
  director_notes TEXT,
  
  -- Visibility
  is_public BOOLEAN DEFAULT false,
  
  -- Idempotency for DirectorStudio exports
  idempotency_key TEXT UNIQUE,
  
  -- Client timestamp for sync
  client_created_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clips table (video segments)
CREATE TABLE IF NOT EXISTS clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Ordering
  order_index INTEGER NOT NULL,
  
  -- File references
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Metadata
  duration INTEGER, -- seconds
  model_used TEXT,
  actual_tokens_consumed INTEGER,
  
  -- Upload tracking
  upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'verified', 'failed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure clips are ordered within a project
  UNIQUE(project_id, order_index)
);

-- Script segments (scene breakdown)
CREATE TABLE IF NOT EXISTS script_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clip_id UUID REFERENCES clips(id) ON DELETE SET NULL, -- nullable: can exist before clip
  
  -- Ordering
  segment_order INTEGER NOT NULL,
  
  -- Content
  scene_description TEXT,
  original_script_text TEXT,
  duration INTEGER, -- expected duration in seconds
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure segments are ordered within a project
  UNIQUE(project_id, segment_order)
);

-- Generation metadata (AI provenance)
CREATE TABLE IF NOT EXISTS generation_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  
  -- AI details
  ai_provider TEXT, -- 'runway', 'sora', 'pika', 'luma', etc.
  prompt_used TEXT,
  continuity_notes TEXT,
  generation_timestamp TIMESTAMPTZ,
  
  -- Additional metadata
  model_version TEXT,
  parameters JSONB, -- store generation settings
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voiceover sessions (audio tracks)
CREATE TABLE IF NOT EXISTS voiceover_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clip_id UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  
  -- Audio file
  audio_url TEXT NOT NULL,
  
  -- Timing
  duration INTEGER, -- seconds
  timestamp_start INTEGER, -- ms offset in clip
  timestamp_end INTEGER, -- ms offset in clip
  
  -- Takes
  take_number INTEGER DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FINANCIAL & CREDITS
-- ============================================================================

-- Transactions (payment records)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- External reference
  external_tx_id TEXT UNIQUE, -- from payment provider
  
  -- Amounts
  tokens_debited INTEGER NOT NULL,
  price_cents INTEGER,
  currency TEXT DEFAULT 'USD',
  
  -- Provider info
  payment_provider TEXT, -- 'stripe', 'apple', 'google', etc.
  quality_tier TEXT, -- 'standard', 'hd', '4k'
  
  -- Status
  success BOOLEAN DEFAULT true,
  
  -- Client timestamp
  client_created_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions ledger (immutable audit log)
CREATE TABLE IF NOT EXISTS transactions_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Entry type
  type TEXT NOT NULL CHECK (type IN ('sale', 'refund', 'adjustment', 'bonus')),
  
  -- Amount
  amount_cents INTEGER NOT NULL,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps (immutable)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reconciliation issues (mismatch tracking)
CREATE TABLE IF NOT EXISTS reconciliation_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Discrepancy details
  expected_tokens INTEGER NOT NULL,
  actual_tokens INTEGER NOT NULL,
  variance_percent DECIMAL(5,2),
  
  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update user_credits to add boost_credits
-- Assuming user_credits table exists from original schema
ALTER TABLE IF EXISTS user_credits 
  ADD COLUMN IF NOT EXISTS boost_credits INTEGER DEFAULT 0;

-- ============================================================================
-- SOCIAL & DISCOVERY
-- ============================================================================

-- Follows (social graph)
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Prevent self-follows and duplicates
  CHECK (follower_id != followed_id),
  UNIQUE(follower_id, followed_id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project boosts (promotional credits)
CREATE TABLE IF NOT EXISTS project_boosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Boost details
  credits_spent INTEGER NOT NULL,
  boost_start TIMESTAMPTZ DEFAULT NOW(),
  boost_end TIMESTAMPTZ NOT NULL,
  
  -- Analytics
  impressions_gained INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project views (analytics)
CREATE TABLE IF NOT EXISTS project_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Viewer info (nullable for anonymous)
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  
  -- User agent for analytics
  user_agent TEXT,
  
  -- Timestamps
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update user_profiles to add director fields
-- Assuming user_profiles table exists from original schema
ALTER TABLE IF EXISTS user_profiles 
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_director_verified BOOLEAN DEFAULT false;

-- ============================================================================
-- OPERATIONAL
-- ============================================================================

-- Audit log (request tracking with 90-day retention)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Request identification
  request_id TEXT,
  idempotency_key TEXT,
  
  -- Endpoint info
  endpoint TEXT NOT NULL,
  method TEXT,
  
  -- Client info
  ip_address INET,
  user_agent TEXT,
  client_version TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Response
  response_code INTEGER,
  error_message TEXT,
  
  -- Timing
  duration_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_idempotency_key ON projects(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_is_public ON projects(is_public) WHERE is_public = true;

-- Clips indexes
CREATE INDEX IF NOT EXISTS idx_clips_project_id ON clips(project_id);
CREATE INDEX IF NOT EXISTS idx_clips_project_order ON clips(project_id, order_index);

-- Script segments indexes
CREATE INDEX IF NOT EXISTS idx_script_segments_project_id ON script_segments(project_id);
CREATE INDEX IF NOT EXISTS idx_script_segments_clip_id ON script_segments(clip_id) WHERE clip_id IS NOT NULL;

-- Generation metadata indexes
CREATE INDEX IF NOT EXISTS idx_generation_metadata_clip_id ON generation_metadata(clip_id);

-- Voiceover sessions indexes
CREATE INDEX IF NOT EXISTS idx_voiceover_sessions_clip_id ON voiceover_sessions(clip_id);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_external_tx_id ON transactions(external_tx_id) WHERE external_tx_id IS NOT NULL;

-- Follows indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followed_id ON follows(followed_id);

-- Project boosts indexes (for active boosts)
CREATE INDEX IF NOT EXISTS idx_project_boosts_active ON project_boosts(boost_start, boost_end) WHERE boost_end > NOW();
CREATE INDEX IF NOT EXISTS idx_project_boosts_project_id ON project_boosts(project_id);

-- Project views indexes
CREATE INDEX IF NOT EXISTS idx_project_views_project_id ON project_views(project_id);
CREATE INDEX IF NOT EXISTS idx_project_views_viewed_at ON project_views(viewed_at DESC);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_endpoint ON audit_log(endpoint);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clips_updated_at BEFORE UPDATE ON clips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE voiceover_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_views ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can read public projects"
  ON projects FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Clips policies (inherit from project ownership)
CREATE POLICY "Users can read clips of accessible projects"
  ON clips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = clips.project_id 
      AND (projects.is_public = true OR projects.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert clips for their projects"
  ON clips FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = clips.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update clips of their projects"
  ON clips FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = clips.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete clips of their projects"
  ON clips FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = clips.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Similar policies for script_segments, generation_metadata, voiceover_sessions
-- (inherit project ownership)

CREATE POLICY "Users can read script_segments of accessible projects"
  ON script_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = script_segments.project_id 
      AND (projects.is_public = true OR projects.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert script_segments for their projects"
  ON script_segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = script_segments.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Follows policies
CREATE POLICY "Users can read all follows"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Users can create follows as follower"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Project boosts policies
CREATE POLICY "Users can read boosts for accessible projects"
  ON project_boosts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_boosts.project_id 
      AND (projects.is_public = true OR projects.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can boost their own projects"
  ON project_boosts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Project views policies (read only, anyone can insert)
CREATE POLICY "Anyone can read project views counts"
  ON project_views FOR SELECT
  USING (true);

CREATE POLICY "Anyone can log project views"
  ON project_views FOR INSERT
  WITH CHECK (true);

-- Transactions policies (users see their own only)
CREATE POLICY "Users can read their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE projects IS 'Main project/film records with production metadata';
COMMENT ON TABLE clips IS 'Video segments that compose a project';
COMMENT ON TABLE script_segments IS 'Scene breakdown and script text';
COMMENT ON TABLE generation_metadata IS 'AI generation provenance per clip';
COMMENT ON TABLE voiceover_sessions IS 'Audio tracks and voiceover takes';
COMMENT ON TABLE transactions IS 'Payment and credit transaction records';
COMMENT ON TABLE project_boosts IS 'Promotional boosts for increased visibility';
COMMENT ON TABLE follows IS 'Social follow relationships between users';
COMMENT ON TABLE project_views IS 'Analytics tracking for project views';
COMMENT ON TABLE audit_log IS 'Request audit trail with 90-day retention';

