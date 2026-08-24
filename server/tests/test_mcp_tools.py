from core.session import CubeSession
from core.state import SOLVED, apply_move


def test_get_and_apply_roundtrip():
    sess = CubeSession()
    assert sess.get_cube_state() == SOLVED
    after = sess.apply_move("R")
    assert after != SOLVED
    assert sess.get_cube_state() == after
    sess.apply_move("R'")
    assert sess.get_cube_state() == SOLVED


def test_validate_current_and_arg():
    sess = CubeSession()
    assert sess.validate_state() == {"ok": True}
    bad = "R" * 54
    assert sess.validate_state(bad)["ok"] is False


def test_get_solution_then_apply():
    sess = CubeSession()
    for m in ["R", "U", "R'", "U'"]:
        sess.apply_move(m)
    scrambled = sess.get_cube_state()
    sol = sess.get_solution("beginner")
    assert sol["method"] == "beginner"
    # fresh session at scrambled state
    sess2 = CubeSession(scrambled)
    for step in sol["steps"]:
        sess2.apply_move(step["move"])
    assert sess2.get_cube_state() == SOLVED


def test_set_state_rejects_invalid():
    sess = CubeSession()
    try:
        sess.set_state("U" * 53)
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_mcp_tool_names():
    from agent.mcp_server import list_tool_names

    assert list_tool_names() == [
        "apply_move",
        "get_cube_state",
        "get_solution",
        "validate_state",
    ]


def test_http_and_mcp_share_session():
    from fastapi.testclient import TestClient

    from agent import mcp_server
    from api.http_app import app, reset_session_for_tests

    # HTTP routes and MCP tools must read/write the same shared session
    reset_session_for_tests(SOLVED)
    client = TestClient(app)
    r = client.post("/api/move", json={"move": "R"})
    assert r.status_code == 200
    assert mcp_server.get_cube_state() == r.json()["facelets"]


def test_mcp_protocol_roundtrip():
    """Drive the four tools through a real MCP client session (JSON-RPC)."""
    import asyncio

    from agent import mcp_client

    async def run():
        async with mcp_client.connect() as session:
            listed = await session.list_tools()
            names = sorted(t.name for t in listed.tools)
            assert names == ["apply_move", "get_cube_state", "get_solution", "validate_state"]

            state = await mcp_client.call_tool(session, "get_cube_state")
            assert isinstance(state, str) and len(state) == 54

            val = await mcp_client.call_tool(session, "validate_state", {"facelets": state})
            assert val == {"ok": True}

            # stateless apply: result returned, session untouched
            moved = await mcp_client.call_tool(
                session, "apply_move", {"move": "R", "facelets": state}
            )
            assert moved != state
            after = await mcp_client.call_tool(session, "get_cube_state")
            return state, after

    state, after = asyncio.run(run())
    assert state == after  # stateless apply did not mutate the session


def test_apply_move_on_session():
    import asyncio

    from agent import mcp_client
    from core.session import get_shared_session

    async def run():
        async with mcp_client.connect() as session:
            before = await mcp_client.call_tool(session, "get_cube_state")
            moved = await mcp_client.call_tool(session, "apply_move", {"move": "R"})
            return before, moved

    before, moved = asyncio.run(run())
    assert moved == apply_move(before, "R")
    assert get_shared_session().get_cube_state() == moved
    get_shared_session().apply_move("R'")
