import random

import pytest

from core.state import SOLVED, apply_move
from solvers.beginner import BeginnerSolver


def _scramble(moves: list[str]) -> str:
    s = SOLVED
    for m in moves:
        s = apply_move(s, m)
    return s


def _assert_solves(scramble: list[str]) -> None:
    start = _scramble(scramble)
    sol = BeginnerSolver().solve(start)
    assert sol.method == "beginner"
    s = start
    for step in sol.steps:
        s = apply_move(s, step.move)
    assert s == SOLVED


def test_solved_returns_empty():
    sol = BeginnerSolver().solve(SOLVED)
    assert sol.steps == []


def test_scramble_a():
    _assert_solves(["R", "U", "R'", "U'"])


def test_scramble_b():
    _assert_solves(["F", "D", "F'", "L", "U2", "L'"])


def test_scramble_c():
    _assert_solves(["R", "U", "F'", "D", "L2", "B", "R'", "U'"])


def test_deep_scramble_falls_back_to_kociemba():
    # 20-step scramble is beyond MITM range; must fall back to Kociemba,
    # not hang. Returns LBL-tagged steps that still solve the cube.
    pytest.importorskip("twophase")
    rng = random.Random(20260823)
    moves: list[str] = []
    last: str | None = None
    while len(moves) < 20:
        m = rng.choice([f + s for f in "URFDLB" for s in ("", "'", "2")])
        if m[0] == last:
            continue
        moves.append(m)
        last = m[0]
    _assert_solves(moves)
