"""Integration tests for new AI routes: parse-template, template-generate, finetune."""

import io
import openpyxl
import pytest


def make_xlsx(headers, rows):
    """Helper: create in-memory xlsx bytes."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parse_template_returns_columns(client):
    """Test parse-template infers column types from xlsx."""
    xlsx_bytes = make_xlsx(
        ["Incident Count", "Date", "Notes"],
        [[5, "2026-01-01", "ok"], [3, "2026-01-02", "fine"]],
    )
    resp = client.post(
        "/api/ai/parse-template",
        files={"file": ("test.xlsx", xlsx_bytes, "application/octet-stream")},
    )
    assert resp.status_code == 200
    cols = resp.json()["columns"]
    assert len(cols) == 3
    assert cols[0]["name"] == "Incident Count"
    assert cols[0]["inferred_type"] == "number"
    assert cols[1]["name"] == "Date"
    assert cols[1]["inferred_type"] == "text"
    assert cols[2]["name"] == "Notes"
    assert cols[2]["inferred_type"] == "text"


def test_parse_template_empty_file(client):
    """Test parse-template with empty xlsx."""
    wb = openpyxl.Workbook()
    ws = wb.active
    buf = io.BytesIO()
    wb.save(buf)
    xlsx_bytes = buf.getvalue()

    resp = client.post(
        "/api/ai/parse-template",
        files={"file": ("empty.xlsx", xlsx_bytes, "application/octet-stream")},
    )
    assert resp.status_code == 200
    assert resp.json()["columns"] == []


def test_parse_template_infers_numbers(client):
    """Test parse-template correctly infers numeric columns."""
    xlsx_bytes = make_xlsx(
        ["Count", "Amount", "Category"],
        [[10, 100.5, "A"], [20, 200.75, "B"], [30, 300.25, "C"]],
    )
    resp = client.post(
        "/api/ai/parse-template",
        files={"file": ("numeric.xlsx", xlsx_bytes, "application/octet-stream")},
    )
    assert resp.status_code == 200
    cols = resp.json()["columns"]
    assert cols[0]["inferred_type"] == "number"
    assert cols[1]["inferred_type"] == "number"
    assert cols[2]["inferred_type"] == "text"
    assert len(cols[0]["sample_values"]) > 0
