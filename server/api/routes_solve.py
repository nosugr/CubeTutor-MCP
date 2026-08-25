"""Solve, agent narration, TTS, and streaming chat routes."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from agent import tts as tts_mod
from agent.agent import Agent
from core.session import get_shared_session
from core.state import SOLVED

router = APIRouter()


class SolveBody(BaseModel):
    method: str


@router.post("/api/solve")
def solve(body: SolveBody) -> dict:
    try:
        return get_shared_session().get_solution(body.method)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/api/solve_with_agent")
async def solve_with_agent(body: SolveBody) -> dict:
    try:
        agent = Agent()
        out = await agent.solve_with_narration(body.method)
        return {"method": out["method"], "steps": out["steps"], "tool_calls": out.get("tool_calls", [])}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


class ChatBody(BaseModel):
    message: str
    facelets: str | None = None
    method: str | None = "beginner"


@router.post("/api/agent/stream_chat")
async def stream_agent_chat(body: ChatBody) -> StreamingResponse:
    """Streaming chat endpoint yielding Server-Sent Events (SSE)."""
    from agent import config
    from agent.llm import request_chat_stream

    msg = body.message.strip()
    msg_lower = msg.lower()
    method = body.method or "beginner"
    session = get_shared_session()

    # Sync real-time 3D cube facelets state from client
    if body.facelets and len(body.facelets) == 54:
        session.facelets = body.facelets

    async def event_generator():
        # Check if user requests solving or tutorial
        if any(k in msg_lower for k in ["求解", "还原", "教我", "怎么解", "开始教学", "解法", "帮我解", "solve", "help"]):
            try:
                agent = Agent()
                out = await agent.solve_with_narration(method)
                method_names = {
                    "beginner": "新手层先法（7阶段）",
                    "cfop": "CFOP进阶法（4阶段）",
                    "kociemba": "Kociemba最优解（20步）",
                }
                chosen_name = method_names.get(method, method)
                first_step = out["steps"][0] if out["steps"] else None
                narration_preview = first_step["narration"] if first_step else "准备就绪"

                text = f"已通过 MCP 协议调取【{chosen_name}】求解器！\n共计算出 {len(out['steps'])} 步还原路径。\n\n👉 第一步：{narration_preview}，点击下方控制条即可逐步播放学习！"
                init_event = {
                    "type": "start",
                    "emotionId": "34",
                    "tool_calls": out.get("tool_calls", ["get_cube_state", "validate_state", "get_solution"]),
                    "solution": out,
                }
                yield f"data: {json.dumps(init_event, ensure_ascii=False)}\n\n"

                for char in text:
                    yield f"data: {json.dumps({'type': 'token', 'chunk': char}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.015)

                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                return
            except Exception as e:
                err_event = {
                    "type": "start",
                    "emotionId": "32",
                    "tool_calls": ["get_cube_state"],
                }
                yield f"data: {json.dumps(err_event, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'token', 'chunk': f'求解发生异常：{str(e)}'}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                return

        # Check explicit legality check query
        if any(k in msg_lower for k in ["检查合法性", "校验合法", "是否合法", "合法性校验", "检查魔方合法"]):
            try:
                val = session.validate()
                if val.get("ok"):
                    text = "当前魔方状态校验通过 (Valid)！\n54 格面块置换与朝向均符合数学群论物理约束，可正常求解。"
                    em = "10"
                else:
                    text = f"当前魔方状态非法 (Invalid)：{val.get('reason')}，请在录入界面调整贴纸颜色。"
                    em = "32"
                yield f"data: {json.dumps({'type': 'start', 'emotionId': em, 'tool_calls': ['get_cube_state', 'validate_state']}, ensure_ascii=False)}\n\n"
                for char in text:
                    yield f"data: {json.dumps({'type': 'token', 'chunk': char}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.015)
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                return
            except Exception as e:
                yield f"data: {json.dumps({'type': 'start', 'emotionId': '32', 'tool_calls': ['get_cube_state']}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'token', 'chunk': f'状态检查失败：{str(e)}'}, ensure_ascii=False)}\n\n"
                yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"
                return

        # Real LLM Streaming with accurate real-time cube context
        current_state = session.facelets
        is_solved = current_state == SOLVED
        cube_info = (
            f"魔方当前是否已完全复原: {'是 (已完全复原 Solved)' if is_solved else '否 (打乱未复原 Scrambled)'}\n"
            f"当前 54 表面块状态编码: {current_state}"
        )

        is_state_query = any(
            k in msg_lower
            for k in [
                "读取魔方状态",
                "读取状态",
                "获取魔方状态",
                "获取状态",
                "魔方当前是什么样",
                "魔方当前状态",
                "魔方状态",
                "当前魔方状态",
                "当前状态",
                "现在的魔方",
                "魔方情况",
                "查看魔方",
            ]
        )

        start_event: dict = {
            "type": "start",
            "emotionId": "10" if is_solved else "02",
        }
        if is_state_query:
            start_event["tool_calls"] = ["get_cube_state"]

        yield f"data: {json.dumps(start_event, ensure_ascii=False)}\n\n"

        async for event in request_chat_stream(msg, cube_context=cube_info):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/agent/chat")
async def agent_chat(body: ChatBody) -> dict:
    """Agent conversational dispatch with step-by-step solver and LLM integration."""
    from agent import config
    from agent.llm import request_chat_completion

    msg = body.message.strip()
    msg_lower = msg.lower()
    method = body.method or "beginner"
    session = get_shared_session()

    # Sync real-time 3D cube facelets state from client
    if body.facelets and len(body.facelets) == 54:
        session.facelets = body.facelets

    # Check solve request
    if any(k in msg_lower for k in ["求解", "还原", "教我", "怎么解", "开始教学", "解法", "帮我解", "solve", "help"]):
        try:
            agent = Agent()
            out = await agent.solve_with_narration(method)
            method_names = {
                "beginner": "新手层先法（7阶段）",
                "cfop": "CFOP进阶法（4阶段）",
                "kociemba": "Kociemba最优解（20步）",
            }
            chosen_name = method_names.get(method, method)
            first_step = out["steps"][0] if out["steps"] else None
            narration_preview = first_step["narration"] if first_step else "准备就绪"

            reply = f"已通过 MCP 协议调取【{chosen_name}】求解器！\n共计算出 {len(out['steps'])} 步还原路径。\n\n👉 第一步：{narration_preview}，点击下方控制条即可逐步播放学习！"
            return {
                "reply": reply,
                "emotionId": "34",
                "tool_calls": out.get("tool_calls", ["get_cube_state", "validate_state", "get_solution"]),
                "solution": out,
            }
        except Exception as e:
            return {
                "reply": f"求解发生异常：{str(e)}",
                "emotionId": "32",
                "tool_calls": ["get_cube_state"],
            }

    # Check explicit legality check
    if any(k in msg_lower for k in ["检查合法性", "校验合法", "是否合法", "合法性校验", "检查魔方合法"]):
        try:
            val = session.validate()
            if val.get("ok"):
                return {
                    "reply": "当前魔方状态校验通过 (Valid)！\n54 格面块置换与朝向均符合数学群论物理约束，可正常求解。",
                    "emotionId": "10",
                    "tool_calls": ["get_cube_state", "validate_state"],
                }
            else:
                return {
                    "reply": f"当前魔方状态非法 (Invalid)：{val.get('reason')}，请在录入界面调整贴纸颜色。",
                    "emotionId": "32",
                    "tool_calls": ["get_cube_state", "validate_state"],
                }
        except Exception as e:
            return {
                "reply": f"状态检查失败：{str(e)}",
                "emotionId": "32",
                "tool_calls": ["get_cube_state"],
            }

    # Real LLM Conversation for ALL other queries/chat
    current_state = session.facelets
    is_solved = current_state == SOLVED
    cube_info = (
        f"魔方当前是否已完全复原: {'是 (已完全复原 Solved)' if is_solved else '否 (打乱未复原 Scrambled)'}\n"
        f"当前 54 表面块状态编码: {current_state}"
    )

    is_state_query = any(
        k in msg_lower
        for k in [
            "读取魔方状态",
            "读取状态",
            "获取魔方状态",
            "获取状态",
            "魔方当前是什么样",
            "魔方当前状态",
            "魔方状态",
            "当前魔方状态",
            "当前状态",
            "现在的魔方",
            "魔方情况",
            "查看魔方",
        ]
    )

    if config.llm_configured():
        llm_reply = await request_chat_completion(msg, cube_context=cube_info)
        if llm_reply:
            res = {
                "reply": llm_reply,
                "emotionId": "10" if is_solved else "02",
            }
            if is_state_query:
                res["tool_calls"] = ["get_cube_state"]
            return res

    # If LLM is not configured, give a friendly guidance
    return {
        "reply": f"收到你的消息：“{msg}”。\n\n我是你的「魔方助手」🤖！\n💡 你可以在右上角「⚙️ 设置」中填入你的大模型 API Key（支持 DeepSeek、OpenAI、OpenRouter 等），我就能像正常的大模型一样陪你自由聊天、解答任何魔方或技巧问题啦！\n\n现在你也可以直接点击下方指令体验层先法/CFOP分步还原教学！",
        "emotionId": "02",
    }


class ConfigBody(BaseModel):
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    tts_base_url: str | None = None
    tts_api_key: str | None = None


@router.get("/api/agent/config")
def get_agent_config() -> dict:
    from agent import config

    return config.get_config()


@router.post("/api/agent/config")
def set_agent_config(body: ConfigBody) -> dict:
    from agent import config

    return config.update_config(
        llm_base_url=body.llm_base_url,
        llm_api_key=body.llm_api_key,
        llm_model=body.llm_model,
        tts_base_url=body.tts_base_url,
        tts_api_key=body.tts_api_key,
    )


class TestLlmBody(BaseModel):
    llm_base_url: str | None = ""
    llm_api_key: str | None = ""
    llm_model: str | None = ""


@router.post("/api/agent/test_llm")
async def test_llm_route(body: TestLlmBody) -> dict:
    from agent.llm import test_llm_connection

    return await test_llm_connection(
        base_url=body.llm_base_url or "",
        api_key=body.llm_api_key or "",
        model=body.llm_model or "",
    )


class ListModelsBody(BaseModel):
    llm_base_url: str | None = ""
    llm_api_key: str | None = ""


@router.post("/api/agent/list_models")
async def list_models_route(body: ListModelsBody) -> dict:
    from agent.llm import fetch_available_models

    return await fetch_available_models(
        base_url=body.llm_base_url or "",
        api_key=body.llm_api_key or "",
    )


@router.get("/api/tts")
def tts(text: str = "") -> Response:
    audio = tts_mod.synthesize(text)
    if not audio:
        return Response(status_code=204)
    return Response(content=audio, media_type="audio/mpeg")
