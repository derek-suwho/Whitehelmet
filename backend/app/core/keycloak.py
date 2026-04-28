# backend/app/core/keycloak.py
"""Keycloak JWT validation — fetch JWKS, decode tokens, extract roles."""

import time
import httpx
from jose import jwt, JWTError
from typing import Optional


# Role mapping: Keycloak realm roles → our system roles
_ROLE_MAP = {
    "Org_Super_Admin": "pif_admin",
    "Org_Admin": "devco_admin",
    "Org_Member": "devco_user",
}

# Internal Keycloak roles to ignore when extracting app roles
_INTERNAL_ROLES = {"offline_access", "uma_authorization", "default-roles-pif"}

# In-memory JWKS cache: {url: (jwks_dict, fetched_at)}
_jwks_cache: dict[str, tuple[dict, float]] = {}
_JWKS_TTL = 3600  # re-fetch keys every hour


class TokenError(Exception):
    """Raised when JWT validation fails."""


def _fetch_jwks(jwks_url: str) -> dict:
    """Fetch JWKS from Keycloak, with 1h in-memory cache."""
    cached = _jwks_cache.get(jwks_url)
    if cached and (time.time() - cached[1]) < _JWKS_TTL:
        return cached[0]
    response = httpx.get(jwks_url, timeout=5.0)
    response.raise_for_status()
    jwks = response.json()
    _jwks_cache[jwks_url] = (jwks, time.time())
    return jwks


def decode_token(token: str, *, issuer: str, audience: str, jwks_url: Optional[str] = None) -> dict:
    """Validate and decode a Keycloak JWT. Raises TokenError on any failure."""
    if jwks_url is None:
        # Derive JWKS URL from issuer: {issuer}/protocol/openid-connect/certs
        jwks_url = f"{issuer}/protocol/openid-connect/certs"

    try:
        jwks = _fetch_jwks(jwks_url)
        # python-jose can accept a JWKS dict directly
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=audience,
            issuer=issuer,
        )
        return claims
    except JWTError as e:
        msg = str(e).lower()
        if "expired" in msg:
            raise TokenError("Token expired") from e
        raise TokenError(f"Invalid token: {e}") from e
    except httpx.HTTPError as e:
        raise TokenError(f"Could not fetch JWKS: {e}") from e


def extract_roles(claims: dict) -> list[str]:
    """Extract app-relevant realm roles from JWT claims, filtering internal ones."""
    realm_roles = claims.get("realm_access", {}).get("roles", [])
    return [r for r in realm_roles if r not in _INTERNAL_ROLES]


def map_system_role(roles: list[str]) -> Optional[str]:
    """Map Keycloak realm roles to our system role. Returns highest-privilege match."""
    priority = ["pif_admin", "devco_admin", "devco_user"]
    mapped = {_ROLE_MAP[r] for r in roles if r in _ROLE_MAP}
    for role in priority:
        if role in mapped:
            return role
    return None
