import uuid

from app.models.record import Record


def test_record_user_id_is_string():
    r = Record(user_id=str(uuid.uuid4()), name="Q1 Report", source_count=3)
    assert isinstance(r.user_id, str)
