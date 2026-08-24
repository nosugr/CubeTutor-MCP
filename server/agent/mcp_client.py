"""In-process MCP client for the agent.

The agent talks to the CubeTutor MCP server over the real MCP JSON-RPC
protocol using the SDK's in-memory transport — no network, no subprocess.
The server operates on the shared cube session, so tool calls immediately
affect the HTTP-visible state.
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any

from mcp.client._memory import InMemoryTransport
from mcp.client.session import ClientSession

from agent.mcp_server import mcp


def _parse_content(content: list[Any]) -> Any:
    """Extract a Python value from MCP content blocks.

    The SDK serializes str returns as plain text and dict/list returns as
    JSON text, so: try JSON first, fall back to the raw string.
    """
    for block in content:
        text = getattr(block, "text", None)
        if text is None:
            continue
        stripped = text.strip()
        if stripped.startswith(("{", "[")):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass
        return text
    raise RuntimeError("mcp: empty tool result")


@asynccontextmanager
async def connect():
    """Open an in-process MCP session to the CubeTutor MCP server."""
    async with InMemoryTransport(mcp) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            yield session


async def call_tool(session: ClientSession, name: str, arguments: dict[str, Any] | None = None) -> Any:
    """Call one tool via the MCP protocol and parse the result."""
    result = await session.call_tool(name, arguments or {})
    if result.is_error:
        text = getattr(result.content[0], "text", "") if result.content else ""
        raise RuntimeError(f"mcp tool {name} failed: {text}")
    return _parse_content(result.content)
