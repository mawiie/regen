-- Migration: Update RLS policies for authenticated users
-- Run this in your Supabase SQL Editor after enabling email auth

-- Update transcripts policies to properly handle authenticated users
-- Drop old permissive anonymous policies
DROP POLICY IF EXISTS "Allow anonymous uploads" ON transcripts;

-- Ensure authenticated users can insert with their user_id
DROP POLICY IF EXISTS "Allow authenticated uploads" ON transcripts;
CREATE POLICY "Allow authenticated uploads"
    ON transcripts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can only view their own transcripts
DROP POLICY IF EXISTS "Users can view transcripts" ON transcripts;
CREATE POLICY "Users can view their own transcripts"
    ON transcripts FOR SELECT
    USING (auth.uid() = user_id);

-- Users can only update their own transcripts
DROP POLICY IF EXISTS "Users can update transcripts" ON transcripts;
CREATE POLICY "Users can update their own transcripts"
    ON transcripts FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can only delete their own transcripts
DROP POLICY IF EXISTS "Users can delete transcripts" ON transcripts;
CREATE POLICY "Users can delete their own transcripts"
    ON transcripts FOR DELETE
    USING (auth.uid() = user_id);

-- Segments: users can manage segments for their own transcripts
DROP POLICY IF EXISTS "Allow creating segments" ON transcript_segments;
DROP POLICY IF EXISTS "Users can access segments" ON transcript_segments;

CREATE POLICY "Users can manage their segments"
    ON transcript_segments FOR ALL
    USING (EXISTS (
        SELECT 1 FROM transcripts 
        WHERE transcripts.id = transcript_id 
        AND transcripts.user_id = auth.uid()
    ));

-- Speaker Labels: users can manage labels for their own transcripts
DROP POLICY IF EXISTS "Allow creating speaker labels" ON speaker_labels;
DROP POLICY IF EXISTS "Users can access speaker labels" ON speaker_labels;

CREATE POLICY "Users can manage their speaker labels"
    ON speaker_labels FOR ALL
    USING (EXISTS (
        SELECT 1 FROM transcripts 
        WHERE transcripts.id = transcript_id 
        AND transcripts.user_id = auth.uid()
    ));

-- Grant permissions to authenticated role
GRANT INSERT, SELECT, UPDATE, DELETE ON transcripts TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON transcript_segments TO authenticated;
GRANT INSERT, SELECT, UPDATE, DELETE ON speaker_labels TO authenticated;

-- Note: The service role key used by the backend bypasses RLS entirely,
-- so these policies only apply when using the anon/authenticated client directly.
-- The backend performs its own ownership checks in the API routes.
