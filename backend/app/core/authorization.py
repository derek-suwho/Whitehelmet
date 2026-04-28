# backend/app/core/authorization.py
"""Laravel Authorization service client — checks if a user's org has access to this app."""

import httpx

_client = httpx.AsyncClient(timeout=5.0)
_APP_ID = "whitehelmet"


async def check_org_access(
    *,
    user_external_id: str,
    org_external_id: str,
    service_url: str,
) -> bool:
    """Return True if the user's org has access to this app.

    Returns True without calling the service if service_url is empty (local dev mode).
    Returns False (fail closed) if the service is unreachable.
    """
    if not service_url:
        return True  # local dev — skip check

    try:
        response = await _client.post(
            f"{service_url}/check-access",
            json={
                "user_id": user_external_id,
                "org_id": org_external_id,
                "app_id": _APP_ID,
            },
            headers={"Content-Type": "application/json"},
        )
        data = response.json()
        return bool(data.get("has_access", False))
    except (httpx.HTTPError, Exception):
        return False  # fail closed — deny on any error
