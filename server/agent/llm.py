"""OpenAI-compatible LLM client for generating step narrations."""

from __future__ import annotations

import json

import httpx

from agent import config


async def request_narrations(method: str, steps: list[dict]) -> list[str] | None:
    """Ask the configured LLM for one short Chinese narration per step.

    Returns None when the LLM is not configured or the call/parsing fails,
    so callers can fall back to template narrations.
    """
    if not config.llm_configured():
        return None
    url = (config.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
    payload = {
        "model": config.LLM_MODEL or "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": "你是魔方教练。给每一步写一句很短的中文讲解。只返回 JSON 数组字符串。",
            },
            {
                "role": "user",
                "content": json.dumps({"method": method, "steps": steps}, ensure_ascii=False),
            },
        ],
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {config.LLM_API_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        if isinstance(data, list) and len(data) == len(steps):
            return [str(x) for x in data]
    except Exception:
        return None
    return None
