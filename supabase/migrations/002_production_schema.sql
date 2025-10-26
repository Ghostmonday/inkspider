-- Production Database Migration Script for SpiderInk.art
-- This script sets up the complete database schema for DirectorStudio integration

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE boost_duration AS ENUM ('24h', '7d');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE reconciliation_status AS ENUM ('pending', 'resolved', 'investigating');

-- ==============================================
-- CORE USER TABLES
-- ==============================================

-- Enhanced user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    bio TEXT,
    avatar_url TEXT,
    is_director_verified BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User credits for boost system
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    boost_credits INTEGER DEFAULT 100,
    total_earned INTEGER DEFAULT 0,
    total_spent INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ==============================================
-- DIRECTORSTUDIO INTEGRATION TABLES
-- ==============================================

-- Projects table for AI-generated videos
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    film_title TEXT NOT NULL,
    description TEXT,
    director_notes TEXT,
    directorstudio_version TEXT DEFAULT '1.0.0',
    tokens_used INTEGER DEFAULT 0,
    continuity_score DECIMAL(3,2) DEFAULT 0.00,
    is_public BOOLEAN DEFAULT TRUE,
    is_boosted BOOLEAN DEFAULT FALSE,
    client_created_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Script segments for project breakdown
CREATE TABLE IF NOT EXISTS script_segments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    segment_order INTEGER NOT NULL,
    scene_description TEXT NOT NULL,
    original_script_text TEXT,
    duration DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generation metadata for AI tracking
CREATE TABLE IF NOT EXISTS generation_metadata (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    segment_id UUID REFERENCES script_segments(id) ON DELETE CASCADE,
    ai_provider TEXT NOT NULL,
    prompt_used TEXT NOT NULL,
    continuity_notes TEXT,
    actual_tokens_consumed INTEGER DEFAULT 0,
    estimated_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voiceover sessions for audio tracks
CREATE TABLE IF NOT EXISTS voiceover_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    clip_id UUID NOT NULL, -- References to external clip IDs
    take_number INTEGER DEFAULT 1,
    timestamp_start DECIMAL(8,3) DEFAULT 0.000,
    timestamp_end DECIMAL(8,3) DEFAULT 0.000,
    audio_file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- BOOST SYSTEM TABLES
-- ==============================================

-- Project boosts for promotion
CREATE TABLE IF NOT EXISTS project_boosts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    duration boost_duration NOT NULL,
    credits_spent INTEGER NOT NULL,
    boost_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    boost_end TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- TRANSACTION SYSTEM TABLES
-- ==============================================

-- Payment transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    external_tx_id TEXT UNIQUE NOT NULL,
    tokens_debited INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    payment_provider TEXT NOT NULL,
    currency TEXT DEFAULT 'USD',
    success BOOLEAN DEFAULT FALSE,
    status transaction_status DEFAULT 'pending',
    client_created_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Immutable transaction ledger for audit
CREATE TABLE IF NOT EXISTS transactions_ledger (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES user_profiles(id)
);

-- ==============================================
-- RECONCILIATION SYSTEM TABLES
-- ==============================================

-- Reconciliation issues for token accounting
CREATE TABLE IF NOT EXISTS reconciliation_issues (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    tokens_expected INTEGER NOT NULL,
    tokens_actual INTEGER NOT NULL,
    discrepancy_percentage DECIMAL(5,2) NOT NULL,
    status reconciliation_status DEFAULT 'pending',
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES user_profiles(id)
);

-- ==============================================
-- LEGACY VIDEO SYSTEM TABLES
-- ==============================================

-- Videos table (legacy support)
CREATE TABLE IF NOT EXISTS videos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video comments
CREATE TABLE IF NOT EXISTS video_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video likes
CREATE TABLE IF NOT EXISTS video_likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(video_id, user_id)
);

-- Collections system
CREATE TABLE IF NOT EXISTS collections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collection videos junction table
CREATE TABLE IF NOT EXISTS collection_videos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(collection_id, video_id)
);

-- User follows system
CREATE TABLE IF NOT EXISTS follows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    follower_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_public ON projects(is_public);
CREATE INDEX IF NOT EXISTS idx_projects_boosted ON projects(is_boosted);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_continuity_score ON projects(continuity_score DESC);

-- Script segments indexes
CREATE INDEX IF NOT EXISTS idx_script_segments_project_id ON script_segments(project_id);
CREATE INDEX IF NOT EXISTS idx_script_segments_order ON script_segments(project_id, segment_order);

-- Generation metadata indexes
CREATE INDEX IF NOT EXISTS idx_generation_metadata_segment_id ON generation_metadata(segment_id);
CREATE INDEX IF NOT EXISTS idx_generation_metadata_provider ON generation_metadata(ai_provider);

-- Boost system indexes
CREATE INDEX IF NOT EXISTS idx_project_boosts_project_id ON project_boosts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_boosts_active ON project_boosts(is_active);
CREATE INDEX IF NOT EXISTS idx_project_boosts_end ON project_boosts(boost_end);

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_tx_id);
CREATE INDEX IF NOT EXISTS idx_transactions_success ON transactions(success);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Reconciliation indexes
CREATE INDEX IF NOT EXISTS idx_reconciliation_issues_project_id ON reconciliation_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_issues_status ON reconciliation_issues(status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_issues_created_at ON reconciliation_issues(created_at DESC);

-- Legacy video indexes
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_public ON videos(is_public);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);

-- Collection indexes
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_videos_collection_id ON collection_videos(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_videos_video_id ON collection_videos(video_id);

-- ==============================================
-- ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE voiceover_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable by everyone" ON user_profiles
    FOR SELECT USING (true);

-- Projects policies
CREATE POLICY "Public projects are viewable by everyone" ON projects
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own projects" ON projects
    FOR ALL USING (auth.uid() = user_id);

-- Script segments policies
CREATE POLICY "Script segments are viewable with projects" ON script_segments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = script_segments.project_id 
            AND (projects.is_public = true OR projects.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage segments for own projects" ON script_segments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = script_segments.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Generation metadata policies
CREATE POLICY "Generation metadata is viewable with projects" ON generation_metadata
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM script_segments 
            JOIN projects ON projects.id = script_segments.project_id
            WHERE script_segments.id = generation_metadata.segment_id 
            AND (projects.is_public = true OR projects.user_id = auth.uid())
        )
    );

-- Project boosts policies
CREATE POLICY "Project boosts are viewable with projects" ON project_boosts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_boosts.project_id 
            AND (projects.is_public = true OR projects.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can create boosts for own projects" ON project_boosts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = project_boosts.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects 
            WHERE projects.id = transactions.project_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage transactions" ON transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Videos policies (legacy)
CREATE POLICY "Public videos are viewable by everyone" ON videos
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view own videos" ON videos
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own videos" ON videos
    FOR ALL USING (auth.uid() = user_id);

-- Collections policies
CREATE POLICY "Users can view own collections" ON collections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own collections" ON collections
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public collections are viewable by everyone" ON collections
    FOR SELECT USING (is_public = true);

-- Collection videos policies
CREATE POLICY "Collection videos are viewable with collections" ON collection_videos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM collections 
            WHERE collections.id = collection_videos.collection_id 
            AND (collections.is_public = true OR collections.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage videos in own collections" ON collection_videos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM collections 
            WHERE collections.id = collection_videos.collection_id 
            AND collections.user_id = auth.uid()
        )
    );

-- Video comments policies
CREATE POLICY "Comments are viewable with videos" ON video_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM videos 
            WHERE videos.id = video_comments.video_id 
            AND videos.is_public = true
        )
    );

CREATE POLICY "Users can manage own comments" ON video_comments
    FOR ALL USING (auth.uid() = user_id);

-- Video likes policies
CREATE POLICY "Likes are viewable with videos" ON video_likes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM videos 
            WHERE videos.id = video_likes.video_id 
            AND videos.is_public = true
        )
    );

CREATE POLICY "Users can manage own likes" ON video_likes
    FOR ALL USING (auth.uid() = user_id);

-- Follows policies
CREATE POLICY "Users can view follows" ON follows
    FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Users can manage own follows" ON follows
    FOR ALL USING (auth.uid() = follower_id);

-- ==============================================
-- FUNCTIONS AND TRIGGERS
-- ==============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON user_credits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_script_segments_updated_at BEFORE UPDATE ON script_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email)
    VALUES (NEW.id, NEW.email);
    
    INSERT INTO public.user_credits (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to log transaction changes
CREATE OR REPLACE FUNCTION log_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO transactions_ledger (transaction_id, action, new_values)
        VALUES (NEW.id, 'INSERT', row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO transactions_ledger (transaction_id, action, old_values, new_values)
        VALUES (NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO transactions_ledger (transaction_id, action, old_values)
        VALUES (OLD.id, 'DELETE', row_to_json(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for transaction logging
CREATE TRIGGER transaction_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION log_transaction_changes();

-- ==============================================
-- STORAGE BUCKETS SETUP
-- ==============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
    ('videos', 'videos', true),
    ('projects', 'projects', false),
    ('thumbnails', 'thumbnails', true),
    ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public videos are viewable by everyone" ON storage.objects
    FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Public thumbnails are viewable by everyone" ON storage.objects
    FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY "Public avatars are viewable by everyone" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload videos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload thumbnails" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload avatars" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role can manage all files" ON storage.objects
    FOR ALL USING (auth.role() = 'service_role');

-- ==============================================
-- INITIAL DATA SETUP
-- ==============================================

-- Create admin user (replace with actual admin email)
-- INSERT INTO user_profiles (id, email, username, is_admin, is_director_verified)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'admin@spiderink.art', 'admin', true, true)
-- ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- COMPLETION MESSAGE
-- ==============================================

DO $$
BEGIN
    RAISE NOTICE 'SpiderInk.art database migration completed successfully!';
    RAISE NOTICE 'All tables, indexes, policies, and triggers have been created.';
    RAISE NOTICE 'Ready for DirectorStudio integration.';
END $$;
