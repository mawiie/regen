"""
Upload API routes.
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks

from api.models.transcript import (
    UploadResponse,
    TranscriptionStatusResponse,
    TranscriptStatus,
    ErrorResponse
)
from services.storage import (
    validate_audio_file,
    upload_to_supabase,
    save_temp_file,
    cleanup_temp_file
)
from services.transcription import transcribe_audio
from services.voice_clone import get_or_create_speaker_processing
from database.models import (
    create_transcript,
    update_transcript,
    create_segments,
    create_speaker_labels,
    get_transcript
)


router = APIRouter()


async def process_transcription(
    transcript_id: str,
    temp_file_path: str,
    word_boost: Optional[list] = None
):
    """
    Background task to process audio transcription.
    
    Args:
        transcript_id: UUID of the transcript record
        temp_file_path: Path to temporary audio file
        word_boost: Optional list of words to boost
    """
    try:
        # Update status to processing
        update_transcript(transcript_id, status="processing")
        
        # Run transcription (this is CPU-bound, run in thread pool)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: asyncio.run(transcribe_audio(temp_file_path, word_boost))
        )
        
        # Store segments in database
        create_segments(transcript_id, result["segments"])
        
        # Create speaker labels
        if result["speakers"]:
            create_speaker_labels(transcript_id, result["speakers"])
        
        # Update transcript with results
        update_transcript(
            transcript_id,
            status="completed",
            full_text=result["full_text"],
            duration=result["duration"],
            num_speakers=result["num_speakers"]
        )

        # Split audio by speaker and create voice clones (or reuse by content hash)
        try:
            outcome = get_or_create_speaker_processing(
                transcript_id,
                temp_file_path,
                result["segments"],
                result.get("speakers") or [],
                full_text=result.get("full_text"),
            )
            if outcome.get("speakers"):
                logging.getLogger(__name__).info(
                    "Speaker processing for %s: %s", transcript_id, outcome
                )
        except Exception as proc_err:
            logging.getLogger(__name__).exception(
                "Speaker processing failed for %s (transcription succeeded): %s",
                transcript_id,
                proc_err,
            )

    except Exception as e:
        # Update status to failed
        update_transcript(
            transcript_id,
            status="failed",
            full_text=f"Error: {str(e)}"
        )
    finally:
        # Cleanup temp file
        cleanup_temp_file(temp_file_path)


@router.post(
    "/upload",
    response_model=UploadResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}}
)
async def upload_audio(
    file: UploadFile = File(..., description="Audio file to upload"),
):
    """
    Upload an audio file for transcription.
    
    The file is uploaded to storage and a transcript record is created.
    Transcription must be triggered separately via the /transcribe endpoint.
    
    Supported formats: mp3, wav, m4a, flac, ogg, webm, mp4
    Maximum size: 100MB
    """
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Read file to get size
    content = await file.read()
    file_size = len(content)
    await file.seek(0)  # Reset for later use
    
    is_valid, error_msg = validate_audio_file(file.filename, file_size)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    try:
        # Create transcript record first to get ID
        import uuid
        transcript_id = str(uuid.uuid4())
        
        # Upload to Supabase Storage
        storage_path, _ = await upload_to_supabase(file, transcript_id)
        
        # Create database record
        transcript = create_transcript(file.filename, storage_path)
        
        if not transcript:
            raise HTTPException(
                status_code=500,
                detail="Failed to create transcript record"
            )
        
        return UploadResponse(
            id=transcript["id"],
            filename=file.filename,
            storage_path=storage_path,
            message="File uploaded successfully. Use /api/transcripts/{id}/transcribe to start transcription."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post(
    "/transcripts/{transcript_id}/transcribe",
    response_model=TranscriptionStatusResponse,
    responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}}
)
async def start_transcription(
    transcript_id: str,
    background_tasks: BackgroundTasks,
    word_boost: Optional[str] = None
):
    """
    Start transcription for an uploaded audio file.
    
    This triggers the AssemblyAI transcription process in the background.
    Use /api/transcripts/{id}/status to poll for completion.
    
    Args:
        transcript_id: UUID of the uploaded transcript
        word_boost: Comma-separated list of words to boost (e.g., "Supabase,FastAPI,PostgreSQL")
    """
    # Get transcript record
    transcript = get_transcript(transcript_id)
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    if transcript["status"] == "processing":
        raise HTTPException(
            status_code=400,
            detail="Transcription already in progress"
        )
    
    if transcript["status"] == "completed":
        raise HTTPException(
            status_code=400,
            detail="Transcription already completed"
        )
    
    # Parse word boost
    boost_list = None
    if word_boost:
        boost_list = [w.strip() for w in word_boost.split(",") if w.strip()]
    
    try:
        # Download audio from Supabase to temp file for AssemblyAI
        from services.storage import download_audio
        import aiofiles
        import tempfile
        import os
        
        # Get file extension from storage path
        ext = os.path.splitext(transcript["storage_path"])[1] or ".mp3"
        
        # Create temp file
        temp_dir = "/tmp/audio_transcription"
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"{transcript_id}{ext}")
        
        # Download and save
        audio_content = await download_audio(transcript["storage_path"])
        async with aiofiles.open(temp_path, 'wb') as f:
            await f.write(audio_content)
        
        # Add background task for transcription
        background_tasks.add_task(
            process_transcription,
            transcript_id,
            temp_path,
            boost_list
        )
        
        # Update status
        update_transcript(transcript_id, status="processing")
        
        return TranscriptionStatusResponse(
            id=transcript_id,
            status=TranscriptStatus.PROCESSING,
            progress=0,
            error_message=None
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start transcription: {str(e)}"
        )
