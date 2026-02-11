"""
Speaker processing: split audio by speaker and create ElevenLabs Instant Voice Clones.
Stores each audio process uniquely by content hash; reuses existing processing when the
same file is uploaded again.
"""

import json
import logging
import os
from io import BytesIO
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

from services.audio_split import (
    AUDIO_PROCESSING_ROOT,
    compute_file_hash,
    split_audio_by_speakers,
)

load_dotenv()

logger = logging.getLogger(__name__)

METADATA_FILENAME = "metadata.json"
TRANSCRIPT_FILENAME = "transcript.json"


def _get_elevenlabs_client():
    from elevenlabs.client import ElevenLabs
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY is not set")
    return ElevenLabs(api_key=api_key)


def _create_voice_clone(
    speaker_audio_path: str,
    name: str,
) -> str:
    """Create an ElevenLabs Instant Voice Clone from a single speaker audio file. Returns voice_id."""
    client = _get_elevenlabs_client()
    with open(speaker_audio_path, "rb") as f:
        data = f.read()
    voice = client.voices.ivc.create(
        name=name,
        files=[BytesIO(data)],
    )
    return voice.voice_id


def get_or_create_speaker_processing(
    transcript_id: str,
    temp_file_path: str,
    segments: List[dict],
    speakers: List[str],
    full_text: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Get or create unique processing for this audio: split by speaker and clone voices.
    If the same audio (by content hash) was already processed, reuse it and attach
    voice_ids to this transcript. Otherwise split, clone, and save metadata.

    Args:
        transcript_id: Current transcript UUID.
        temp_file_path: Path to the source audio file (e.g. temp download).
        segments: List of segment dicts with start, end, speaker.
        speakers: List of speaker IDs (e.g. ["A", "B"]).
        full_text: Optional full transcript text to store in processing dir.

    Returns:
        Dict with content_hash, processing_dir, and speakers map { speaker_id: { voice_id } }.
    """
    if not segments or not speakers:
        return {"content_hash": None, "processing_dir": None, "speakers": {}}

    content_hash = compute_file_hash(temp_file_path)
    processing_dir = os.path.join(AUDIO_PROCESSING_ROOT, content_hash)
    metadata_path = os.path.join(processing_dir, METADATA_FILENAME)

    # Reuse existing processing if metadata exists and has voice_ids
    if os.path.isfile(metadata_path):
        try:
            with open(metadata_path, "r") as f:
                meta = json.load(f)
            speaker_voice_ids = meta.get("speakers") or {}
            if all(speaker_voice_ids.get(s, {}).get("voice_id") for s in speakers):
                from database.models import (
                    update_speaker_label_by_transcript_and_speaker,
                    update_transcript,
                )
                for speaker_id in speakers:
                    voice_id = speaker_voice_ids.get(speaker_id, {}).get("voice_id")
                    if voice_id:
                        update_speaker_label_by_transcript_and_speaker(
                            transcript_id, speaker_id, voice_id=voice_id
                        )
                update_transcript(transcript_id, content_hash=content_hash)
                logger.info(
                    "Reused processing for transcript %s (hash %s)",
                    transcript_id,
                    content_hash[:16],
                )
                return {
                    "content_hash": content_hash,
                    "processing_dir": processing_dir,
                    "speakers": speaker_voice_ids,
                }
        except Exception as e:
            logger.warning("Could not reuse metadata at %s: %s", metadata_path, e)

    # Create processing dir, split, clone, write metadata
    os.makedirs(processing_dir, exist_ok=True)

    # Split into speaker_A.mp3, speaker_B.mp3, ...
    split_audio_by_speakers(
        temp_file_path,
        segments,
        transcript_id,
        output_dir=processing_dir,
        filename_prefix="",
    )

    # Optional: save transcript reference
    if full_text is not None:
        transcript_ref_path = os.path.join(processing_dir, TRANSCRIPT_FILENAME)
        try:
            with open(transcript_ref_path, "w") as f:
                json.dump({"full_text": full_text, "num_speakers": len(speakers)}, f)
        except Exception as e:
            logger.warning("Could not write transcript.json: %s", e)

    # Clone each speaker with ElevenLabs and collect voice_ids
    speaker_voice_ids: Dict[str, Dict[str, str]] = {}
    for speaker_id in sorted(speakers):
        speaker_path = os.path.join(processing_dir, f"speaker_{speaker_id}.mp3")
        if not os.path.isfile(speaker_path):
            logger.warning("Speaker file missing: %s", speaker_path)
            continue
        try:
            voice_id = _create_voice_clone(
                speaker_path,
                name=f"Clone {transcript_id} Speaker {speaker_id}",
            )
            speaker_voice_ids[speaker_id] = {"voice_id": voice_id}
            from database.models import update_speaker_label_by_transcript_and_speaker
            update_speaker_label_by_transcript_and_speaker(
                transcript_id, speaker_id, voice_id=voice_id
            )
        except Exception as e:
            logger.exception("Voice clone failed for speaker %s: %s", speaker_id, e)

    metadata = {
        "content_hash": content_hash,
        "speakers": speaker_voice_ids,
    }
    try:
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
    except Exception as e:
        logger.exception("Could not write metadata.json: %s", e)

    from database.models import update_transcript
    update_transcript(transcript_id, content_hash=content_hash)

    return {
        "content_hash": content_hash,
        "processing_dir": processing_dir,
        "speakers": speaker_voice_ids,
    }
