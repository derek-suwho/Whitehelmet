"""Submission — a DevCo's xlsx file upload against an assignment."""

import uuid

from sqlalchemy import Column, DateTime, String, Text, func

from app.db.session import Base


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assignment_id = Column(String(36), nullable=False, index=True)
    org_id = Column(String(36), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="submitted")  # submitted | resubmitted | locked
    submitted_at = Column(DateTime, server_default=func.now(), nullable=False)
    submitted_by = Column(String(36), nullable=True)
    processed_file_path = Column(String(500), nullable=True)
    reporting_period = Column(String(50), nullable=True, index=True)  # e.g. "2026-07"

    # Review fields (populated by PIF admin)
    review_status = Column(String(20), nullable=True)   # 'approved' | 'changes_requested'
    review_comment = Column(Text, nullable=True)
    reviewed_by = Column(String(36), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
