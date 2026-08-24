from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Step:
    move: str
    stage: str
    narration_key: str


@dataclass(frozen=True)
class Solution:
    method: str
    steps: list[Step]
