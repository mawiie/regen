"""
ElevenLabs text-to-speech for regenerating edited segment audio.
Uses voice_id from speaker labels (instant voice clone or predefined).
"""

import logging
import os
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "eleven_multilingual_v2"
DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"


def _get_client():
    from elevenlabs.client import ElevenLabs
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY is not set")
    return ElevenLabs(api_key=api_key)


def text_to_speech_mp3(
    text: str,
    voice_id: str,
    model_id: str = DEFAULT_MODEL,
    output_format: str = DEFAULT_OUTPUT_FORMAT,
) -> bytes:
    """
    Convert text to speech using ElevenLabs. Returns MP3 bytes.

    Args:
        text: Text to speak
        voice_id: ElevenLabs voice ID (from speaker label or predefined)
        model_id: Model to use
        output_format: e.g. mp3_44100_128

    Returns:
        bytes: MP3 audio data
    """
    if not text or not text.strip():
        return b""

    client = _get_client()
    result = client.text_to_speech.convert(
        text=text.strip(),
        voice_id=voice_id,
        model_id=model_id,
        output_format=output_format,
    )
    # convert() may return a generator of chunks or bytes
    if hasattr(result, "__iter__") and not isinstance(result, (bytes, bytearray)):
        return b"".join(result)
    return bytes(result)
