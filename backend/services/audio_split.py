"""
Split audio into one file per speaker using segment timestamps.
Requires pydub and ffmpeg (for non-WAV formats).
"""

import hashlib
import os
import logging
from typing import List, Dict, Tuple, Optional

from pydub import AudioSegment

logger = logging.getLogger(__name__)

# Backend root = directory containing main.py (one level up from services/)
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SPEAKER_AUDIO_DIR = os.path.join(BACKEND_ROOT, "speaker_audio")
# Unique processing output per audio (by content hash): transcript + speaker files + metadata
AUDIO_PROCESSING_ROOT = os.path.join(BACKEND_ROOT, "audio_processing")


def compute_file_hash(file_path: str, chunk_size: int = 8192) -> str:
    """Compute SHA256 hash of file contents for deduplication."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


def _merge_intervals(intervals: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    """Merge overlapping or adjacent (start_sec, end_sec) intervals."""
    if not intervals:
        return []
    sorted_intervals = sorted(intervals, key=lambda x: x[0])
    merged = [sorted_intervals[0]]
    for start, end in sorted_intervals[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def split_audio_by_speakers(
    audio_path: str,
    segments: List[dict],
    transcript_id: str,
    output_dir: Optional[str] = None,
    filename_prefix: Optional[str] = None,
) -> List[str]:
    """
    Split audio into one file per speaker. Each file contains all segments
    from that speaker concatenated in order.

    Args:
        audio_path: Path to the source audio file.
        segments: List of segment dicts with "start", "end" (seconds), "speaker".
        transcript_id: Transcript UUID for filenames (used when filename_prefix is None).
        output_dir: Optional output directory; defaults to backend/speaker_audio.
        filename_prefix: Prefix for output filenames; if None, uses transcript_id.
            Use "" for names like speaker_A.mp3 (e.g. in hash-based processing dir).

    Returns:
        List of created file paths. Empty if no segments/speakers.
    """
    if not segments:
        logger.info("No segments to split for transcript %s", transcript_id)
        return []

    # Group (start, end) by speaker
    by_speaker: Dict[str, List[Tuple[float, float]]] = {}
    for seg in segments:
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        speaker = seg.get("speaker", "A")
        if speaker not in by_speaker:
            by_speaker[speaker] = []
        by_speaker[speaker].append((start, end))

    # Merge intervals per speaker
    for speaker in by_speaker:
        by_speaker[speaker] = _merge_intervals(by_speaker[speaker])

    if not by_speaker:
        return []

    out_dir = output_dir or SPEAKER_AUDIO_DIR
    os.makedirs(out_dir, exist_ok=True)
    prefix = filename_prefix if filename_prefix is not None else transcript_id
    name_fmt = f"{prefix}_speaker_{{}}.mp3" if prefix else "speaker_{}.mp3"

    try:
        audio = AudioSegment.from_file(audio_path)
    except Exception as e:
        logger.exception("Failed to load audio %s: %s", audio_path, e)
        raise

    created: List[str] = []
    for speaker_id in sorted(by_speaker.keys()):
        combined = AudioSegment.empty()
        for start_sec, end_sec in by_speaker[speaker_id]:
            start_ms = int(start_sec * 1000)
            end_ms = int(end_sec * 1000)
            combined += audio[start_ms:end_ms]

        if len(combined) == 0:
            continue

        out_path = os.path.join(out_dir, name_fmt.format(speaker_id))
        try:
            combined.export(out_path, format="mp3")
            created.append(out_path)
        except Exception as e:
            logger.exception("Failed to export speaker %s for %s: %s", speaker_id, transcript_id, e)

    return created
