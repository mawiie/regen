"""
AssemblyAI transcription service with speaker diarization.
"""

import os
import assemblyai as aai
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

# Configure AssemblyAI
aai.settings.api_key = os.getenv("ASSEMBLY_AI_API_KEY")


# Filler words to detect
FILLER_WORDS = {"um", "uhm", "uh", "ah", "er", "like", "you know", "i mean", "so", "basically"}


def is_filler_word(word: str) -> bool:
    """Check if a word is a filler word."""
    return word.lower().strip() in FILLER_WORDS


async def transcribe_audio(
    file_path: str,
    word_boost: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Transcribe an audio file using AssemblyAI with speaker diarization.
    
    Args:
        file_path: Path to the audio file (local path or URL)
        word_boost: List of words to boost recognition for (domain-specific terms)
        
    Returns:
        dict: Transcription result with segments, speakers, and word-level data
        
    Raises:
        Exception: If transcription fails
    """
    # Configure transcription settings
    config = aai.TranscriptionConfig(
        speaker_labels=True,  # Enable speaker diarization
        filter_profanity=False,  # Keep original content
        word_boost=word_boost or [],
        auto_highlights=True,  # Detect key phrases
        speech_model=None,
        speech_models=["universal-2"],  # Use Universal-2 model
    )
    
    # Create transcriber
    transcriber = aai.Transcriber()
    
    # Transcribe (this is a blocking call, consider running in thread pool for async)
    transcript = transcriber.transcribe(file_path, config=config)
    
    if transcript.status == aai.TranscriptStatus.error:
        raise Exception(f"Transcription failed: {transcript.error}")
    
    # Process the transcript
    result = process_transcript(transcript)
    
    return result


def process_transcript(transcript: aai.Transcript) -> Dict[str, Any]:
    """
    Process AssemblyAI transcript into our segment structure.
    
    Args:
        transcript: AssemblyAI Transcript object
        
    Returns:
        dict: Processed transcript data
    """
    segments = []
    speakers = set()
    
    # Process utterances (speaker-labeled segments)
    if transcript.utterances:
        for idx, utterance in enumerate(transcript.utterances):
            speaker_id = utterance.speaker or "A"
            speakers.add(speaker_id)
            
            # Process words in this utterance
            words = []
            if utterance.words:
                for word in utterance.words:
                    words.append({
                        "text": word.text,
                        "start": word.start / 1000,  # Convert ms to seconds
                        "end": word.end / 1000,
                        "confidence": word.confidence or 0,
                        "is_filler": is_filler_word(word.text),
                    })
            
            segments.append({
                "id": f"seg_{idx:03d}",
                "start": utterance.start / 1000,  # Convert ms to seconds
                "end": utterance.end / 1000,
                "text": utterance.text,
                "speaker": speaker_id,
                "confidence": utterance.confidence or 0,
                "words": words,
            })
    
    # If no utterances (no speaker labels), fall back to sentences
    elif transcript.sentences:
        for idx, sentence in enumerate(transcript.sentences):
            words = []
            if sentence.words:
                for word in sentence.words:
                    words.append({
                        "text": word.text,
                        "start": word.start / 1000,
                        "end": word.end / 1000,
                        "confidence": word.confidence or 0,
                        "is_filler": is_filler_word(word.text),
                    })
            
            segments.append({
                "id": f"seg_{idx:03d}",
                "start": sentence.start / 1000,
                "end": sentence.end / 1000,
                "text": sentence.text,
                "speaker": "A",
                "confidence": sentence.confidence or 0,
                "words": words,
            })
            speakers.add("A")
    
    # Calculate duration from last segment
    duration = segments[-1]["end"] if segments else 0
    
    return {
        "full_text": transcript.text or "",
        "duration": duration,
        "num_speakers": len(speakers),
        "speakers": sorted(list(speakers)),
        "segments": segments,
        "auto_highlights": [
            {
                "text": h.text,
                "count": h.count,
                "rank": h.rank,
            }
            for h in (transcript.auto_highlights.results or [])
        ] if transcript.auto_highlights else [],
    }


def get_transcription_status(transcript_id: str) -> Dict[str, Any]:
    """
    Get the status of a transcription job.
    
    Note: This is for polling AssemblyAI's status if using async transcription.
    Currently we use synchronous transcription, so this is for future use.
    
    Args:
        transcript_id: AssemblyAI transcript ID
        
    Returns:
        dict: Status information
    """
    transcript = aai.Transcript.get_by_id(transcript_id)
    
    status_map = {
        aai.TranscriptStatus.queued: ("processing", 10),
        aai.TranscriptStatus.processing: ("processing", 50),
        aai.TranscriptStatus.completed: ("completed", 100),
        aai.TranscriptStatus.error: ("failed", 0),
    }
    
    status, progress = status_map.get(transcript.status, ("processing", 25))
    
    return {
        "status": status,
        "progress": progress,
        "error": transcript.error if transcript.status == aai.TranscriptStatus.error else None,
    }
