"""Tests for TemplateAssignment, Submission, and ConsolidatedSheet models."""


def test_create_assignment(db):
    from app.models.template_assignment import TemplateAssignment
    a = TemplateAssignment(id="asn-1", org_id="org-1", submission_type="template", status="pending")
    db.add(a)
    db.commit()
    db.refresh(a)
    assert a.status == "pending"


def test_create_submission(db):
    from app.models.submission import Submission
    s = Submission(
        id="sub-1", assignment_id="asn-1", org_id="org-1",
        file_path="/data/file.xlsx", file_name="report.xlsx", status="submitted"
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    assert s.status == "submitted"


def test_create_consolidated_sheet(db):
    from app.models.consolidated_sheet import ConsolidatedSheet
    cs = ConsolidatedSheet(id="cs-1", template_id="tmpl-1", file_path="/data/master.xlsx")
    db.add(cs)
    db.commit()
    db.refresh(cs)
    assert cs.template_id == "tmpl-1"
