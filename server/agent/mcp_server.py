"""MCP server exposing cube session tools.

Run standalone: `cd server && python -m agent.mcp_server`
(or used in-process by the agent via mcp_client's in-memory transport).
"""

from __future__ import annotations

from mcp.server import MCPServer

from core import state as cube_state
from core.session import get_shared_session

mcp = MCPServer("cubetutor")
_session = get_shared_session()


@mcp.tool()
def get_cube_state() -> str:
    """Return the current 54-facelet cube state string."""
    return _session.get_cube_state()


@mcp.tool()
def validate_state(facelets: str | None = None) -> dict:
    """Validate facelets (or current state if omitted). Returns {ok, reason?}."""
    return _session.validate_state(facelets)


@mcp.tool()
def get_solution(method: str) -> dict:
    """Solve current state with beginner|cfop|kociemba. Returns Solution JSON."""
    return _session.get_solution(method)


@mcp.tool()
def apply_move(move: str, facelets: str | None = None) -> str:
    """Apply one move (e.g. R, U', F2); return the new 54-facelet state.

    Without facelets: applies to the shared session (mutates server state).
    With facelets: stateless — returns the moved state without touching
    the session (used by the agent to replay a solution on a scratch copy).
    """
    if facelets is None:
        return _session.apply_move(move)
    return cube_state.apply_move(facelets, move)


def list_tool_names() -> list[str]:
    """Helper for tests / smoke checks."""
    tools = mcp._tool_manager.list_tools()
    # SDK may return list[Tool] or dict
    if isinstance(tools, dict):
        return sorted(tools.keys())
    return sorted(t.name for t in tools)


if __name__ == "__main__":
    mcp.run()
