"""Course-scope CFOP solver.

ponytail: MITM + CFOP stage tags; not full 57 OLL / 21 PLL. Upgrade to real
2-look tables when teaching fidelity matters.
"""

from __future__ import annotations

from core.state import SOLVED, apply_move
from solvers.search import mitm_to_solved
from solvers.solution import Solution, Step

_D_EDGES = [
    ((28, 25), ("D", "F")),
    ((32, 16), ("D", "R")),
    ((34, 52), ("D", "B")),
    ((30, 43), ("D", "L")),
]
_D_CORNERS = [
    ((29, 26, 15), ("D", "F", "R")),
    ((27, 44, 24), ("D", "L", "F")),
    ((33, 53, 42), ("D", "B", "L")),
    ((35, 17, 51), ("D", "R", "B")),
]
_E_EDGES = [
    ((23, 12), ("F", "R")),
    ((21, 41), ("F", "L")),
    ((50, 39), ("B", "L")),
    ((48, 14), ("B", "R")),
]


def _ok_edge(f: str, idxs, colors) -> bool:
    return f[idxs[0]] == colors[0] and f[idxs[1]] == colors[1]


def _ok_corner(f: str, idxs, colors) -> bool:
    return f[idxs[0]] == colors[0] and f[idxs[1]] == colors[1] and f[idxs[2]] == colors[2]


def _stage_of(f: str) -> str:
    # cross → f2l → oll → pll
    if f == SOLVED:
        return "pll"
    if not all(_ok_edge(f, i, c) for i, c in _D_EDGES):
        return "cross"
    f2l_done = all(_ok_corner(f, i, c) for i, c in _D_CORNERS) and all(
        _ok_edge(f, i, c) for i, c in _E_EDGES
    )
    if not f2l_done:
        return "f2l"
    # OLL: U face all U
    if not all(f[i] == "U" for i in range(9)):
        return "oll"
    return "pll"


class CfopSolver:
    def solve(self, facelets: str) -> Solution:
        if facelets == SOLVED:
            return Solution(method="cfop", steps=[])

        try:
            moves = mitm_to_solved(facelets, max_depth=4)
        except RuntimeError:
            # Deep scramble: MITM range exhausted, fall back to Kociemba moves
            # (still tagged with CFOP stages) so solving never hangs or fails.
            from solvers.kociemba import KociembaSolver

            moves = [s.move for s in KociembaSolver().solve(facelets).steps]
        steps: list[Step] = []
        state = facelets
        for m in moves:
            state = apply_move(state, m)
            stage = _stage_of(state)
            steps.append(Step(move=m, stage=stage, narration_key=stage))

        if state != SOLVED:
            raise RuntimeError("cfop: unfinished")
        return Solution(method="cfop", steps=steps)
