"""Solve, agent narration, and TTS routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from agent import tts as tts_mod
from agent.agent import Agent
from core.session import get_shared_session

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
        return {"method": out["method"], "steps": out["steps"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/api/tts")
def tts(text: str = "") -> Response:
    audio = tts_mod.synthesize(text)
    if not audio:
        return Response(status_code=204)
    return Response(content=audio, media_type="audio/mpeg")
