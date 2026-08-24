"""Optional TTS adapter (OpenAI-compatible). Returns None when not configured."""

from __future__ import annotations

import httpx

from agent import config


def synthesize(text: str) -> bytes | None:
    if not text or not config.tts_configured():
        return None
    url = (config.TTS_BASE_URL or "").rstrip("/")
    if not url:
        return None
    # Expect OpenAI-compatible /audio/speech
    if not url.endswith("/audio/speech"):
        url = url + "/audio/speech"
    try:
        r = httpx.post(
            url,
            headers={"Authorization": f"Bearer {config.TTS_API_KEY}"},
            json={"model": "tts-1", "input": text, "voice": "alloy"},
            timeout=30.0,
        )
        r.raise_for_status()
        return r.content
    except Exception:
        return None
