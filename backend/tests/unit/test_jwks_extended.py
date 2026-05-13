"""Extended JWKS tests — caching, token decode paths."""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from jose import JWTError, jwt as jose_jwt


@pytest.mark.asyncio
async def test_get_public_keys_caches():
    """Second call within TTL returns cached keys without refetching."""
    from app.core import jwks
    # Reset cache
    jwks._cache["keys"] = []
    jwks._cache["fetched_at"] = 0.0

    mock_response = MagicMock()
    mock_response.json.return_value = {"keys": [{"kid": "k1", "kty": "EC"}]}
    mock_response.raise_for_status.return_value = None

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

    with patch("app.core.jwks.httpx.AsyncClient", return_value=mock_client):
        keys1 = await jwks.get_public_keys("https://fake.supabase.co")
        keys2 = await jwks.get_public_keys("https://fake.supabase.co")

    assert keys1 == keys2
    # _fetch_jwks only called once (cache hit on second call)
    assert mock_client.__aenter__.return_value.get.call_count == 1

    # Cleanup
    jwks._cache["keys"] = []
    jwks._cache["fetched_at"] = 0.0


@pytest.mark.asyncio
async def test_get_public_keys_refreshes_after_ttl():
    """After TTL expires, keys are refetched."""
    from app.core import jwks
    jwks._cache["keys"] = [{"kid": "old"}]
    jwks._cache["fetched_at"] = time.time() - jwks._TTL - 10  # expired

    mock_response = MagicMock()
    mock_response.json.return_value = {"keys": [{"kid": "new", "kty": "EC"}]}
    mock_response.raise_for_status.return_value = None

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

    with patch("app.core.jwks.httpx.AsyncClient", return_value=mock_client):
        keys = await jwks.get_public_keys("https://fake.supabase.co")

    assert keys[0]["kid"] == "new"

    jwks._cache["keys"] = []
    jwks._cache["fetched_at"] = 0.0


@pytest.mark.asyncio
async def test_decode_malformed_token():
    """Malformed token raises 401."""
    from app.core.jwks import decode_supabase_token

    with patch("app.core.jwks.get_public_keys", new_callable=AsyncMock, return_value=[{"kid": "k1"}]):
        with pytest.raises(HTTPException) as exc:
            await decode_supabase_token("not.a.valid.token", "https://fake.supabase.co")
        assert exc.value.status_code == 401
        assert "Malformed" in exc.value.detail


@pytest.mark.asyncio
async def test_decode_no_matching_key():
    """Token with kid that doesn't match any key tries all and fails."""
    from app.core.jwks import decode_supabase_token

    fake_header = {"alg": "ES256", "kid": "unknown"}
    with patch("app.core.jwks.get_public_keys", new_callable=AsyncMock, return_value=[{"kid": "k1"}]):
        with patch("app.core.jwks.jwt.get_unverified_header", return_value=fake_header):
            with pytest.raises(HTTPException) as exc:
                await decode_supabase_token("fake.token.here", "https://fake.supabase.co")
            assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_decode_tries_all_keys_no_kid():
    """Token without kid tries all keys."""
    from app.core.jwks import decode_supabase_token

    fake_header = {"alg": "ES256"}  # no kid
    keys = [{"kid": "k1"}, {"kid": "k2"}]

    with patch("app.core.jwks.get_public_keys", new_callable=AsyncMock, return_value=keys):
        with patch("app.core.jwks.jwt.get_unverified_header", return_value=fake_header):
            with patch("app.core.jwks.jwt.decode", side_effect=JWTError("bad")):
                with pytest.raises(HTTPException) as exc:
                    await decode_supabase_token("fake.token", "https://fake.supabase.co")
                assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_decode_success_with_kid_match():
    """Token with matching kid decodes successfully."""
    from app.core.jwks import decode_supabase_token

    fake_header = {"alg": "ES256", "kid": "k1"}
    expected_claims = {"sub": "user-123", "email": "test@test.com"}

    with patch("app.core.jwks.get_public_keys", new_callable=AsyncMock, return_value=[{"kid": "k1"}]):
        with patch("app.core.jwks.jwt.get_unverified_header", return_value=fake_header):
            with patch("app.core.jwks.jwt.decode", return_value=expected_claims):
                claims = await decode_supabase_token("valid.token.here", "https://fake.supabase.co")

    assert claims["sub"] == "user-123"
