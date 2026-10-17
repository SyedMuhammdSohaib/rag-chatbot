import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.database import AsyncSessionLocal, get_db
from app.language import with_language
from app.llm import stream_chat_completion
from app.models import Conversation, Message
from app.retrieval import build_context_block, retrieve_relevant_chunks
from app.schemas import ChatRequest

from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/chat", tags=["chat"])

# Used whenever a conversation has no system_prompt set — the starting
# point for system-prompt practice. Override it per conversation via
# PATCH /conversations/{id}/system-prompt or by passing system_prompt
# when starting a new one.
DEFAULT_SYSTEM_PROMPT = (
    "You are a helpful assistant answering questions using the provided "
    "document context. Cite sources by their [Source N] label when you use "
    "them. If the context doesn't contain the answer, say so plainly rather "
    "than guessing."
)



@router.post("")
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    conversation_id = body.conversation_id
    if conversation_id:
        convo = await db.get(Conversation, conversation_id)
        if not convo:
            raise HTTPException(404, "Conversation not found")
    else:
        convo = Conversation(title=body.message[:60], system_prompt=body.system_prompt)
        db.add(convo)
        await db.flush()
        conversation_id = convo.id

    active_system_prompt = convo.system_prompt or DEFAULT_SYSTEM_PROMPT
    model_system_prompt = with_language(active_system_prompt, body.language)

    # Pull recent history for conversational memory
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc())
        .limit(settings.history_messages)
    )
    recent = list(reversed(result.scalars().all()))
    # Long old answers are cut short: the model still knows what was said,
    # but each question costs far fewer tokens (= far fewer rate limits)
    history = [
        {"role": m.role, "content": m.content[: settings.history_message_chars]}
        for m in recent
        if m.content and not m.content.startswith("(response interrupted")
    ]

    user_msg = Message(conversation_id=conversation_id, role="user", content=body.message)
    db.add(user_msg)
    await db.commit()

    # Retrieval failing (embedding model hiccup, empty document set, etc.)
    # should degrade to "answer with no document context" rather than take
    # the whole request down with an opaque 500.
    try:
        sources = await retrieve_relevant_chunks(db, body.message)
    except Exception:  # noqa: BLE001
        sources = []
    context_block = build_context_block(sources)
    augmented_user_message = f"Context:\n{context_block}\n\nQuestion: {body.message}"

    async def event_generator():
        full_response = ""
        try:
            async for token in stream_chat_completion(model_system_prompt, history, augmented_user_message):
                full_response += token
                yield {"event": "token", "data": json.dumps({"text": token})}
        except Exception as exc:  # noqa: BLE001
            yield {"event": "error", "data": json.dumps({"message": f"LLM error: {exc}"})}
            full_response = full_response or "(response interrupted by an error)"

        # Persist the assistant turn in its own session, since the
        # request-scoped session may have moved on by the time streaming ends.
        async with AsyncSessionLocal() as save_db:
            assistant_msg = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=full_response,
                cited_chunk_ids=[s.chunk_id for s in sources],
            )
            save_db.add(assistant_msg)
            await save_db.commit()

        yield {
            "event": "done",
            "data": json.dumps(
                {
                    "conversation_id": str(conversation_id),
                    "sources": [s.model_dump() for s in sources],
                    "system_prompt": active_system_prompt,
                }
            ),
        }

    return EventSourceResponse(event_generator())
