from __future__ import annotations

from typing import Protocol

from solvers.solution import Solution


class Solver(Protocol):
    def solve(self, facelets: str) -> Solution: ...
