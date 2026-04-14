"""Conversation history — persists chat context for reopening saved records."""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func

from app.db.session import Base


class ConversationMessage(Base):
    __tablename__ = "conversation_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(Integer, ForeignKey("records.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
