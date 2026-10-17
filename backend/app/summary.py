"""LLM features that read a whole document: the summary + suggested
questions written after upload, and comparing two documents."""
import uuid

from sqlalchemy import select, update

from app.database import AsyncSessionLocal
from app.language import with_language
from app.llm import complete, parse_json_reply
from app.models import Chunk, Document

SUMMARY_SYSTEM_PROMPT = (
    "You read documents and explain them simply to a student. "
    "Use only the text you are given. Reply with JSON only, no other text."
)
SUMMARY_SHAPE = (
    '{"summary": "about 5 short sentences", "key_points": ["...", "...", "..."], '
    '"questions": ["...", "...", "...", "..."]}'
)

COMPARE_SYSTEM_PROMPT = (
    "You compare two documents for a student. Use only the excerpts you are given. "
    "Answer in Markdown with these sections: **What both cover**, **Only in A**, "
    "**Only in B**, **Where they disagree** (write 'Nothing found' if they don't), "
    "and a one-line **Verdict**. Refer to the documents by their file names."
)

# How much of a document an LLM call gets to see
SAMPLE_CHUNKS = 8
SAMPLE_CHARS = 8000


def _spread(items: list, count: int) -> list:
    """`count` items spread evenly from start to end, so a sample covers the
    whole document instead of just its first pages."""
    if len(items) <= count:
        return list(items)
    step = (len(items) - 1) / (count - 1)
    return [items[round(i * step)] for i in range(count)]


async def _sample_text(document_id: uuid.UUID, chars: int = SAMPLE_CHARS) -> str:
    async with AsyncSessionLocal() as db:
        chunks = (
            await db.execute(
                select(Chunk.content).where(Chunk.document_id == document_id).order_by(Chunk.chunk_index)
            )
        ).scalars().all()
    return "\n\n[...]\n\n".join(_spread(chunks, SAMPLE_CHUNKS))[:chars]


async def _set(document_id: uuid.UUID, **values) -> None:
    async with AsyncSessionLocal() as db:
        await db.execute(update(Document).where(Document.id == document_id).values(**values))
        await db.commit()


async def summarize_document(document_id: uuid.UUID, language: str | None = None) -> None:
    """Writes summary, key points and suggested questions onto the document.
    A failure only marks the summary failed; the document stays usable."""
    async with AsyncSessionLocal() as db:
        doc = await db.get(Document, document_id)
        if not doc or doc.status != "ready":
            return
        filename = doc.filename

    await _set(document_id, summary_status="pending")
    try:
        text = await _sample_text(document_id)
        prompt = (
            f"Document: {filename}\n\n{text}\n\n"
            "Write a summary of about 5 short sentences, 3 to 6 key points, and 4 questions "
            "a reader could ask about this document (answerable from it).\n"
            f"Reply in this JSON shape:\n{SUMMARY_SHAPE}"
        )
        data = parse_json_reply(await complete(with_language(SUMMARY_SYSTEM_PROMPT, language), prompt, 1200))
        if not isinstance(data, dict):
            raise ValueError("no JSON in reply")
        summary = str(data.get("summary") or "").strip()
        if not summary:
            raise ValueError("empty summary")
        key_points = [str(p).strip() for p in data.get("key_points") or [] if str(p).strip()][:6]
        questions = [str(q).strip() for q in data.get("questions") or [] if str(q).strip()][:4]
        await _set(
            document_id,
            summary_status="done",
            summary=summary,
            key_points=key_points,
            suggested_questions=questions,
        )
    except Exception:  # noqa: BLE001
        await _set(document_id, summary_status="failed")


async def compare_documents(doc_a: Document, doc_b: Document, language: str | None = None) -> str:
    def describe(doc: Document, excerpt: str) -> str:
        summary = f"Summary: {doc.summary}\n\n" if doc.summary else ""
        return f"=== Document {doc.filename} ===\n{summary}Excerpts:\n{excerpt}"

    half = SAMPLE_CHARS // 2
    prompt = (
        f"{describe(doc_a, await _sample_text(doc_a.id, half))}\n\n"
        f"{describe(doc_b, await _sample_text(doc_b.id, half))}\n\n"
        f"Compare document A ({doc_a.filename}) with document B ({doc_b.filename})."
    )
    return await complete(with_language(COMPARE_SYSTEM_PROMPT, language), prompt, 1500)
