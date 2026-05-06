import pytest
from unittest.mock import patch, MagicMock

def test_get_jwks_returns_keys():
    mock_response = MagicMock()
    mock_response.json.return_value = {"keys": [{"kid": "abc", "kty": "EC"}]}
    mock_response.raise_for_status.return_value = None

    with patch("app.core.jwks.httpx.get", return_value=mock_response):
        from app.core.jwks import _fetch_jwks
        keys = _fetch_jwks("https://fake.supabase.co")
    assert len(keys) == 1
    assert keys[0]["kid"] == "abc"
