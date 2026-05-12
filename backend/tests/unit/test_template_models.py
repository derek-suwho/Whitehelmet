"""Tests for Template and TemplateVersion models."""

import json


def test_create_template(db):
    from app.models.template import Template

    t = Template(id="tmpl-1", name="QHSE Q1", status="draft")
    db.add(t)
    db.commit()
    db.refresh(t)
    assert t.status == "draft"


def test_create_template_version(db):
    from app.models.template import Template
    from app.models.template_version import TemplateVersion

    # UUID columns require valid UUID strings (SQLAlchemy 2.0 validates on reload)
    TMPL_UUID = "00000000-0000-0000-0000-000000000001"
    VER_UUID = "00000000-0000-0000-0000-000000000010"
    t = Template(id=TMPL_UUID, name="QHSE Q1", status="draft")
    db.add(t)
    db.commit()
    schema = json.dumps({"columns": []})
    v = TemplateVersion(id=VER_UUID, template_id=TMPL_UUID, version_number=1, schema_json=schema)
    db.add(v)
    db.commit()
    db.refresh(v)
    assert v.version_number == 1
