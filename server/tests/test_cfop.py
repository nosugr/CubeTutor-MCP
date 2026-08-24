import random

import pytest

from core.state import SOLVED, apply_move
from solvers.cfop import CfopSolver

_ALLOWED = {"cross", "f2l", "oll", "pll"}


def _scramble(moves: list[str]) -> str:
    s = SOLVED
    for m in moves:
        s = apply_move(s, m)
    return s


def _assert_solves(scramble: list[str]) -> None:
    start = _scramble(scramble)
    sol = CfopSolver().solve(start)
    assert sol.method == "cfop"
    assert all(step.stage in _ALLOWED for step in sol.steps)
    s = start
    for step in sol.steps:
        s = apply_move(s, step.move)
    assert s == SOLVED


def test_solved_empty():
    assert CfopSolver().solve(SOLVED).steps == []


def test_scramble_a():
    _assert_solves(["R", "U", "R'", "U'"])


def test_scramble_b():
    _assert_solves(["F", "D", "F'", "L", "U2", "L'"])


def test_scramble_c():
    _assert_solves(["R", "U", "F'", "D", "L2", "B", "R'", "U'"])


def test_deep_scramble_falls_back_to_kociemba():
    # 20-step scramble is beyond MITM range; must fall back to Kociemba,
    # not hang. Returns CFOP-tagged steps that still solve the cube.
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
