import os
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def _load_env_file() -> None:
    if _ENV_FILE.exists():
        with open(_ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    os.environ[k] = v


_load_env_file()

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")
TTS_BASE_URL = os.getenv("TTS_BASE_URL", "")
TTS_API_KEY = os.getenv("TTS_API_KEY", "")


def get_config() -> dict:
    return {
        "llm_base_url": LLM_BASE_URL,
        "llm_api_key": LLM_API_KEY,
        "llm_model": LLM_MODEL,
        "tts_base_url": TTS_BASE_URL,
        "tts_api_key": TTS_API_KEY,
        "llm_configured": llm_configured(),
        "tts_configured": tts_configured(),
    }


def update_config(
    llm_base_url: str | None = None,
    llm_api_key: str | None = None,
    llm_model: str | None = None,
    tts_base_url: str | None = None,
    tts_api_key: str | None = None,
) -> dict:
    global LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, TTS_BASE_URL, TTS_API_KEY
    if llm_base_url is not None:
        LLM_BASE_URL = llm_base_url.strip()
        os.environ["LLM_BASE_URL"] = LLM_BASE_URL
    if llm_api_key is not None:
        LLM_API_KEY = llm_api_key.strip()
        os.environ["LLM_API_KEY"] = LLM_API_KEY
    if llm_model is not None:
        LLM_MODEL = llm_model.strip()
        os.environ["LLM_MODEL"] = LLM_MODEL
    if tts_base_url is not None:
        TTS_BASE_URL = tts_base_url.strip()
        os.environ["TTS_BASE_URL"] = TTS_BASE_URL
    if tts_api_key is not None:
        TTS_API_KEY = tts_api_key.strip()
        os.environ["TTS_API_KEY"] = TTS_API_KEY

    # Persist to .env file
    lines = [
        f"LLM_BASE_URL={LLM_BASE_URL}\n",
        f"LLM_API_KEY={LLM_API_KEY}\n",
        f"LLM_MODEL={LLM_MODEL}\n",
        f"TTS_BASE_URL={TTS_BASE_URL}\n",
        f"TTS_API_KEY={TTS_API_KEY}\n",
    ]
    try:
        with open(_ENV_FILE, "w", encoding="utf-8") as f:
            f.writelines(lines)
    except Exception:
        pass

    return get_config()


def llm_configured() -> bool:
    return bool(LLM_API_KEY)


def tts_configured() -> bool:
    return bool(TTS_API_KEY)
