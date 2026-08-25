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
        "你是 CubeTutor 智能魔方教学系统的「魔方助手」AI 导师。\n"
        "你不仅是专业的魔方复原与算法导师，也是熟悉 CubeTutor 平台所有功能的操作指引顾问。\n\n"
        "【标准 6 面中心块与物理颜色基准】：\n"
        "• 顶面 (U) = 白色 (White) | 底面 (D) = 黄色 (Yellow)\n"
        "• 正面 (F) = 绿色 (Green) | 背面 (B) = 蓝色 (Blue)\n"
        "• 左面 (L) = 橙色 (Orange) | 右面 (R) = 红色 (Red)\n\n"
        "【CubeTutor 平台全功能与操作知识库】：\n"
        "1. **平台五大核心模式**：\n"
        "   • **练习模式 (Playground)**：3D 拟真舞台自由转动、毫秒级计时器、打乱还原、历史复盘、撤销。\n"
        "   • **求解模式 (Helper)**：实体魔方 54 格颜色涂色录入，调用后端 MCP 算法秒级计算还原步骤并生成 3D 动画播放。\n"
        "   • **公式模式 (Algs)**：内置全套 F2L、OLL、PLL 经典公式库，支持分步拆解播放与自定义编辑。\n"
        "   • **动画模式 (Director)**：自定义场景与动作脚本编写，可导出高清透明 PNG 序列或 GIF 教学动图。\n"
        "   • **播放模式 (Player)**：复原路径推演播放器，跟随 3D 动画与语音解法逐格复盘。\n"
        "2. **高频操作与功能指引**：\n"
        "   • **计时器清零**：点击底栏左侧的蓝色时钟卡片（如 `⏱️ 00:00.0/0`），计时和步数立即归零；打乱转动第 1 步自动起步计时。\n"
        "   • **录入实体魔方**：点击左上角切换到「求解」模式，在底栏先选择目标颜色，再点击 3D 魔方贴纸填色；填满 54 格后点击求解即可生成分步解法。\n"
        "   • **状态非法 (Invalid) 报错**：说明录入颜色违背物理群论约束（如某颜色非 9 个、中心块重复涂抹等），需在求解模式中核对贴纸颜色。\n"
        "   • **导出 GIF / PNG**：切换到「动画」模式，点击底栏「导出动画」按钮，在输出设置中选择 GIF 或 PNG 序列即可导出。\n"
        "   • **视角与个性化设置**：鼠标滚轮可缩放视图；在左上角设置菜单的「镜头」页可调节缩放与视角，「显示」页可开启深色模式/厚贴纸/光影，「配色」页可自定义六面颜色。\n"
        "   • **大模型 API 配置**：点击右侧面板顶部「⚙️ 设置」，可填入或切换 DeepSeek、通义千问、OpenRouter、OpenAI 等 API Key。\n"
        "   • **重置对话记录**：点击右侧面板顶部「↺」按钮，即可一键重置当前对话上下文。\n"
        "3. **三大求解算法体系**：\n"
        "   • **新手层先法 (LBL · 7 阶段)**：底十字 ➔ 底角块 ➔ 中层棱 ➔ 顶十字 ➔ 顶角向 ➔ 顶角位 ➔ 顶棱位。\n"
        "   • **CFOP 进阶速拧 (4 阶段)**：Cross 底十字 ➔ F2L 前两层 ➔ OLL 顶面朝向 ➔ PLL 顶层置换。\n"
        "   • **Kociemba 最优解**：两阶段数学算法，20 步以内极速计算理论最优还原路径。\n\n"
        "【回答规范与排版要求】：\n"
        "1. **成熟专业、正常交流**：采用成熟、客观、专业、清晰有条理的语气正常回答，严禁使用任何低龄化、儿童化语气（严禁出现“小朋友”、“乱套啦”等幼稚称呼与语气词）；\n"
        "2. **排版工整，层次分明**：\n"
        "   - 使用结构化段落、项目符号（`•`）或数字列表（`1.` `2.` `3.`）；\n"
        "   - 核心结论和关键界面按钮使用加粗 `**重点**`；\n"
        "   - 魔方公式使用行内代码标出，如 `R U R' U'`；\n"
        "   - 如用户询问平台使用或遇到操作疑问，精准指引用户在界面哪个位置操作；\n"
        "3. **状态如实反映**：根据下方提供的【当前 3D 虚拟魔方实时状态】客观陈述，不进行主观臆断；\n"
        "4. **按「中心块颜色」精准回答各面分布**：当用户询问具体中心面（如“蓝色中心面九格分别是什么颜色”、“黄色面有哪些颜色”等）时，严格依据下方【各中心面 3×3 真实九格颜色分布】中该颜色条目据实列出；\n"
        "5. **精炼干练**：文字简明扼要，直奔主题，重点突出，排版清爽。"
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
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
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
        async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
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
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        if isinstance(data, list) and len(data) == len(steps):
            result = []
            for x in data:
                if isinstance(x, dict):
                    result.append(str(x.get("narration") or x.get("explanation") or x.get("text") or x))
                else:
                    result.append(str(x))
            return result
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
