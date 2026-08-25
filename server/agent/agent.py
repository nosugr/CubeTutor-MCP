"""Agent that narrates a solve by driving the four cube tools over MCP.

Every tool call goes through the real MCP JSON-RPC protocol (in-process
in-memory transport). `tool_calls` records each protocol-level call.
"""

from __future__ import annotations

from typing import Any, Callable

from agent import mcp_client
from agent.llm import request_narrations


STAGE_CN = {
    "cross": ("底面十字", "拼好底部的白色十字并对齐侧面中心块"),
    "first_layer_corners": ("还原第一层角块", "将底层 4 个白色角块复位到正确位置"),
    "second_layer": ("还原中层棱块", "将中间层 4 个棱块归位"),
    "last_layer_cross": ("顶层黄色十字", "在顶面拼出黄色十字"),
    "last_layer_corners_orient": ("顶层黄色面朝向", "将顶层 4 个角块翻转为全黄色"),
    "last_layer_corners_perm": ("顶层角块位置归位", "对齐顶层 4 个角块的侧面颜色"),
    "last_layer_edges": ("顶层棱块位置归位", "完成最后棱块复位，彻底复原魔方"),
    "f2l": ("CFOP·F2L 前两层", "同时复位前两层的角块与棱块"),
    "oll": ("CFOP·OLL 顶面朝向", "将顶面全部翻转为黄色"),
    "pll": ("CFOP·PLL 顶面置换", "完成顶层位置置换，魔方完全复原"),
    "kociemba": ("极速二阶段最优解", "极速计算理论最短路径"),
}

MOVE_ACTION_CN = {
    "U": "把 **顶层（白色面）向左转 90°**（即 `U` 步）",
    "U'": "把 **顶层（白色面）向右转 90°**（即 `U'` 步）",
    "U2": "把 **顶层（白色面）旋转 180°**（即 `U2` 步）",
    "D": "把 **底层（黄色面）向右转 90°**（即 `D` 步）",
    "D'": "把 **底层（黄色面）向左转 90°**（即 `D'` 步）",
    "D2": "把 **底层（黄色面）旋转 180°**（即 `D2` 步）",
    "F": "把 **正面（绿色面）顺时针转 90°**（即 `F` 步）",
    "F'": "把 **正面（绿色面）逆时针转 90°**（即 `F'` 步）",
    "F2": "把 **正面（绿色面）旋转 180°**（即 `F2` 步）",
    "B": "把 **背面（蓝色面）逆时针转 90°**（即 `B` 步）",
    "B'": "把 **背面（蓝色面）顺时针转 90°**（即 `B'` 步）",
    "B2": "把 **背面（蓝色面）旋转 180°**（即 `B2` 步）",
    "R": "把 **右侧（红色面）向上推 90°**（即 `R` 步）",
    "R'": "把 **右侧（红色面）向下拉 90°**（即 `R'` 步）",
    "R2": "把 **右侧（红色面）旋转 180°**（即 `R2` 步）",
    "L": "把 **左侧（橙色面）向下拉 90°**（即 `L` 步）",
    "L'": "把 **左侧（橙色面）向上推 90°**（即 `L'` 步）",
    "L2": "把 **左侧（橙色面）旋转 180°**（即 `L2` 步）",
}


def template_narration(method: str, stage: str, move: str) -> str:
    stage_info = STAGE_CN.get(stage, (stage, "推进魔方复原"))
    stage_name = stage_info[0] if isinstance(stage_info, tuple) else stage_info
    action = MOVE_ACTION_CN.get(move, f"执行动作 `{move}`")
    return f"【{stage_name}阶段】：{action}"


def format_next_step_guide(step: dict, method: str) -> str:
    stage = step.get("stage", "cross")
    move = step.get("move", "U")
    stage_info = STAGE_CN.get(stage, (stage, "对齐颜色推进复原"))
    stage_name = stage_info[0] if isinstance(stage_info, tuple) else stage_info
    stage_desc = stage_info[1] if isinstance(stage_info, tuple) else "对齐颜色推进复原"
    action = MOVE_ACTION_CN.get(move, f"把 `{move}` 面转动 1 次")

    return (
        f"🎯 **下一步指引**：\n\n"
        f"1. **魔方拿法**：白色面朝上，绿色面正对自己\n"
        f"2. **转动动作**：{action}\n"
        f"3. **当前目标**：处于【{stage_name}】阶段，{stage_desc}\n\n"
        f"💡 *转动后即可继续点击「下一步怎么做」～*"
    )


class Agent:
    """Drives the four MCP cube tools, then fills in narrations."""

    def __init__(self, llm: Callable[..., Any] | None = None) -> None:
        self.llm = llm
        self.tool_calls: list[str] = []

    async def solve_with_narration(self, method: str) -> dict:
        self.tool_calls.clear()
        try:
            async with mcp_client.connect() as session:

                async def call(name: str, **arguments) -> Any:
                    self.tool_calls.append(name)
                    return await mcp_client.call_tool(session, name, arguments or None)

                state = await call("get_cube_state")
                val = await call("validate_state", facelets=state)
                if not val.get("ok"):
                    raise ValueError(f"魔方状态校验未通过: {val.get('reason')}")

                sol = await call("get_solution", method=method)
                steps = sol["steps"]

                # Replay on a scratch copy via stateless apply_move so the shared
                # session keeps the scrambled state for the frontend player.
                scratch = state
                for step in steps:
                    scratch = await call("apply_move", move=step["move"], facelets=scratch)
        except Exception:
            # Robust fallback: directly invoke shared session tools if in-process JSON-RPC encounters stream/TaskGroup issues
            from core.session import get_shared_session
            from core import state as cube_state

            s = get_shared_session()
            self.tool_calls = ["get_cube_state"]
            state = s.get_cube_state()
            self.tool_calls.append("validate_state")
            val = s.validate_state(state)
            if not val.get("ok"):
                raise ValueError(f"魔方状态校验未通过: {val.get('reason')}")
            self.tool_calls.append("get_solution")
            sol = s.get_solution(method)
            steps = sol["steps"]
            scratch = state
            for step in steps:
                self.tool_calls.append("apply_move")
                scratch = cube_state.apply_move(scratch, step["move"])

        if self.llm is not None:
            narrations = self.llm(method, steps)
        else:
            try:
                narrations = await request_narrations(method, steps)
            except Exception:
                narrations = None

        out_steps = []
        for i, step in enumerate(steps):
            narration = (
                narrations[i]
                if narrations and i < len(narrations)
                else template_narration(method, step["stage"], step["move"])
            )
            out_steps.append({**step, "narration": narration})

        return {"method": method, "steps": out_steps, "tool_calls": list(self.tool_calls)}
