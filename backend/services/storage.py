"""
Storage service for handling audio file uploads to Supabase Storage.
"""

import os
import uuid
from typing import Tuple
from fastapi import UploadFile
import aiofiles

from database.db import get_client, AUDIO_BUCKET


# Allowed audio file extensions
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".webm", ".mp4"}

# Maximum file size (100MB)
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB in bytes


def validate_audio_file(filename: str, file_size: int) -> Tuple[bool, str]:
    """
    Validate an audio file.
    
    Args:
        filename: Original filename
        file_size: Size of the file in bytes
        
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    # Check extension
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
    
    # Check size
    if file_size > MAX_FILE_SIZE:
        return False, f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB"
    
    return True, ""


async def upload_to_supabase(
    file: UploadFile,
    transcript_id: str
) -> Tuple[str, str]:
    """
    Upload an audio file to Supabase Storage.
    
    Args:
        file: FastAPI UploadFile object
        transcript_id: UUID of the transcript for path organization
        
    Returns:
        Tuple[str, str]: (storage_path, public_url)
        
    Raises:
        Exception: If upload fails
    """
    client = get_client()
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{ext}"
    storage_path = f"{transcript_id}/{unique_filename}"
    
    # Read file content
    content = await file.read()
    
    # Upload to Supabase Storage
    result = client.storage.from_(AUDIO_BUCKET).upload(
        path=storage_path,
        file=content,
        file_options={"content-type": file.content_type or "audio/mpeg"}
    )
    
    # Get public URL (or signed URL if bucket is private)
    # For now, we'll store the path and generate URLs as needed
    return storage_path, ""


async def get_audio_url(storage_path: str, expires_in: int = 3600) -> str:
    """
    Get a signed URL for an audio file.
    
    Args:
        storage_path: Path in Supabase Storage
        expires_in: URL expiration time in seconds
        
    Returns:
        str: Signed URL for the file
    """
    client = get_client()
    
    result = client.storage.from_(AUDIO_BUCKET).create_signed_url(
        path=storage_path,
        expires_in=expires_in
    )
    
    return result.get("signedURL", "")


async def download_audio(storage_path: str) -> bytes:
    """
    Download an audio file from Supabase Storage.
    
    Args:
        storage_path: Path in Supabase Storage
        
    Returns:
        bytes: File content
    """
    client = get_client()
    
    result = client.storage.from_(AUDIO_BUCKET).download(storage_path)
    return result


async def delete_audio(storage_path: str) -> bool:
    """
    Delete an audio file from Supabase Storage.
    
    Args:
        storage_path: Path in Supabase Storage
        
    Returns:
        bool: True if deleted successfully
    """
    client = get_client()
    
    try:
        client.storage.from_(AUDIO_BUCKET).remove([storage_path])
        return True
    except Exception:
        return False


async def save_temp_file(file: UploadFile) -> str:
    """
    Save uploaded file to a temporary location.
    Used for AssemblyAI processing which needs a file path or URL.
    
    Args:
        file: FastAPI UploadFile object
        
    Returns:
        str: Path to the temporary file
    """
    # Create temp directory if it doesn't exist
    temp_dir = "/tmp/audio_transcription"
    os.makedirs(temp_dir, exist_ok=True)
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    temp_filename = f"{uuid.uuid4()}{ext}"
    temp_path = os.path.join(temp_dir, temp_filename)
    
    # Save file
    async with aiofiles.open(temp_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
        await file.seek(0)  # Reset file pointer for potential re-read
    
    return temp_path


def cleanup_temp_file(temp_path: str) -> None:
    """
    Remove a temporary file.
    
    Args:
        temp_path: Path to the temporary file
    """
    try:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    except Exception:
        pass  # Ignore cleanup errors
