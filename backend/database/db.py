"""
Supabase database connection and client configuration.
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


def get_supabase_client() -> Client:
    """
    Get Supabase client instance.
    
    Returns:
        Client: Supabase client
        
    Raises:
        ValueError: If environment variables are not set
    """
    # Prefer Service Key for backend operations to bypass RLS
    key = SUPABASE_SERVICE_KEY or SUPABASE_KEY
    
    if not SUPABASE_URL or not key:
        raise ValueError(
            "Missing Supabase configuration. "
            "Please set SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_KEY) in your .env file"
        )
    
    return create_client(SUPABASE_URL, key)


# Singleton client instance
_client: Client | None = None


def get_client() -> Client:
    """
    Get or create singleton Supabase client.
    
    Returns:
        Client: Supabase client instance
    """
    global _client
    if _client is None:
        _client = get_supabase_client()
    return _client


# Storage bucket name for audio files
AUDIO_BUCKET = "audio-files"

# Table names
TRANSCRIPTS_TABLE = "transcripts"
SEGMENTS_TABLE = "transcript_segments"
SPEAKER_LABELS_TABLE = "speaker_labels"
