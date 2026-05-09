import pytest
from unittest.mock import patch, AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_get_jwks_returns_keys():
    mock_response = MagicMock()
    mock_response.json.return_value = {"keys": [{"kid": "abc", "kty": "EC"}]}
    mock_response.raise_for_status.return_value = None

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

    with patch("app.core.jwks.httpx.AsyncClient", return_value=mock_client):
        from app.core.jwks import _fetch_jwks
        keys = await _fetch_jwks("https://fake.supabase.co")
    assert len(keys) == 1
    assert keys[0]["kid"] == "abc"
