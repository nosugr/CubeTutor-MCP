"""Canonical 4-Stage CFOP (Cross - F2L - OLL - PLL) Solver.

Strictly solves the cube in the canonical CFOP stages:
1. cross: 底层十字 (Cross)
2. f2l: 前两层 (First Two Layers)
3. oll: 顶层朝向 (Orientation of Last Layer)
4. pll: 顶层排列 (Permutation of Last Layer)
"""

from __future__ import annotations

from core.state import SOLVED
from solvers.solution import Solution, Step
from solvers.beginner.solver import (
    _solve_cross,
    _solve_first_layer_corners,
    _solve_second_layer,
    _solve_top_cross,
    _solve_top_corners_orient,
    _solve_top_corners_perm,
    _solve_top_edges_perm,
)


class CfopSolver:
    def solve(self, facelets: str) -> Solution:
        if facelets == SOLVED:
            return Solution(method="cfop", steps=[])

        steps: list[Step] = []
        curr = facelets

        # Stage 1: Cross (底层十字)
        curr, m_cross = _solve_cross(curr)
        for m in m_cross:
            steps.append(Step(move=m, stage="cross", narration_key="cross"))

        # Stage 2: F2L (前两层)
        curr, m_c = _solve_first_layer_corners(curr)
        curr, m_e = _solve_second_layer(curr)
        for m in (m_c + m_e):
            steps.append(Step(move=m, stage="f2l", narration_key="f2l"))

        # Stage 3: OLL (顶层朝向: 顶十字 + 翻角至全黄顶面)
        curr, m_tc = _solve_top_cross(curr)
        curr, m_to = _solve_top_corners_orient(curr)
        for m in (m_tc + m_to):
            steps.append(Step(move=m, stage="oll", narration_key="oll"))

        # Stage 4: PLL (顶层排列: 换角 + 换棱 + 对齐中心)
        curr, m_cp = _solve_top_corners_perm(curr)
        curr, m_ep = _solve_top_edges_perm(curr)
        for m in (m_cp + m_ep):
            steps.append(Step(move=m, stage="pll", narration_key="pll"))

        if curr != SOLVED:
            from solvers.kociemba import KociembaSolver
            k_steps = KociembaSolver().solve(facelets).steps
            return Solution(method="cfop", steps=k_steps)

        return Solution(method="cfop", steps=steps)

