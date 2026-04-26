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
    t = Template(id="tmpl-1", name="QHSE Q1", status="draft")
    db.add(t)
    db.commit()
    schema = json.dumps({"columns": []})
    v = TemplateVersion(id="ver-1", template_id="tmpl-1", version_number=1, schema_json=schema)
    db.add(v)
    db.commit()
    db.refresh(v)
    assert v.version_number == 1
