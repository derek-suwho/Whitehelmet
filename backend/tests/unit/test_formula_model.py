import uuid

from app.models.formula import Formula


def test_formula_uuid_pk():
    f = Formula(
        id=str(uuid.uuid4()),
        created_by=str(uuid.uuid4()),
        name="Lost time rate",
        expression="=B2/A2",
        formula_type="calculation",
    )
    assert f.is_library_item is False
    assert f.usage_count == 0


def test_formula_tablename():
    assert Formula.__tablename__ == "formulas"
