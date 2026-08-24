from __future__ import annotations

from solvers.base import Solver
from solvers.beginner import BeginnerSolver
from solvers.cfop import CfopSolver
from solvers.kociemba import KociembaSolver

_REGISTRY: dict[str, type] = {
    "beginner": BeginnerSolver,
    "cfop": CfopSolver,
    "kociemba": KociembaSolver,
}


def get_solver(name: str) -> Solver:
    try:
        cls = _REGISTRY[name]
    except KeyError as e:
        known = ", ".join(sorted(_REGISTRY))
        raise ValueError(f"unknown solver {name!r}; expected one of: {known}") from e
    return cls()
