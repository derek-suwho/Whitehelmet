"""File upload endpoint tests."""

from unittest.mock import patch, MagicMock
from io import BytesIO


def _mock_settings(tmp_path, max_mb=50):
    s = MagicMock()
    s.upload_dir = str(tmp_path / "uploads")
    s.max_upload_size_mb = max_mb
    return s


def test_upload_valid_xlsx(auth_client, tmp_path):
    # PK magic bytes + padding to make a "valid" xlsx
    content = b"PK\x03\x04" + b"\x00" * 100
    settings = _mock_settings(tmp_path)
    with patch("app.api.routes.files.get_settings", return_value=settings):
        resp = auth_client.post(
            "/api/files/upload",
            files={"file": ("test.xlsx", BytesIO(content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data
        assert "sha256" in data
        assert data["original_name"] == "test.xlsx"


def test_upload_wrong_extension(auth_client, tmp_path):
    content = b"PK\x03\x04" + b"\x00" * 100
    settings = _mock_settings(tmp_path)
    with patch("app.api.routes.files.get_settings", return_value=settings):
        resp = auth_client.post(
            "/api/files/upload",
            files={"file": ("test.txt", BytesIO(content), "text/plain")},
        )
        assert resp.status_code == 400


def test_upload_bad_magic_bytes(auth_client, tmp_path):
    content = b"\x00\x00\x00\x00" + b"\x00" * 100
    settings = _mock_settings(tmp_path)
    with patch("app.api.routes.files.get_settings", return_value=settings):
        resp = auth_client.post(
            "/api/files/upload",
            files={"file": ("test.xlsx", BytesIO(content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 400


def test_upload_oversized(auth_client, tmp_path):
    content = b"PK\x03\x04" + b"\x00" * 100
    settings = _mock_settings(tmp_path, max_mb=0)
    with patch("app.api.routes.files.get_settings", return_value=settings):
        resp = auth_client.post(
            "/api/files/upload",
            files={"file": ("test.xlsx", BytesIO(content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert resp.status_code == 413


def test_upload_unauthenticated(client):
    content = b"PK\x03\x04" + b"\x00" * 100
    resp = client.post(
        "/api/files/upload",
        files={"file": ("test.xlsx", BytesIO(content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert resp.status_code == 401
