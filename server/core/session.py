"""Cube session: the single shared source of truth for the cube state."""

from __future__ import annotations

from dataclasses import asdict

from core.state import SOLVED, apply_move
from core.validate import normalize_centers, validate_state
from solvers import get_solver


class CubeSession:
    def __init__(self, facelets: str = SOLVED) -> None:
        if len(facelets) != 54:
            raise ValueError("facelets length must be 54")
        self.facelets = facelets

    def get_cube_state(self) -> str:
        return self.facelets

    def get_facelets(self) -> str:
        return self.facelets

    def validate_state(self, facelets: str | None = None) -> dict:
        ok, reason = validate_state(facelets if facelets is not None else self.facelets)
        out: dict = {"ok": ok}
        if reason is not None:
            out["reason"] = reason
        return out

    def validate(self, facelets: str | None = None) -> dict:
        return self.validate_state(facelets)

    def get_solution(self, method: str) -> dict:
        norm_state = normalize_centers(self.facelets)
        sol = get_solver(method).solve(norm_state)
        return {
            "method": sol.method,
            "steps": [asdict(step) for step in sol.steps],
        }

    def apply_move(self, move: str) -> str:
        self.facelets = apply_move(self.facelets, move)
        return self.facelets

    def set_state(self, facelets: str) -> str:
        ok, reason = validate_state(facelets)
        if not ok:
            raise ValueError(f"invalid state: {reason}")
        self.facelets = facelets
        return self.facelets


_shared_session = CubeSession(SOLVED)


def get_shared_session() -> CubeSession:
    """Return the process-wide shared cube session (the single state source).

    HTTP routes, the agent, and the MCP tools all use this instance, so the
    cube state never forks into multiple copies within one process.
    """
    return _shared_session
