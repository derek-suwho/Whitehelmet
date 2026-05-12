"""File upload endpoint tests."""

from io import BytesIO
from unittest.mock import MagicMock, patch


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
            files={
                "file": (
                    "test.xlsx",
                    BytesIO(content),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
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
            files={
                "file": (
                    "test.xlsx",
                    BytesIO(content),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert resp.status_code == 400


def test_upload_oversized(auth_client, tmp_path):
    content = b"PK\x03\x04" + b"\x00" * 100
    settings = _mock_settings(tmp_path, max_mb=0)
    with patch("app.api.routes.files.get_settings", return_value=settings):
        resp = auth_client.post(
            "/api/files/upload",
            files={
                "file": (
                    "test.xlsx",
                    BytesIO(content),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert resp.status_code == 413


def test_upload_unauthenticated(client):
    content = b"PK\x03\x04" + b"\x00" * 100
    resp = client.post(
        "/api/files/upload",
        files={
            "file": ("test.xlsx", BytesIO(content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        },
    )
    assert resp.status_code == 401


def test_list_files(auth_client, db, test_user, tmp_path):
    from app.models.uploaded_file import UploadedFile

    f = UploadedFile(
        user_id=str(test_user.id),
        original_name="a.xlsx",
        stored_path=str(tmp_path / "a.xlsx"),
        mime_type="application/octet-stream",
        size_bytes=100,
        sha256="abc",
    )
    db.add(f)
    db.commit()
    resp = auth_client.get("/api/files")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["files"][0]["original_name"] == "a.xlsx"


def test_get_file_not_found(auth_client):
    resp = auth_client.get("/api/files/9999")
    assert resp.status_code == 404


def test_delete_file(auth_client, db, test_user, tmp_path):
    from app.models.uploaded_file import UploadedFile

    stored = tmp_path / "del.xlsx"
    stored.write_bytes(b"data")
    f = UploadedFile(
        user_id=str(test_user.id),
        original_name="del.xlsx",
        stored_path=str(stored),
        mime_type="application/octet-stream",
        size_bytes=4,
        sha256="xyz",
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    resp = auth_client.delete(f"/api/files/{f.id}")
    assert resp.status_code == 204
    assert db.query(UploadedFile).filter_by(id=f.id).first() is None


def test_delete_file_not_found(auth_client):
    resp = auth_client.delete("/api/files/9999")
    assert resp.status_code == 404
