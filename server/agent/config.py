import os

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")
TTS_BASE_URL = os.getenv("TTS_BASE_URL", "")
TTS_API_KEY = os.getenv("TTS_API_KEY", "")


def llm_configured() -> bool:
    return bool(LLM_API_KEY)


def tts_configured() -> bool:
    return bool(TTS_API_KEY)
