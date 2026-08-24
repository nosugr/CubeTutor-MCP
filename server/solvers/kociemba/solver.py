"""Kociemba two-phase wrapper around RubikTwoPhase."""

from __future__ import annotations

from pathlib import Path

from core.state import SOLVED
from solvers.solution import Solution, Step

_TABLES_DIR = Path(__file__).resolve().parent / "tables"

_MOVE_MAP = {
    "1": "",
    "2": "2",
    "3": "'",
}


def _parse_formula(formula: str) -> list[str]:
    # e.g. "U1 R2 F3 (12f)" — Move enum names from RubikTwoPhase
    text = formula.split("(")[0].strip()
    if not text or text.lower().startswith("error") or "Error" in formula:
        raise RuntimeError(f"kociemba: bad formula {formula!r}")
    moves: list[str] = []
    for tok in text.split():
        if len(tok) < 2 or tok[0] not in "URFDLB" or tok[1] not in _MOVE_MAP:
            raise RuntimeError(f"kociemba: bad token {tok!r} in {formula!r}")
        moves.append(tok[0] + _MOVE_MAP[tok[1]])
    if not moves:
        raise RuntimeError(f"kociemba: no moves in {formula!r}")
    return moves


class KociembaSolver:
    def solve(self, facelets: str) -> Solution:
        if facelets == SOLVED:
            return Solution(method="kociemba", steps=[])

        try:
            from twophase import defs as twophase_defs

            _TABLES_DIR.mkdir(parents=True, exist_ok=True)
            twophase_defs.FOLDER = str(_TABLES_DIR)
            from twophase.solver import solve as twophase_solve
        except ImportError as e:
            raise RuntimeError("kociemba: install RubikTwoPhase") from e

        formula = twophase_solve(facelets, max_length=20, timeout=3)
        if not isinstance(formula, str) or "f)" not in formula:
            raise RuntimeError(f"kociemba: {formula!r}")

        moves = _parse_formula(formula)
        steps = [Step(move=m, stage="kociemba", narration_key="kociemba") for m in moves]
        return Solution(method="kociemba", steps=steps)
