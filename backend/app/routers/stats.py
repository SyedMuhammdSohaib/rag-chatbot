import uuid
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Chunk, Conversation, Document, Message

router = APIRouter(prefix="/stats", tags=["stats"])

# How many days the "questions per day" chart covers
DAYS = 14


@router.get("")
async def get_stats(db: AsyncSession = Depends(get_db)):
    async def count(query) -> int:
        return (await db.execute(query)).scalar_one()

    questions = await count(select(func.count()).select_from(Message).where(Message.role == "user"))
    answers = await count(select(func.count()).select_from(Message).where(Message.role == "assistant"))

    # Answers, cache hits and ratings per model
    rows = await db.execute(
        select(
            Message.model,
            func.count(),
            func.sum(case((Message.rating == 1, 1), else_=0)),
            func.sum(case((Message.rating == -1, 1), else_=0)),
        )
        .where(Message.role == "assistant")
        .group_by(Message.model)
    )
    models = [
        {"model": model or "unknown (older answers)", "answers": n, "thumbs_up": up or 0, "thumbs_down": down or 0}
        for model, n, up, down in rows
    ]
    models.sort(key=lambda m: m["answers"], reverse=True)
    cache_hits = next((m["answers"] for m in models if m["model"] == "cache"), 0)

    # Which documents answers drew on most
    cited = Counter(
        cid
        for ids in (await db.execute(select(Message.cited_chunk_ids).where(Message.role == "assistant"))).scalars()
        for cid in ids or []
    )
    doc_counts: Counter = Counter()
    if cited:
        chunk_docs = await db.execute(
            select(Chunk.id, Document.filename)
            .join(Document, Chunk.document_id == Document.id)
            .where(Chunk.id.in_([uuid.UUID(c) for c in cited]))
        )
        for chunk_id, filename in chunk_docs:
            doc_counts[filename] += cited[str(chunk_id)]

    # Questions per day for the last DAYS days, including days with none
    since = datetime.utcnow().date() - timedelta(days=DAYS - 1)
    per_day = dict(
        (
            await db.execute(
                select(func.date(Message.created_at), func.count())
                .where(Message.role == "user", Message.created_at >= datetime.combine(since, datetime.min.time()))
                .group_by(func.date(Message.created_at))
            )
        ).all()
    )
    days = [since + timedelta(days=i) for i in range(DAYS)]

    return {
        "documents": await count(select(func.count()).select_from(Document).where(Document.status == "ready")),
        "chunks": await count(select(func.count()).select_from(Chunk)),
        "conversations": await count(select(func.count()).select_from(Conversation)),
        "questions": questions,
        "answers": answers,
        "cache_hits": cache_hits,
        "models": models,
        "top_documents": [{"filename": f, "citations": n} for f, n in doc_counts.most_common(8)],
        "questions_per_day": [{"date": d.isoformat(), "count": per_day.get(d.isoformat(), 0)} for d in days],
    }
