import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, LargeBinary, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def gen_uuid():
    return uuid.uuid4()


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=gen_uuid)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), default="")
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending|processing|ready|failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)

    chunks: Mapped[list["Chunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=gen_uuid)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # float32 vector stored as raw bytes; similarity is computed with numpy
    embedding: Mapped[bytes] = mapped_column(LargeBinary)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    doc_metadata: Mapped[dict] = mapped_column(JSON, default=dict)

    document: Mapped["Document"] = relationship(back_populates="chunks")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(256), default="New conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    # None means "use the default system prompt"
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=gen_uuid)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))  # user|assistant
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    cited_chunk_ids: Mapped[list] = mapped_column(JSON, default=list)
    # Match score of each cited chunk, same order as cited_chunk_ids
    cited_scores: Mapped[list] = mapped_column(JSON, default=list)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


class PromptPreset(Base):
    __tablename__ = "prompt_presets"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
