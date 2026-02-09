-- Supabase Database Migration
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for transcript status
CREATE TYPE transcript_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT,
    status transcript_status DEFAULT 'pending',
    duration FLOAT,
    num_speakers INTEGER DEFAULT 0,
    full_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcript segments table
CREATE TABLE IF NOT EXISTS transcript_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transcript_id UUID REFERENCES transcripts(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    start_time FLOAT NOT NULL,
    end_time FLOAT NOT NULL,
    text TEXT NOT NULL,
    speaker_id TEXT DEFAULT 'A',
    confidence FLOAT DEFAULT 0,
    words JSONB DEFAULT '[]',
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Speaker labels table
CREATE TABLE IF NOT EXISTS speaker_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transcript_id UUID REFERENCES transcripts(id) ON DELETE CASCADE,
    speaker_id TEXT NOT NULL,
    custom_name TEXT,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(transcript_id, speaker_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_status ON transcripts(status);
CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_segments_transcript_id ON transcript_segments(transcript_id);
CREATE INDEX IF NOT EXISTS idx_segments_order ON transcript_segments(transcript_id, segment_index);
CREATE INDEX IF NOT EXISTS idx_speaker_labels_transcript_id ON speaker_labels(transcript_id);

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE speaker_labels ENABLE ROW LEVEL SECURITY;

-- Grant permissions to anonymous users (Required for public upload without auth)
GRANT INSERT, SELECT, UPDATE, DELETE ON transcripts TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON transcript_segments TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON speaker_labels TO anon;

-- Transcripts Policies

-- Allow anonymous uploads (user_id must be NULL)
CREATE POLICY "Allow anonymous uploads"
    ON transcripts FOR INSERT
    WITH CHECK (auth.uid() IS NULL AND user_id IS NULL);

-- Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads"
    ON transcripts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow viewing own or anonymous transcripts
CREATE POLICY "Users can view transcripts"
    ON transcripts FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow updating own or anonymous transcripts
CREATE POLICY "Users can update transcripts"
    ON transcripts FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow deleting own or anonymous transcripts
CREATE POLICY "Users can delete transcripts"
    ON transcripts FOR DELETE
    USING (auth.uid() = user_id OR user_id IS NULL);


-- Segments Policies

-- Allow creating segments if parent transcript is accessible
CREATE POLICY "Allow creating segments"
    ON transcript_segments FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM transcripts 
        WHERE transcripts.id = transcript_id 
        AND (transcripts.user_id = auth.uid() OR transcripts.user_id IS NULL)
    ));

-- Allow viewing/updating/deleting segments if parent transcript is accessible
CREATE POLICY "Users can access segments"
    ON transcript_segments FOR ALL
    USING (EXISTS (
        SELECT 1 FROM transcripts 
        WHERE transcripts.id = transcript_id 
        AND (transcripts.user_id = auth.uid() OR transcripts.user_id IS NULL)
    ));


-- Speaker Labels Policies

-- Allow creating speaker labels if parent transcript is accessible
CREATE POLICY "Allow creating speaker labels"
    ON speaker_labels FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM transcripts 
        WHERE transcripts.id = transcript_id 
        AND (transcripts.user_id = auth.uid() OR transcripts.user_id IS NULL)
    ));

-- Allow viewing/updating/deleting speaker labels if parent transcript is accessible
CREATE POLICY "Users can access speaker labels"
    ON speaker_labels FOR ALL
    USING (EXISTS (
        SELECT 1 FROM transcripts 
        WHERE transcripts.id = transcript_id 
        AND (transcripts.user_id = auth.uid() OR transcripts.user_id IS NULL)
    ));


-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_transcripts_updated_at
    BEFORE UPDATE ON transcripts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_segments_updated_at
    BEFORE UPDATE ON transcript_segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_speaker_labels_updated_at
    BEFORE UPDATE ON speaker_labels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
