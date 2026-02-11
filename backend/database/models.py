"""
Database operations for transcripts, segments, and speaker labels.
"""

from typing import List, Optional
from datetime import datetime
import uuid

from .db import (
    get_client,
    TRANSCRIPTS_TABLE,
    SEGMENTS_TABLE,
    SPEAKER_LABELS_TABLE
)


# ----- Transcript Operations -----

def create_transcript(filename: str, storage_path: str, user_id: Optional[str] = None) -> dict:
    """
    Create a new transcript record.
    
    Args:
        filename: Original audio filename
        storage_path: Path in Supabase Storage
        user_id: UUID of the authenticated user
        
    Returns:
        dict: Created transcript record
    """
    client = get_client()
    
    data = {
        "id": str(uuid.uuid4()),
        "filename": filename,
        "storage_path": storage_path,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    if user_id:
        data["user_id"] = user_id
    
    result = client.table(TRANSCRIPTS_TABLE).insert(data).execute()
    return result.data[0] if result.data else None


def get_transcript(transcript_id: str) -> Optional[dict]:
    """
    Get a transcript by ID.
    
    Args:
        transcript_id: UUID of the transcript
        
    Returns:
        dict or None: Transcript record if found
    """
    client = get_client()
    
    result = client.table(TRANSCRIPTS_TABLE).select("*").eq("id", transcript_id).execute()
    return result.data[0] if result.data else None


def get_transcript_with_segments(transcript_id: str) -> Optional[dict]:
    """
    Get a transcript with all its segments and speaker labels.
    
    Args:
        transcript_id: UUID of the transcript
        
    Returns:
        dict or None: Transcript with segments and speaker labels
    """
    client = get_client()
    
    # Get transcript
    transcript = get_transcript(transcript_id)
    if not transcript:
        return None
    
    # Get segments
    segments_result = client.table(SEGMENTS_TABLE)\
        .select("*")\
        .eq("transcript_id", transcript_id)\
        .order("segment_index")\
        .execute()
    
    # Get speaker labels
    labels_result = client.table(SPEAKER_LABELS_TABLE)\
        .select("*")\
        .eq("transcript_id", transcript_id)\
        .execute()
    
    transcript["segments"] = segments_result.data or []
    transcript["speaker_labels"] = labels_result.data or []
    
    return transcript


def update_transcript(transcript_id: str, **kwargs) -> Optional[dict]:
    """
    Update a transcript record.
    
    Args:
        transcript_id: UUID of the transcript
        **kwargs: Fields to update
        
    Returns:
        dict or None: Updated transcript record
    """
    client = get_client()
    
    kwargs["updated_at"] = datetime.utcnow().isoformat()
    
    result = client.table(TRANSCRIPTS_TABLE)\
        .update(kwargs)\
        .eq("id", transcript_id)\
        .execute()
    
    return result.data[0] if result.data else None


def delete_transcript(transcript_id: str) -> bool:
    """
    Delete a transcript and all related data.
    
    Args:
        transcript_id: UUID of the transcript
        
    Returns:
        bool: True if deleted successfully
    """
    client = get_client()
    
    # Delete segments first (foreign key)
    client.table(SEGMENTS_TABLE).delete().eq("transcript_id", transcript_id).execute()
    
    # Delete speaker labels
    client.table(SPEAKER_LABELS_TABLE).delete().eq("transcript_id", transcript_id).execute()
    
    # Delete transcript
    result = client.table(TRANSCRIPTS_TABLE).delete().eq("id", transcript_id).execute()
    
    return len(result.data) > 0 if result.data else False


def list_transcripts(limit: int = 50, offset: int = 0, user_id: Optional[str] = None) -> List[dict]:
    """
    List transcripts with pagination, optionally filtered by user.
    
    Args:
        limit: Maximum number of records to return
        offset: Number of records to skip
        user_id: If provided, only return transcripts belonging to this user
        
    Returns:
        List[dict]: List of transcript records
    """
    client = get_client()
    
    query = client.table(TRANSCRIPTS_TABLE)\
        .select("id, filename, status, duration, num_speakers, created_at, updated_at")\
        .order("created_at", desc=True)
    
    if user_id:
        query = query.eq("user_id", user_id)
    
    result = query.range(offset, offset + limit - 1).execute()
    
    return result.data or []


# ----- Segment Operations -----

# Batch size for segment inserts to avoid timeouts
SEGMENT_BATCH_SIZE = 50


def create_segments(transcript_id: str, segments: List[dict]) -> List[dict]:
    """
    Create multiple segments for a transcript.
    
    Inserts in batches to avoid write timeouts on large transcripts.
    
    Args:
        transcript_id: UUID of the parent transcript
        segments: List of segment data
        
    Returns:
        List[dict]: Created segment records
    """
    client = get_client()
    
    now = datetime.utcnow().isoformat()
    
    segment_records = []
    for idx, seg in enumerate(segments):
        segment_records.append({
            "id": str(uuid.uuid4()),
            "transcript_id": transcript_id,
            "segment_index": idx,
            "start_time": seg.get("start", 0),
            "end_time": seg.get("end", 0),
            "text": seg.get("text", ""),
            "speaker_id": seg.get("speaker", "A"),
            "confidence": seg.get("confidence", 0),
            "words": seg.get("words", []),
            "is_edited": False,
            "created_at": now,
            "updated_at": now,
        })
    
    if not segment_records:
        return []
    
    # Insert in batches to avoid timeout
    all_results = []
    for i in range(0, len(segment_records), SEGMENT_BATCH_SIZE):
        batch = segment_records[i:i + SEGMENT_BATCH_SIZE]
        result = client.table(SEGMENTS_TABLE).insert(batch).execute()
        if result.data:
            all_results.extend(result.data)
    
    return all_results


def update_segment(segment_id: str, **kwargs) -> Optional[dict]:
    """
    Update a segment.
    
    Args:
        segment_id: UUID of the segment
        **kwargs: Fields to update
        
    Returns:
        dict or None: Updated segment record
    """
    client = get_client()
    
    # If text is being updated, try to save original_text
    if "text" in kwargs:
        try:
            # First, get the current segment to check if original_text is set
            current = client.table(SEGMENTS_TABLE)\
                .select("text, original_text")\
                .eq("id", segment_id)\
                .execute()
            
            if current.data:
                current_segment = current.data[0]
                # If original_text is not set, save the current text as original
                if not current_segment.get("original_text"):
                    kwargs["original_text"] = current_segment["text"]
        except Exception:
            # Column might not exist yet, just proceed without it
            pass
    
    kwargs["updated_at"] = datetime.utcnow().isoformat()
    kwargs["is_edited"] = True
    
    result = client.table(SEGMENTS_TABLE)\
        .update(kwargs)\
        .eq("id", segment_id)\
        .execute()
    
    return result.data[0] if result.data else None


def get_segments(transcript_id: str) -> List[dict]:
    """
    Get all segments for a transcript.
    
    Args:
        transcript_id: UUID of the transcript
        
    Returns:
        List[dict]: List of segment records
    """
    client = get_client()
    
    result = client.table(SEGMENTS_TABLE)\
        .select("*")\
        .eq("transcript_id", transcript_id)\
        .order("segment_index")\
        .execute()
    
    return result.data or []


# ----- Speaker Label Operations -----

def create_speaker_labels(transcript_id: str, speaker_ids: List[str]) -> List[dict]:
    """
    Create speaker labels for a transcript.
    
    Args:
        transcript_id: UUID of the transcript
        speaker_ids: List of speaker IDs (A, B, C, etc.)
        
    Returns:
        List[dict]: Created speaker label records
    """
    client = get_client()
    
    # Color palette for speakers
    colors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899"]
    
    now = datetime.utcnow().isoformat()
    
    labels = []
    for idx, speaker_id in enumerate(speaker_ids):
        labels.append({
            "id": str(uuid.uuid4()),
            "transcript_id": transcript_id,
            "speaker_id": speaker_id,
            "custom_name": None,
            "color": colors[idx % len(colors)],
            "created_at": now,
            "updated_at": now,
        })
    
    if labels:
        result = client.table(SPEAKER_LABELS_TABLE).insert(labels).execute()
        return result.data or []
    
    return []


def update_speaker_label(label_id: str, **kwargs) -> Optional[dict]:
    """
    Update a speaker label.
    
    Args:
        label_id: UUID of the speaker label
        **kwargs: Fields to update
        
    Returns:
        dict or None: Updated speaker label record
    """
    client = get_client()
    
    kwargs["updated_at"] = datetime.utcnow().isoformat()
    
    result = client.table(SPEAKER_LABELS_TABLE)\
        .update(kwargs)\
        .eq("id", label_id)\
        .execute()
    
    return result.data[0] if result.data else None


def get_speaker_labels(transcript_id: str) -> List[dict]:
    """
    Get all speaker labels for a transcript.
    
    Args:
        transcript_id: UUID of the transcript
        
    Returns:
        List[dict]: List of speaker label records
    """
    client = get_client()
    
    result = client.table(SPEAKER_LABELS_TABLE)\
        .select("*")\
        .eq("transcript_id", transcript_id)\
        .execute()
    
    return result.data or []
