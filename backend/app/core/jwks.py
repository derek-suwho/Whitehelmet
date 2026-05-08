"""JWKS cache — fetches and caches Supabase public keys for ES256 validation."""

import time

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

_cache: dict = {"keys": [], "fetched_at": 0.0}
_TTL = 3600  # refresh keys every hour


async def _fetch_jwks(supabase_url: str) -> list[dict]:
    url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url)
    r.raise_for_status()
    return r.json()["keys"]


async def get_public_keys(supabase_url: str) -> list[dict]:
    """Return cached JWKS keys, refreshing if stale."""
    now = time.time()
    if now - _cache["fetched_at"] > _TTL or not _cache["keys"]:
        _cache["keys"] = await _fetch_jwks(supabase_url)
        _cache["fetched_at"] = now
    return _cache["keys"]


async def decode_supabase_token(token: str, supabase_url: str) -> dict:
    """Validate a Supabase-issued JWT (ES256) and return claims."""
    keys = await get_public_keys(supabase_url)
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Malformed token: {exc}") from exc

    kid = header.get("kid")
    matching = [k for k in keys if k.get("kid") == kid] if kid else keys

    last_exc: Exception = Exception("No matching key")
    for key in matching:
        try:
            return jwt.decode(token, key, algorithms=["ES256"], audience="authenticated")
        except JWTError as exc:
            last_exc = exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Invalid token: {last_exc}",
    )
