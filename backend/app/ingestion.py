import uuid

import numpy as np
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.llm import get_embeddings
from app.models import Chunk, Document

settings = get_settings()


def extract_text(path: str, content_type: str) -> str:
    """Pull raw text out of a PDF / DOCX / TXT file."""
    lower = path.lower()
    if lower.endswith(".pdf") or content_type == "application/pdf":
        from pypdf import PdfReader

        reader = PdfReader(path)
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)

    if lower.endswith(".docx"):
        import docx2txt

        return docx2txt.process(path) or ""

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


async def ingest_document(db: AsyncSession, document_id: uuid.UUID, path: str, content_type: str) -> None:
    """extract -> chunk -> embed -> store. Marks the document ready/failed."""
    try:
        await db.execute(update(Document).where(Document.id == document_id).values(status="processing"))
        await db.commit()

        text = extract_text(path, content_type)
        if not text.strip():
            raise ValueError("No extractable text found in document")

        splitter = RecursiveCharacterTextSplitter(chunk_size=settings.chunk_size, chunk_overlap=settings.chunk_overlap)
        pieces = splitter.split_text(text)

        # Embed in small batches so progress is steady and memory stays low
        for start in range(0, len(pieces), 32):
            batch = pieces[start : start + 32]
            vectors = await get_embeddings(batch)
            for offset, (piece, vec) in enumerate(zip(batch, vectors)):
                db.add(
                    Chunk(
                        document_id=document_id,
                        content=piece,
                        embedding=np.asarray(vec, dtype=np.float32).tobytes(),
                        chunk_index=start + offset,
                        doc_metadata={"chunk_index": start + offset},
                    )
                )

        await db.execute(
            update(Document).where(Document.id == document_id).values(status="ready", chunk_count=len(pieces))
        )
        await db.commit()

    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        await db.execute(
            update(Document).where(Document.id == document_id).values(status="failed", error_message=str(exc)[:2000])
        )
        await db.commit()
