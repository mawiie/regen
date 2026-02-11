-- Migration: Add original_text column to transcript_segments
-- This stores the original transcribed text before any edits

-- Add original_text column
ALTER TABLE transcript_segments 
ADD COLUMN IF NOT EXISTS original_text TEXT;

-- Set original_text to current text for existing segments that haven't been edited
UPDATE transcript_segments 
SET original_text = text 
WHERE original_text IS NULL;

-- For segments that have been edited (is_edited = true), 
-- the original_text will be populated on the next edit if it's still NULL
