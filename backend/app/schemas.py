import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    content_type: str
    status: str
    error_message: str | None
    uploaded_at: datetime
    chunk_count: int


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    created_at: datetime
    system_prompt: str | None = None


class ConversationCreate(BaseModel):
    title: str | None = None
    system_prompt: str | None = None


class ConversationRename(BaseModel):
    title: str


class SystemPromptUpdate(BaseModel):
    system_prompt: str | None = None  # None/empty resets to the app default


class PromptPresetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    content: str
    created_at: datetime


class PromptPresetCreate(BaseModel):
    name: str
    content: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    cited_chunk_ids: list[str]


class ChatRequest(BaseModel):
    conversation_id: uuid.UUID | None = None
    message: str
    # Only used when conversation_id is None (starting a brand-new
    # conversation) — lets the UI set a custom system prompt from the
    # first message rather than requiring a separate call first.
    system_prompt: str | None = None


class SourceChunk(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    content: str
    score: float
