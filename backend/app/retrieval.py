import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.llm import get_embedding
from app.models import Chunk, Document
from app.schemas import SourceChunk

settings = get_settings()


async def retrieve_relevant_chunks(db: AsyncSession, query: str, top_k: int | None = None) -> list[SourceChunk]:
    """Cosine-similarity search. Embeddings live in SQLite as float32 bytes;
    for a personal document set, comparing them with numpy is instant."""
    top_k = top_k or settings.top_k

    rows = (
        await db.execute(
            select(Chunk.id, Chunk.document_id, Chunk.content, Chunk.embedding, Document.filename)
            .join(Document, Chunk.document_id == Document.id)
            .where(Document.status == "ready")
        )
    ).all()
    if not rows:
        return []

    q = np.asarray(await get_embedding(query), dtype=np.float32)
    q_norm = np.linalg.norm(q) or 1.0

    matrix = np.vstack([np.frombuffer(r.embedding, dtype=np.float32) for r in rows])
    norms = np.linalg.norm(matrix, axis=1)
    norms[norms == 0] = 1.0
    scores = (matrix @ q) / (norms * q_norm)

    best = np.argsort(-scores)[:top_k]
    return [
        SourceChunk(
            chunk_id=str(rows[i].id),
            document_id=str(rows[i].document_id),
            filename=rows[i].filename,
            content=rows[i].content,
            score=round(float(scores[i]), 4),
        )
        for i in best
    ]


def build_context_block(chunks: list[SourceChunk]) -> str:
    if not chunks:
        return "No relevant context was found in the uploaded documents."
    return "\n\n".join(f"[Source {i}: {c.filename}]\n{c.content}" for i, c in enumerate(chunks, start=1))
