import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Chunk, Conversation, Document, Message
from app.schemas import (
    ConversationCreate,
    ConversationOut,
    ConversationRename,
    MessageOut,
    SourceChunk,
    SystemPromptUpdate,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.post("", response_model=ConversationOut)
async def create_conversation(body: ConversationCreate, db: AsyncSession = Depends(get_db)):
    convo = Conversation(title=body.title or "New conversation", system_prompt=body.system_prompt)
    db.add(convo)
    await db.commit()
    await db.refresh(convo)
    return convo


@router.get("", response_model=list[ConversationOut])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).order_by(Conversation.created_at.desc()))
    return result.scalars().all()


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def get_messages(conversation_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    convo = await db.get(Conversation, conversation_id)
    if not convo:
        raise HTTPException(404, "Conversation not found")
    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at)
    )
    messages = result.scalars().all()

    # Look up every cited chunk in one query; chunks of deleted documents
    # are simply missing and get skipped.
    cited_ids = {uuid.UUID(cid) for m in messages for cid in m.cited_chunk_ids or []}
    chunks = {}
    if cited_ids:
        rows = await db.execute(
            select(Chunk.id, Chunk.document_id, Chunk.content, Document.filename)
            .join(Document, Chunk.document_id == Document.id)
            .where(Chunk.id.in_(cited_ids))
        )
        chunks = {str(r.id): r for r in rows}

    out = []
    for m in messages:
        scores = m.cited_scores or []
        sources = [
            SourceChunk(
                chunk_id=cid,
                document_id=str(chunks[cid].document_id),
                filename=chunks[cid].filename,
                content=chunks[cid].content,
                score=scores[i] if i < len(scores) else None,
            )
            for i, cid in enumerate(m.cited_chunk_ids or [])
            if cid in chunks
        ]
        out.append(MessageOut.model_validate(m).model_copy(update={"sources": sources}))
    return out


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def rename_conversation(conversation_id: uuid.UUID, body: ConversationRename, db: AsyncSession = Depends(get_db)):
    convo = await db.get(Conversation, conversation_id)
    if not convo:
        raise HTTPException(404, "Conversation not found")
    convo.title = body.title
    await db.commit()
    await db.refresh(convo)
    return convo


@router.patch("/{conversation_id}/system-prompt", response_model=ConversationOut)
async def update_system_prompt(conversation_id: uuid.UUID, body: SystemPromptUpdate, db: AsyncSession = Depends(get_db)):
    convo = await db.get(Conversation, conversation_id)
    if not convo:
        raise HTTPException(404, "Conversation not found")
    convo.system_prompt = body.system_prompt or None
    await db.commit()
    await db.refresh(convo)
    return convo


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    convo = await db.get(Conversation, conversation_id)
    if not convo:
        raise HTTPException(404, "Conversation not found")
    await db.delete(convo)
    await db.commit()
    return {"deleted": True}
