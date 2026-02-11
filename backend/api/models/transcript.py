"""
Pydantic models for API request/response schemas.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class TranscriptStatus(str, Enum):
    """Status of a transcript processing job."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class WordData(BaseModel):
    """Word-level transcription data."""
    text: str
    start: float
    end: float
    confidence: float = 0.0
    is_filler: bool = False


class SegmentBase(BaseModel):
    """Base segment model."""
    start_time: float
    end_time: float
    text: str
    speaker_id: str = "A"
    confidence: float = 0.0
    words: List[WordData] = []


class SegmentCreate(SegmentBase):
    """Segment creation model."""
    pass


class SegmentUpdate(BaseModel):
    """Segment update model for editing."""
    text: Optional[str] = None
    speaker_id: Optional[str] = None


class Segment(SegmentBase):
    """Full segment model with metadata."""
    id: str
    segment_index: int
    original_text: Optional[str] = None
    is_edited: bool = False
    regenerated_audio_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SpeakerLabelBase(BaseModel):
    """Base speaker label model."""
    speaker_id: str = Field(..., description="Original speaker ID (A, B, C, etc.)")
    custom_name: Optional[str] = Field(None, description="User-defined name")
    color: str = Field(default="#3B82F6", description="Hex color for UI")
    voice_id: Optional[str] = Field(None, description="ElevenLabs voice ID for TTS")


class SpeakerLabelCreate(SpeakerLabelBase):
    """Speaker label creation model."""
    pass


class SpeakerLabelUpdate(BaseModel):
    """Speaker label update model."""
    custom_name: Optional[str] = None
    color: Optional[str] = None


class SpeakerLabel(SpeakerLabelBase):
    """Full speaker label model."""
    id: str
    transcript_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TranscriptBase(BaseModel):
    """Base transcript model."""
    filename: str
    storage_path: Optional[str] = None
    status: TranscriptStatus = TranscriptStatus.PENDING
    duration: Optional[float] = None
    num_speakers: int = 0
    full_text: Optional[str] = None


class TranscriptCreate(BaseModel):
    """Transcript creation model (from upload)."""
    filename: str


class TranscriptResponse(TranscriptBase):
    """Transcript response model."""
    id: str
    created_at: datetime
    updated_at: datetime
    segments: List[Segment] = []
    speaker_labels: List[SpeakerLabel] = []

    class Config:
        from_attributes = True


class TranscriptListItem(BaseModel):
    """Transcript list item (without segments for performance)."""
    id: str
    filename: str
    status: TranscriptStatus
    duration: Optional[float] = None
    num_speakers: int = 0
    created_at: datetime
    updated_at: datetime


class TranscriptionStatusResponse(BaseModel):
    """Response for transcription status check."""
    id: str
    status: TranscriptStatus
    progress: Optional[float] = Field(None, description="Progress percentage 0-100")
    error_message: Optional[str] = None


class UploadResponse(BaseModel):
    """Response after file upload."""
    id: str
    filename: str
    storage_path: str
    message: str = "File uploaded successfully"


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str
    detail: Optional[str] = None
