"""OpenAI-compatible LLM client for generating step narrations, real-time conversation, streaming, and reasoning support."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
import json

import httpx

from agent import config

# Standard headers including OpenRouter compatibility
_COMMON_HEADERS = {
    "HTTP-Referer": "https://cubetutor.app",
    "X-Title": "CubeTutor AI",
}

# Domain-specific fallback models when provider doesn't support /models endpoint
_FALLBACK_MODELS_MAP: dict[str, list[str]] = {
    "dashscope.aliyuncs.com": [
        "qwen-turbo",
        "qwen-plus",
        "qwen-max",
        "qwen-long",
        "qwen2.5-72b-instruct",
        "qwen2.5-32b-instruct",
    ],
    "deepseek.com": [
        "deepseek-chat",
        "deepseek-reasoner",
    ],
    "openrouter.ai": [
        "deepseek/deepseek-chat",
        "deepseek/deepseek-r1",
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "google/gemini-2.0-flash-001",
        "anthropic/claude-3.5-sonnet",
        "meta-llama/llama-3.3-70b-instruct",
        "qwen/qwen-2.5-72b-instruct",
    ],
    "siliconflow.cn": [
        "deepseek-ai/DeepSeek-V3",
        "deepseek-ai/DeepSeek-R1",
        "Qwen/Qwen2.5-72B-Instruct",
        "Qwen/Qwen2.5-32B-Instruct",
        "THUDM/glm-4-9b-chat",
    ],
    "moonshot.cn": [
        "moonshot-v1-8k",
        "moonshot-v1-32k",
        "moonshot-v1-128k",
    ],
}


def _build_system_prompt(cube_context: str | None = None) -> str:
    prompt = (
        "你是 CubeTutor 智能魔方平台的「魔方助手」。\n\n"
        "【回答准则与排版要求】：\n"
        "1. **精简干练，拒绝废话**：严禁冗长客套、废话与机械式开场白，直接直奔核心主题与解决方案；\n"
        "2. **排版优美清晰**：\n"
        "   - 核心重点与结论使用加粗 `**重点**` 标出；\n"
        "   - 涉及魔方公式或转动代号时必须使用行内代码标出，例如 `R U R' U'`；\n"
        "   - 分步骤使用编号列表 `1.` `2.` 或项目符号 `•` 进行清晰分段；\n"
        "3. **魔方状态实时感知**：系统已在下方提供【当前 3D 虚拟魔方实时状态】（包括是否已复原或打乱）。当用户询问魔方是否复原、当前状态或如何还原时，必须根据该实时信息据实回答，不可胡乱假设；\n"
        "4. **专业准确**：精通三阶魔方解法（新手层先法 7 阶段、CFOP 速拧、Kociemba 最优解）与手法要领；\n"
        "5. **控制篇幅**：除非用户明确要求长篇理论推导，否则每次回答尽量保持在 80~180 字内，简明精要。"
    )
    if cube_context:
        prompt += f"\n\n【当前 3D 虚拟魔方实时状态】：\n{cube_context}"
    return prompt


async def request_chat_stream(
    message: str,
    cube_context: str | None = None,
    history: list[dict] | None = None,
) -> AsyncGenerator[dict, None]:
    """Stream response tokens and reasoning/thinking process from the configured LLM."""
    if not config.llm_configured():
        guidance = (
            f"收到你的消息：“{message}”。\n\n"
            "我是你的「魔方助手」🤖！\n"
            "💡 请在右上角「⚙️ 设置」中配置您的大模型 API Key（支持 DeepSeek、OpenAI、OpenRouter、通义千问等），配置后即可享受极速流式实时智能回答与深度思考！\n\n"
            "现在你也可以随时点击下方快捷指令体验魔方分步教学～"
        )
        for char in guidance:
            yield {"type": "token", "chunk": char}
            await asyncio.sleep(0.01)
        return

    url = (config.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
    model = config.LLM_MODEL or "gpt-4o-mini"
    system_prompt = _build_system_prompt(cube_context)

    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "stream": True,
    }
    headers = {
        "Authorization": f"Bearer {config.LLM_API_KEY}",
        **_COMMON_HEADERS,
    }

    try:
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as resp:
                if resp.status_code != 200:
                    err_bytes = await resp.aread()
                    yield {
                        "type": "token",
                        "chunk": f"大模型接口请求异常 ({resp.status_code}): {err_bytes.decode('utf-8', errors='ignore')}",
                    }
                    return

                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        line_data = line[6:].strip()
                        if line_data == "[DONE]":
                            break
                        try:
                            chunk_json = json.loads(line_data)
                            delta = chunk_json["choices"][0].get("delta", {})
                            reasoning = delta.get("reasoning_content") or delta.get("reasoning")
                            content = delta.get("content")
                            if reasoning:
                                yield {"type": "reasoning", "chunk": reasoning}
                            if content:
                                yield {"type": "token", "chunk": content}
                        except Exception:
                            continue
    except Exception as e:
        yield {"type": "token", "chunk": f"连接大模型发生异常：{str(e)}"}


async def request_chat_completion(
    message: str,
    cube_context: str | None = None,
    history: list[dict] | None = None,
) -> str | None:
    """Call the configured LLM for natural, intelligent conversation and Q&A."""
    if not config.llm_configured():
        return None

    url = (config.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
    model = config.LLM_MODEL or "gpt-4o-mini"
    system_prompt = _build_system_prompt(cube_context)

    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
    }
    headers = {
        "Authorization": f"Bearer {config.LLM_API_KEY}",
        **_COMMON_HEADERS,
    }

    try:
        async with httpx.AsyncClient(timeout=35.0, follow_redirects=True) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[LLM Chat Error]: {e}")
        return None


async def request_narrations(method: str, steps: list[dict]) -> list[str] | None:
    """Ask the configured LLM for one short Chinese narration per step."""
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
    headers = {
        "Authorization": f"Bearer {config.LLM_API_KEY}",
        **_COMMON_HEADERS,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        if isinstance(data, list) and len(data) == len(steps):
            return [str(x) for x in data]
    except Exception:
        return None
    return None


async def test_llm_connection(base_url: str = "", api_key: str = "", model: str = "") -> dict:
    """Live ping test for an LLM provider and API key."""
    url = (base_url or config.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
    key = api_key or config.LLM_API_KEY
    mod = model or config.LLM_MODEL or "gpt-4o-mini"
    if not key:
        return {"ok": False, "error": "API Key 不能为空"}

    payload = {
        "model": mod,
        "messages": [
            {"role": "user", "content": "请只回复两个字：连接成功"},
        ],
        "max_tokens": 20,
    }
    headers = {
        "Authorization": f"Bearer {key}",
        **_COMMON_HEADERS,
    }
    try:
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            return {"ok": True, "reply": content.strip(), "model": mod}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def fetch_available_models(base_url: str = "", api_key: str = "") -> dict:
    """Auto-detect available models from the provider via /models endpoint with smart fallback."""
    raw_base = (base_url or config.LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
    key = api_key or config.LLM_API_KEY
    if not key:
        return {"ok": False, "error": "请先输入 API Key 才能检测模型"}

    headers = {
        "Authorization": f"Bearer {key}",
        **_COMMON_HEADERS,
    }

    # Identify domain for smart fallback
    domain_match = None
    for domain, fallback_list in _FALLBACK_MODELS_MAP.items():
        if domain in raw_base.lower():
            domain_match = fallback_list
            break

    url = raw_base + "/models"
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
            if r.status_code == 200:
                data = r.json()
                raw_models = data.get("data", [])
                model_ids: list[str] = []
                if isinstance(raw_models, list):
                    for item in raw_models:
                        if isinstance(item, dict) and "id" in item:
                            model_ids.append(str(item["id"]))
                        elif isinstance(item, str):
                            model_ids.append(str(item))

                # Filter out irrelevant non-chat models
                filtered = [
                    m
                    for m in model_ids
                    if not any(
                        x in m.lower()
                        for x in [
                            "embedding",
                            "whisper",
                            "tts",
                            "dall-e",
                            "moderation",
                            "davinci-002",
                            "babbage-002",
                            "embed",
                            "rerank",
                        ]
                    )
                ]
                final_models = filtered if filtered else model_ids
                if final_models:
                    return {"ok": True, "models": sorted(final_models)}

            # If provider endpoint returned 404 or other status, use domain fallback if available
            if domain_match:
                return {
                    "ok": True,
                    "models": domain_match,
                    "note": "该提供商接口未开放 /models 查询，已自动加载官方常用模型列表",
                }

            return {
                "ok": False,
                "error": f"服务商接口返回状态码 {r.status_code}，请直接手动在输入框填写模型名称",
            }
    except Exception as e:
        # If network error but we have domain fallback, provide it
        if domain_match:
            return {
                "ok": True,
                "models": domain_match,
                "note": f"网络拉取受阻（{str(e)}），已自动提供常用预设模型",
            }
        return {
            "ok": False,
            "error": f"拉取失败（{str(e)}），请检查网络连接或手动输入模型名",
        }
