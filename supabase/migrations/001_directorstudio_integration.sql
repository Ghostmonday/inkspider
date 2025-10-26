-- DirectorStudio Integration Database Migrations
-- Run these migrations in order to set up the DirectorStudio integration

-- 1. Create projects table (extends existing videos concept)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    film_title TEXT NOT NULL,
    description TEXT,
    director_notes TEXT,
    directorstudio_version TEXT DEFAULT '1.0.0',
    tokens_used INTEGER DEFAULT 0,
    continuity_score DECIMAL(3,2) DEFAULT 0.00,
    is_public BOOLEAN DEFAULT true,
    is_boosted BOOLEAN DEFAULT false,
    client_created_at TIMESTAMP WITH TIME ZONE,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create script_segments table
CREATE TABLE IF NOT EXISTS script_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    segment_order INTEGER NOT NULL,
    scene_description TEXT NOT NULL,
    original_script_text TEXT NOT NULL,
    duration DECIMAL(8,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create generation_metadata table
CREATE TABLE IF NOT EXISTS generation_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID NOT NULL REFERENCES script_segments(id) ON DELETE CASCADE,
    ai_provider TEXT NOT NULL,
    prompt_used TEXT NOT NULL,
    continuity_notes TEXT,
    generation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    actual_tokens_consumed INTEGER DEFAULT 0,
    estimated_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create voiceover_sessions table
CREATE TABLE IF NOT EXISTS voiceover_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID NOT NULL REFERENCES generation_metadata(id) ON DELETE CASCADE,
    take_number INTEGER DEFAULT 1,
    timestamp_start DECIMAL(8,2) DEFAULT 0.00,
    timestamp_end DECIMAL(8,2) DEFAULT 0.00,
    audio_file_url TEXT,
    upload_status TEXT DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'verified', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create project_boosts table
CREATE TABLE IF NOT EXISTS project_boosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    credits_spent INTEGER NOT NULL,
    boost_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    boost_end TIMESTAMP WITH TIME ZONE NOT NULL,
    impressions_gained INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    external_tx_id TEXT UNIQUE NOT NULL,
    tokens_debited INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    payment_provider TEXT NOT NULL,
    currency TEXT DEFAULT 'USD',
    success BOOLEAN DEFAULT true,
    client_created_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create transactions_ledger table (immutable audit log)
CREATE TABLE IF NOT EXISTS transactions_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    external_tx_id TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('debit', 'credit', 'refund')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create reconciliation_issues table
CREATE TABLE IF NOT EXISTS reconciliation_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    discrepancy_percentage DECIMAL(5,2) NOT NULL,
    tokens_expected INTEGER NOT NULL,
    tokens_actual INTEGER NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 9. Update user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_director_verified BOOLEAN DEFAULT false;

-- 10. Update user_credits table
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS boost_credits INTEGER DEFAULT 0;

-- 11. Create follows table
CREATE TABLE IF NOT EXISTS follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- 12. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
CREATE INDEX IF NOT EXISTS idx_projects_is_boosted ON projects(is_boosted);
CREATE INDEX IF NOT EXISTS idx_script_segments_project_id ON script_segments(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_metadata_segment_id ON generation_metadata(segment_id);
CREATE INDEX IF NOT EXISTS idx_voiceover_sessions_clip_id ON voiceover_sessions(clip_id);
CREATE INDEX IF NOT EXISTS idx_project_boosts_project_id ON project_boosts(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_external_tx_id ON transactions(external_tx_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- 13. Create RLS policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE voiceover_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view public projects" ON projects FOR SELECT USING (is_public = true);
CREATE POLICY "Users can view their own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);

-- Script segments policies
CREATE POLICY "Users can view script segments of public projects" ON script_segments FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND is_public = true)
);
CREATE POLICY "Users can view script segments of their own projects" ON script_segments FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
);

-- Generation metadata policies
CREATE POLICY "Users can view generation metadata of public projects" ON generation_metadata FOR SELECT USING (
    EXISTS (SELECT 1 FROM script_segments s JOIN projects p ON s.project_id = p.id WHERE s.id = segment_id AND p.is_public = true)
);
CREATE POLICY "Users can view generation metadata of their own projects" ON generation_metadata FOR SELECT USING (
    EXISTS (SELECT 1 FROM script_segments s JOIN projects p ON s.project_id = p.id WHERE s.id = segment_id AND p.user_id = auth.uid())
);

-- Voiceover sessions policies
CREATE POLICY "Users can view voiceover sessions of public projects" ON voiceover_sessions FOR SELECT USING (
    EXISTS (SELECT 1 FROM generation_metadata gm 
             JOIN script_segments s ON gm.segment_id = s.id 
             JOIN projects p ON s.project_id = p.id 
             WHERE gm.id = clip_id AND p.is_public = true)
);

-- Project boosts policies
CREATE POLICY "Users can view boosts of public projects" ON project_boosts FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND is_public = true)
);
CREATE POLICY "Users can create boosts for their own projects" ON project_boosts FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
);

-- Transactions policies
CREATE POLICY "Users can view transactions of their own projects" ON transactions FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid())
);

-- Follows policies
CREATE POLICY "Users can view all follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can create follows" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can delete their own follows" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- 14. Create functions for reconciliation
CREATE OR REPLACE FUNCTION reconcile_project_tokens(project_uuid UUID)
RETURNS TABLE(
    project_id UUID,
    tokens_expected INTEGER,
    tokens_actual INTEGER,
    discrepancy_percentage DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH token_calculations AS (
        SELECT 
            p.id as project_id,
            COALESCE(SUM(t.tokens_debited), 0) as tokens_expected,
            COALESCE(SUM(gm.actual_tokens_consumed), SUM(gm.estimated_tokens), 0) as tokens_actual
        FROM projects p
        LEFT JOIN transactions t ON p.id = t.project_id AND t.success = true
        LEFT JOIN script_segments s ON p.id = s.project_id
        LEFT JOIN generation_metadata gm ON s.id = gm.segment_id
        WHERE p.id = project_uuid
        GROUP BY p.id
    )
    SELECT 
        tc.project_id,
        tc.tokens_expected,
        tc.tokens_actual,
        CASE 
            WHEN tc.tokens_expected = 0 AND tc.tokens_actual = 0 THEN 0.00
            WHEN tc.tokens_expected = 0 THEN 100.00
            ELSE ABS(tc.tokens_expected - tc.tokens_actual)::DECIMAL / GREATEST(tc.tokens_expected, 1) * 100
        END as discrepancy_percentage
    FROM token_calculations tc;
END;
$$ LANGUAGE plpgsql;

-- 15. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration complete
SELECT 'DirectorStudio integration database setup complete' as status;

