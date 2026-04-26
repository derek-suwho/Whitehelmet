# backend/tests/unit/test_authorization.py
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
import httpx


def test_check_org_access_allowed():
    from app.core.authorization import check_org_access
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"has_access": True}

    with patch("app.core.authorization._client") as mock_client:
        mock_client.post = AsyncMock(return_value=mock_response)
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            check_org_access(user_external_id="u-123", org_external_id="pif-001", service_url="https://auth.example.com")
        )
    assert result is True


def test_check_org_access_denied():
    from app.core.authorization import check_org_access
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"has_access": False}

    with patch("app.core.authorization._client") as mock_client:
        mock_client.post = AsyncMock(return_value=mock_response)
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            check_org_access(user_external_id="u-123", org_external_id="pif-001", service_url="https://auth.example.com")
        )
    assert result is False


def test_check_org_access_service_unavailable_fails_closed():
    """If auth service is unreachable, deny access (fail closed)."""
    from app.core.authorization import check_org_access

    with patch("app.core.authorization._client") as mock_client:
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("unreachable"))
        import asyncio
        result = asyncio.get_event_loop().run_until_complete(
            check_org_access(user_external_id="u-123", org_external_id="pif-001", service_url="https://auth.example.com")
        )
    assert result is False


def test_check_org_access_skipped_when_no_service_url():
    """When AUTH_SERVICE_URL is empty (local dev), skip check and return True."""
    from app.core.authorization import check_org_access
    import asyncio
    result = asyncio.get_event_loop().run_until_complete(
        check_org_access(user_external_id="u-123", org_external_id="pif-001", service_url="")
    )
    assert result is True
