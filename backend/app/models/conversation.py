"""Conversation history — persists chat context for reopening saved records."""

from sqlalchemy import BigInteger, Column, DateTime, Text, func

from app.db.session import Base


class ConversationMessage(Base):
    __tablename__ = "conversation_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    record_id = Column(BigInteger, nullable=False, index=True)
    role = Column(Text, nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
