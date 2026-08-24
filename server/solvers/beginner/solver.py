"""Beginner solver: MITM to SOLVED, tag steps with LBL stages.

ponytail: MITM + stage tags (not textbook algs). Swap to alg tables if teaching
fidelity needs real beginner sequences.
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
_U_CORNERS = [
    ((8, 9, 20), ("U", "R", "F")),
    ((6, 18, 38), ("U", "F", "L")),
    ((0, 36, 47), ("U", "L", "B")),
    ((2, 45, 11), ("U", "B", "R")),
]


def _ok_edge(f: str, idxs, colors) -> bool:
    return f[idxs[0]] == colors[0] and f[idxs[1]] == colors[1]


def _ok_corner(f: str, idxs, colors) -> bool:
    return f[idxs[0]] == colors[0] and f[idxs[1]] == colors[1] and f[idxs[2]] == colors[2]


def _all_edges(f, edges) -> bool:
    return all(_ok_edge(f, i, c) for i, c in edges)


def _all_corners(f, corners) -> bool:
    return all(_ok_corner(f, i, c) for i, c in corners)


def _stage_of(f: str) -> str:
    if f == SOLVED:
        return "last_layer_edges"
    if not _all_edges(f, _D_EDGES):
        return "cross"
    if not _all_corners(f, _D_CORNERS):
        return "first_layer_corners"
    if not _all_edges(f, _E_EDGES):
        return "second_layer"
    if not all(f[i] == "U" for i in (1, 3, 5, 7)):
        return "last_layer_cross"
    if not all(f[i] == "U" for i in (0, 2, 6, 8)):
        return "last_layer_corners_orient"
    if not _all_corners(f, _U_CORNERS):
        return "last_layer_corners_perm"
    return "last_layer_edges"


class BeginnerSolver:
    def solve(self, facelets: str) -> Solution:
        if facelets == SOLVED:
            return Solution(method="beginner", steps=[])

        try:
            moves = mitm_to_solved(facelets, max_depth=4)
        except RuntimeError:
            # Deep scramble: MITM range exhausted, fall back to Kociemba moves
            # (still tagged with LBL stages) so solving never hangs or fails.
            from solvers.kociemba import KociembaSolver

            moves = [s.move for s in KociembaSolver().solve(facelets).steps]
        steps: list[Step] = []
        state = facelets
        for m in moves:
            state = apply_move(state, m)
            stage = _stage_of(state)
            steps.append(Step(move=m, stage=stage, narration_key=stage))

        if state != SOLVED:
            raise RuntimeError("beginner: unfinished")
        return Solution(method="beginner", steps=steps)
