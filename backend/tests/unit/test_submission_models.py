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
        id="sub-1",
        assignment_id="asn-1",
        org_id="org-1",
        file_path="/data/file.xlsx",
        file_name="report.xlsx",
        status="submitted",
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    assert s.status == "submitted"


def test_assignment_lock_columns(db):
    from datetime import datetime

    from app.models.template_assignment import TemplateAssignment

    a = TemplateAssignment(
        id="asn-2",
        org_id="org-1",
        submission_type="template",
        status="locked",
        locked_by="user-1",
        locked_at=datetime(2026, 5, 1),
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    assert a.locked_by == "user-1"
    assert a.locked_at == datetime(2026, 5, 1)


def test_submission_processed_file_path(db):
    from app.models.submission import Submission

    s = Submission(
        id="sub-2",
        assignment_id="asn-1",
        org_id="org-1",
        file_path="/data/file.xlsx",
        file_name="report.xlsx",
        processed_file_path="/data/file_processed.xlsx",
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    assert s.processed_file_path == "/data/file_processed.xlsx"


def test_template_formula_model(db):
    from app.models.template_formula import TemplateFormula

    # UUID columns require valid UUID strings (SQLAlchemy 2.0 validates on reload)
    FRM_UUID = "00000000-0000-0000-0000-000000000011"
    VER_UUID = "00000000-0000-0000-0000-000000000010"
    f = TemplateFormula(
        id=FRM_UUID,
        template_version_id=VER_UUID,
        name="TRIR",
        target_column="E",
        formula_type="column",
        expression="=O{row}/N{row}",
        weight=0.2,
        benchmark=0.95,
        scoring_rules='[{"min": null, "max": 0.01, "score": 100}]',
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    assert f.weight == 0.2
    assert f.formula_type == "column"


def test_create_consolidated_sheet(db):
    from app.models.consolidated_sheet import ConsolidatedSheet

    cs = ConsolidatedSheet(id="cs-1", template_id="tmpl-1", file_path="/data/master.xlsx")
    db.add(cs)
    db.commit()
    db.refresh(cs)
    assert cs.template_id == "tmpl-1"
