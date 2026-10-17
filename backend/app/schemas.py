import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    content_type: str
    status: str
    error_message: str | None
    uploaded_at: datetime
    chunk_count: int
    source_url: str | None = None
    summary_status: str | None = None
    summary: str | None = None
    key_points: list[str] | None = None
    suggested_questions: list[str] | None = None


class LinkRequest(BaseModel):
    url: str
    language: str | None = None


class SummaryRequest(BaseModel):
    language: str | None = None


class CompareDocumentsRequest(BaseModel):
    document_a: uuid.UUID
    document_b: uuid.UUID
    language: str | None = None


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
    rating: int | None = None
    model: str | None = None
    sources: list["SourceChunk"] = []


class RatingUpdate(BaseModel):
    rating: int | None = Field(None, ge=-1, le=1)  # 1, -1, or null to clear


class CompareModelsRequest(BaseModel):
    message: str
    language: str | None = None
    system_prompt: str | None = None


class ChatRequest(BaseModel):
    conversation_id: uuid.UUID | None = None
    message: str
    # Only used when conversation_id is None (starting a brand-new
    # conversation) — lets the UI set a custom system prompt from the
    # first message rather than requiring a separate call first.
    system_prompt: str | None = None
    # "en" (default), "ur" (Urdu script) or "roman_ur"
    language: str | None = None


class SourceChunk(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    content: str
    score: float | None = None  # None for answers saved before scores were kept


class ChunkContext(BaseModel):
    """One source chunk plus the text just before and after it, for the
    "show me where this came from" viewer."""

    chunk_id: str
    document_id: str
    filename: str
    chunk_index: int
    chunk_count: int
    source_url: str | None = None
    before: str
    content: str
    after: str


class QuizRequest(BaseModel):
    document_id: uuid.UUID | None = None  # None = all ready documents
    num_questions: int = Field(5, ge=1, le=10)
    language: str | None = None


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    answer_index: int
    explanation: str
    chunk_id: str
    filename: str


class QuizOut(BaseModel):
    questions: list[QuizQuestion]


MessageOut.model_rebuild()
