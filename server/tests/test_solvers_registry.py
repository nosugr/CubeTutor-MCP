import pytest

from core.state import SOLVED, apply_move
from solvers import get_solver


def _scramble(moves: list[str]) -> str:
    s = SOLVED
    for m in moves:
        s = apply_move(s, m)
    return s


@pytest.mark.parametrize("name", ["beginner", "cfop", "kociemba"])
def test_get_solver_solves(name: str):
    start = _scramble(["R", "U", "R'", "U'"])
    sol = get_solver(name).solve(start)
    s = start
    for step in sol.steps:
        s = apply_move(s, step.move)
    assert s == SOLVED
    assert sol.method == name


def test_unknown_solver():
    with pytest.raises(ValueError, match="unknown solver"):
        get_solver("nope")
