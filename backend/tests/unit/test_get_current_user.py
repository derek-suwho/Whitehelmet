import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

FAKE_UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
FAKE_CLAIMS = {"sub": FAKE_UID, "role": "authenticated", "aud": "authenticated"}


@pytest.mark.asyncio
async def test_valid_token_returns_profile():
    fake_profile = MagicMock(id=FAKE_UID, role="devco_user")
    fake_db = MagicMock()
    fake_db.query.return_value.filter.return_value.first.return_value = fake_profile
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake.jwt.token")

    with patch("app.core.dependencies.decode_supabase_token", return_value=FAKE_CLAIMS), \
         patch("app.core.dependencies.get_settings") as ms:
        ms.return_value.supabase_url = "https://fake.supabase.co"
        from app.core.dependencies import get_current_user
        result = await get_current_user(request=MagicMock(), creds=creds, db=fake_db)
    assert result.id == FAKE_UID


@pytest.mark.asyncio
async def test_missing_creds_raises_401():
    from app.core.dependencies import get_current_user
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request=MagicMock(), creds=None, db=MagicMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_profile_not_found_raises_401():
    fake_db = MagicMock()
    fake_db.query.return_value.filter.return_value.first.return_value = None
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="fake.jwt.token")

    with patch("app.core.dependencies.decode_supabase_token", return_value=FAKE_CLAIMS), \
         patch("app.core.dependencies.get_settings") as ms:
        ms.return_value.supabase_url = "https://fake.supabase.co"
        from app.core.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request=MagicMock(), creds=creds, db=fake_db)
    assert exc_info.value.status_code == 401
