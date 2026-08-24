"""State sync routes: /api/state, /api/scramble, /api/move."""

from __future__ import annotations

import random

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.session import get_shared_session
from core.state import SOLVED, apply_move
from core.validate import validate_state

router = APIRouter()

_session = get_shared_session()
_MOVES = [f + s for f in "URFDLB" for s in ("", "'", "2")]


class StateBody(BaseModel):
    facelets: str


class ScrambleBody(BaseModel):
    n: int = Field(default=25, ge=1, le=100)


class MoveBody(BaseModel):
    move: str


@router.get("/api/state")
def get_state() -> dict:
    return {"facelets": _session.get_cube_state()}


@router.post("/api/state")
def set_state(body: StateBody) -> dict:
    ok, reason = validate_state(body.facelets)
    if not ok:
        raise HTTPException(status_code=400, detail={"ok": False, "reason": reason})
    _session.set_state(body.facelets)
    return {"facelets": _session.get_cube_state()}


@router.post("/api/scramble")
def scramble(body: ScrambleBody | None = None) -> dict:
    n = 25 if body is None else body.n
    # start from solved so scramble is always valid
    facelets = SOLVED
    moves: list[str] = []
    last_face: str | None = None
    while len(moves) < n:
        m = random.choice(_MOVES)
        if m[0] == last_face:
            continue
        facelets = apply_move(facelets, m)
        moves.append(m)
        last_face = m[0]
    _session.set_state(facelets)
    return {"facelets": facelets, "moves": moves}


@router.post("/api/move")
def move(body: MoveBody) -> dict:
    try:
        facelets = _session.apply_move(body.move)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"facelets": facelets}
