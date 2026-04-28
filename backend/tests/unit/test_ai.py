"""AI proxy endpoint tests. Auth is stripped from /api/ai/* router, so we use
the plain `client` fixture (not `auth_client`). All routes proxy to OpenRouter.
"""

from unittest.mock import patch, MagicMock, AsyncMock


def _mock_settings(openrouter_key=""):
    s = MagicMock()
    s.openrouter_api_key = openrouter_key
    s.anthropic_api_key = ""
    return s


def _mock_openrouter_json(content: str):
    """Build a mock httpx AsyncClient that returns an OpenRouter-format JSON."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"choices": [{"message": {"content": content}}]}

    mock_client_instance = AsyncMock()
    mock_client_instance.post = AsyncMock(return_value=mock_response)

    mock_client_ctx = MagicMock()
    mock_client_ctx.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_ctx.__aexit__ = AsyncMock(return_value=False)
    return mock_client_ctx


def test_chat_missing_key_503(client):
    with patch("app.api.routes.ai.get_settings", return_value=_mock_settings()):
        resp = client.post("/api/ai/chat", json={
            "messages": [{"role": "user", "content": "hi"}],
            "model": "test",
            "max_tokens": 100,
        })
        assert resp.status_code == 503


def test_chat_streams_sse(client):
    mock_stream_resp = MagicMock()

    async def aiter_lines():
        yield "data: {\"chunk\":1}"
        yield "data: [DONE]"

    mock_stream_resp.aiter_lines = aiter_lines

    mock_client_instance = AsyncMock()
    mock_stream_ctx = MagicMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_stream_resp)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)
    mock_client_instance.stream = MagicMock(return_value=mock_stream_ctx)

    mock_client_ctx = MagicMock()
    mock_client_ctx.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_client_ctx.__aexit__ = AsyncMock(return_value=False)

    settings = _mock_settings(openrouter_key="test-key")

    with patch("app.api.routes.ai.get_settings", return_value=settings), \
         patch("app.api.routes.ai.httpx.AsyncClient", return_value=mock_client_ctx):
        resp = client.post("/api/ai/chat", json={
            "messages": [{"role": "user", "content": "hi"}],
            "model": "test",
            "max_tokens": 100,
            "stream": True,
        })
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")


def test_chat_non_streaming_returns_json(client):
    mock_ctx = _mock_openrouter_json("hello back")
    settings = _mock_settings(openrouter_key="test-key")

    with patch("app.api.routes.ai.get_settings", return_value=settings), \
         patch("app.api.routes.ai.httpx.AsyncClient", return_value=mock_ctx):
        resp = client.post("/api/ai/chat", json={
            "messages": [{"role": "user", "content": "hi"}],
            "model": "test",
            "max_tokens": 100,
            "stream": False,
        })
        assert resp.status_code == 200
        assert resp.json()["choices"][0]["message"]["content"] == "hello back"


def test_consolidate_missing_key_503(client):
    with patch("app.api.routes.ai.get_settings", return_value=_mock_settings()):
        resp = client.post("/api/ai/consolidate", json={
            "files_schema": [{"name": "f", "headers": [], "sample_rows": []}],
            "model": "test",
        })
        assert resp.status_code == 503


def test_consolidate_returns_json(client):
    mock_ctx = _mock_openrouter_json(
        '{"unified_headers":["Source File","ColA"],'
        '"mappings":[{"file":"f","column_map":{"A":"ColA"}}]}'
    )
    settings = _mock_settings(openrouter_key="test-key")

    with patch("app.api.routes.ai.get_settings", return_value=settings), \
         patch("app.api.routes.ai.httpx.AsyncClient", return_value=mock_ctx):
        resp = client.post("/api/ai/consolidate", json={
            "files_schema": [{"name": "f", "headers": ["A"], "sample_rows": [[1]]}],
            "model": "test",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "unified_headers" in data
        assert "mappings" in data


def test_command_missing_key_503(client):
    with patch("app.api.routes.ai.get_settings", return_value=_mock_settings()):
        resp = client.post("/api/ai/command", json={
            "message": "add column Total",
            "headers": ["A", "B"],
            "model": "test",
        })
        assert resp.status_code == 503


def test_command_returns_parsed(client):
    mock_ctx = _mock_openrouter_json(
        '{"op":"add_column","name":"Total","position":null}'
    )
    settings = _mock_settings(openrouter_key="test-key")

    with patch("app.api.routes.ai.get_settings", return_value=settings), \
         patch("app.api.routes.ai.httpx.AsyncClient", return_value=mock_ctx):
        resp = client.post("/api/ai/command", json={
            "message": "add column Total",
            "headers": ["A", "B"],
            "model": "test",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["op"] == "add_column"
