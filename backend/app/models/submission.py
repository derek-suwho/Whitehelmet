from sqlalchemy import Column, String, DateTime, func

from app.db.session import Base


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True)
    assignment_id = Column(String(36), nullable=False, index=True)
    org_id = Column(String(36), nullable=False, index=True)
    file_path = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="submitted")
    submitted_by = Column(String(36), nullable=True)
    submitted_at = Column(DateTime, server_default=func.now(), nullable=False)
