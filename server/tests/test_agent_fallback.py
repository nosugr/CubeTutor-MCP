import asyncio

from agent.agent import Agent, template_narration
from core.session import get_shared_session
from core.state import SOLVED, apply_move


def test_template_non_empty():
    text = template_narration("cfop", "f2l", "R")
    assert "R" in text
    assert "F2L" in text or "f2l" in text.lower() or "F2L" in text or "f2l" in text


def _scramble_shared(moves: list[str]) -> None:
    shared = get_shared_session()
    shared.set_state(SOLVED)
    for m in moves:
        shared.apply_move(m)


def test_fallback_without_llm():
    _scramble_shared(["R", "U", "R'", "U'"])
    agent = Agent(llm=lambda method, steps: None)
    out = asyncio.run(agent.solve_with_narration("beginner"))
    assert out["steps"]
    assert all(s.get("narration") for s in out["steps"])
    for tool in ("get_cube_state", "validate_state", "get_solution", "apply_move"):
        assert tool in agent.tool_calls
    # agent replay is stateless: shared session keeps the scrambled state
    assert get_shared_session().get_cube_state() != SOLVED
    get_shared_session().set_state(SOLVED)


def test_mock_llm_and_tools():
    _scramble_shared(["R", "U"])

    def fake_llm(method, steps):
        return [f"讲{s['move']}" for s in steps]

    agent = Agent(llm=fake_llm)
    out = asyncio.run(agent.solve_with_narration("beginner"))
    assert out["steps"][0]["narration"].startswith("讲")
    for tool in ("get_cube_state", "validate_state", "get_solution", "apply_move"):
        assert tool in agent.tool_calls
    # replay happens once per step plus once per protocol preamble call
    assert agent.tool_calls.count("apply_move") == len(out["steps"])
    get_shared_session().set_state(SOLVED)


def test_agent_replay_reaches_solved():
    _scramble_shared(["R", "U", "R'", "U'", "F2"])
    scrambled = get_shared_session().get_cube_state()
    agent = Agent(llm=lambda method, steps: None)
    out = asyncio.run(agent.solve_with_narration("beginner"))
    # verify the returned steps actually solve the scrambled state
    s = scrambled
    for step in out["steps"]:
        s = apply_move(s, step["move"])
    assert s == SOLVED
    get_shared_session().set_state(SOLVED)
