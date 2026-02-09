"""
Transcript API routes - CRUD operations for transcripts, segments, and speaker labels.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from api.models.transcript import (
    TranscriptResponse,
    TranscriptListItem,
    TranscriptionStatusResponse,
    TranscriptStatus,
    Segment,
    SegmentUpdate,
    SpeakerLabel,
    SpeakerLabelUpdate,
    ErrorResponse
)
from database.models import (
    get_transcript,
    get_transcript_with_segments,
    update_transcript,
    delete_transcript,
    list_transcripts,
    get_segments,
    update_segment,
    get_speaker_labels,
    update_speaker_label
)
from services.storage import delete_audio


router = APIRouter()


# ----- Transcript Endpoints -----

@router.get(
    "/transcripts",
    response_model=List[TranscriptListItem],
    summary="List all transcripts"
)
async def get_transcripts(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    """
    Get a paginated list of all transcripts.
    
    Does not include segments for performance.
    """
    transcripts = list_transcripts(limit=limit, offset=offset)
    return transcripts


@router.get(
    "/transcripts/{transcript_id}",
    response_model=TranscriptResponse,
    responses={404: {"model": ErrorResponse}}
)
async def get_transcript_detail(transcript_id: str):
    """
    Get a transcript with all segments and speaker labels.
    """
    transcript = get_transcript_with_segments(transcript_id)
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    return transcript


@router.get(
    "/transcripts/{transcript_id}/status",
    response_model=TranscriptionStatusResponse,
    responses={404: {"model": ErrorResponse}}
)
async def get_transcript_status(transcript_id: str):
    """
    Get the status of a transcript (for polling during transcription).
    """
    transcript = get_transcript(transcript_id)
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    # Map status to progress
    progress_map = {
        "pending": 0,
        "processing": 50,
        "completed": 100,
        "failed": 0,
    }
    
    error_msg = None
    if transcript["status"] == "failed" and transcript.get("full_text", "").startswith("Error:"):
        error_msg = transcript["full_text"]
    
    return TranscriptionStatusResponse(
        id=transcript_id,
        status=TranscriptStatus(transcript["status"]),
        progress=progress_map.get(transcript["status"], 0),
        error_message=error_msg
    )


@router.delete(
    "/transcripts/{transcript_id}",
    responses={404: {"model": ErrorResponse}}
)
async def remove_transcript(transcript_id: str):
    """
    Delete a transcript and all associated data.
    """
    transcript = get_transcript(transcript_id)
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    # Delete audio file from storage
    if transcript.get("storage_path"):
        await delete_audio(transcript["storage_path"])
    
    # Delete from database
    delete_transcript(transcript_id)
    
    return {"message": "Transcript deleted successfully"}


# ----- Segment Endpoints -----

@router.get(
    "/transcripts/{transcript_id}/segments",
    response_model=List[Segment],
    responses={404: {"model": ErrorResponse}}
)
async def get_transcript_segments(transcript_id: str):
    """
    Get all segments for a transcript.
    """
    transcript = get_transcript(transcript_id)
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    segments = get_segments(transcript_id)
    return segments


@router.patch(
    "/segments/{segment_id}",
    response_model=Segment,
    responses={404: {"model": ErrorResponse}}
)
async def edit_segment(segment_id: str, update: SegmentUpdate):
    """
    Update a segment's text or speaker assignment.
    
    Used for transcript editing.
    """
    update_data = update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = update_segment(segment_id, **update_data)
    
    if not result:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    return result


@router.patch(
    "/transcripts/{transcript_id}/segments/bulk",
    response_model=List[Segment],
    responses={404: {"model": ErrorResponse}}
)
async def bulk_update_segments(
    transcript_id: str,
    updates: List[dict]
):
    """
    Update multiple segments at once.
    
    Used for batch saves from the editor.
    
    Body format:
    [
        {"id": "segment_id", "text": "updated text"},
        {"id": "segment_id", "speaker_id": "B"}
    ]
    """
    transcript = get_transcript(transcript_id)
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    results = []
    for update in updates:
        segment_id = update.pop("id", None)
        if segment_id and update:
            result = update_segment(segment_id, **update)
            if result:
                results.append(result)
    
    return results


# ----- Speaker Label Endpoints -----

@router.get(
    "/transcripts/{transcript_id}/speakers",
    response_model=List[SpeakerLabel],
    responses={404: {"model": ErrorResponse}}
)
async def get_transcript_speakers(transcript_id: str):
    """
    Get all speaker labels for a transcript.
    """
    transcript = get_transcript(transcript_id)
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    labels = get_speaker_labels(transcript_id)
    return labels


@router.patch(
    "/speakers/{speaker_label_id}",
    response_model=SpeakerLabel,
    responses={404: {"model": ErrorResponse}}
)
async def update_speaker(speaker_label_id: str, update: SpeakerLabelUpdate):
    """
    Update a speaker's custom name or color.
    
    When a user names "Speaker A" as "John", this endpoint is called.
    """
    update_data = update.model_dump(exclude_unset=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = update_speaker_label(speaker_label_id, **update_data)
    
    if not result:
        raise HTTPException(status_code=404, detail="Speaker label not found")
    
    return result


# ----- Export Endpoints -----

@router.get(
    "/transcripts/{transcript_id}/export",
    responses={404: {"model": ErrorResponse}}
)
async def export_transcript(
    transcript_id: str,
    format: str = Query(default="txt", enum=["txt", "srt", "json"])
):
    """
    Export a transcript in various formats.
    
    Formats:
    - txt: Plain text with timestamps
    - srt: SubRip subtitle format
    - json: Full JSON with all metadata
    """
    transcript = get_transcript_with_segments(transcript_id)
    
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    segments = transcript.get("segments", [])
    speaker_labels = {s["speaker_id"]: s.get("custom_name") or f"Speaker {s['speaker_id']}" 
                     for s in transcript.get("speaker_labels", [])}
    
    if format == "txt":
        lines = []
        for seg in segments:
            speaker = speaker_labels.get(seg["speaker_id"], f"Speaker {seg['speaker_id']}")
            timestamp = format_timestamp(seg["start_time"])
            lines.append(f"[{timestamp}] {speaker}: {seg['text']}")
        
        return {"content": "\n".join(lines), "filename": f"{transcript['filename']}.txt"}
    
    elif format == "srt":
        srt_content = []
        for idx, seg in enumerate(segments, 1):
            start = format_srt_timestamp(seg["start_time"])
            end = format_srt_timestamp(seg["end_time"])
            speaker = speaker_labels.get(seg["speaker_id"], "")
            text = f"[{speaker}] {seg['text']}" if speaker else seg["text"]
            
            srt_content.append(f"{idx}")
            srt_content.append(f"{start} --> {end}")
            srt_content.append(text)
            srt_content.append("")
        
        return {"content": "\n".join(srt_content), "filename": f"{transcript['filename']}.srt"}
    
    else:  # json
        return {
            "content": transcript,
            "filename": f"{transcript['filename']}.json"
        }


def format_timestamp(seconds: float) -> str:
    """Format seconds to MM:SS."""
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"


def format_srt_timestamp(seconds: float) -> str:
    """Format seconds to SRT timestamp format (HH:MM:SS,mmm)."""
    hours = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"
