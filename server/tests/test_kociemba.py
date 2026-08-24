import pytest

from core.state import SOLVED, apply_move
from solvers.kociemba import KociembaSolver

pytest.importorskip("twophase")


def _scramble(moves: list[str]) -> str:
    s = SOLVED
    for m in moves:
        s = apply_move(s, m)
    return s


def test_kociemba_solved_empty():
    assert KociembaSolver().solve(SOLVED).steps == []


def test_kociemba_scramble():
    start = _scramble(["R", "U", "R'", "F'", "D", "L2"])
    sol = KociembaSolver().solve(start)
    assert sol.method == "kociemba"
    assert sol.steps
    assert all(step.stage == "kociemba" for step in sol.steps)
    s = start
    for step in sol.steps:
        s = apply_move(s, step.move)
    assert s == SOLVED
