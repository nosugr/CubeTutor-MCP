"""Agent that narrates a solve by driving the four cube tools over MCP.

Every tool call goes through the real MCP JSON-RPC protocol (in-process
in-memory transport). `tool_calls` records each protocol-level call.
"""

from __future__ import annotations

from typing import Any, Callable

from agent import mcp_client
from agent.llm import request_narrations


STAGE_CN = {
    "cross": "十字",
    "first_layer_corners": "底层角块",
    "second_layer": "二层",
    "last_layer_cross": "顶层十字",
    "last_layer_corners_orient": "顶层角向",
    "last_layer_corners_perm": "顶层角位",
    "last_layer_edges": "顶层棱块",
    "f2l": "F2L",
    "oll": "OLL",
    "pll": "PLL",
    "kociemba": "Kociemba",
}


def template_narration(method: str, stage: str, move: str) -> str:
    stage_cn = STAGE_CN.get(stage, stage)
    return f"{method}·{stage_cn}：执行 {move}"


class Agent:
    """Drives the four MCP cube tools, then fills in narrations."""

    def __init__(self, llm: Callable[..., Any] | None = None) -> None:
        self.llm = llm
        self.tool_calls: list[str] = []

    async def solve_with_narration(self, method: str) -> dict:
        self.tool_calls.clear()
        async with mcp_client.connect() as session:

            async def call(name: str, **arguments) -> Any:
                self.tool_calls.append(name)
                return await mcp_client.call_tool(session, name, arguments or None)

            state = await call("get_cube_state")
            val = await call("validate_state", facelets=state)
            if not val.get("ok"):
                raise ValueError(f"invalid cube: {val.get('reason')}")

            sol = await call("get_solution", method=method)
            steps = sol["steps"]

            # Replay on a scratch copy via stateless apply_move so the shared
            # session keeps the scrambled state for the frontend player.
            scratch = state
            for step in steps:
                scratch = await call("apply_move", move=step["move"], facelets=scratch)

        if self.llm is not None:
            narrations = self.llm(method, steps)
        else:
            narrations = await request_narrations(method, steps)

        out_steps = []
        for i, step in enumerate(steps):
            narration = (
                narrations[i]
                if narrations and i < len(narrations)
                else template_narration(method, step["stage"], step["move"])
            )
            out_steps.append({**step, "narration": narration})

        return {"method": method, "steps": out_steps, "tool_calls": list(self.tool_calls)}
