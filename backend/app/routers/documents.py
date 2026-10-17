import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.ingestion import ingest_document
from app.models import Chunk, Document
from app.schemas import ChunkContext, DocumentOut

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()

ALLOWED_TYPES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = (".pdf", ".txt", ".docx")


def _upload_path(doc: Document) -> str:
    return os.path.join(settings.upload_dir, f"{doc.id}_{doc.filename}")


def _overlap(left: str, right: str) -> int:
    """Length of the text that ends `left` and also starts `right`. Chunks
    are split with an overlap, so neighbours repeat a little of each other.
    Very short matches (a shared "e" or ".") are coincidence, not overlap."""
    shortest = max(1, min(20, settings.chunk_overlap))
    for size in range(min(len(left), len(right), settings.chunk_overlap * 2), shortest - 1, -1):
        if left.endswith(right[:size]):
            return size
    return 0


# The splitter drops the paragraph break it split on, so put one back
# when neighbours don't overlap.
def _join_before(before: str, content: str) -> str:
    size = _overlap(before, content)
    return before[: len(before) - size] if size else (before + "\n\n" if before else "")


def _join_after(content: str, after: str) -> str:
    size = _overlap(content, after)
    return after[size:] if size else ("\n\n" + after if after else "")


async def _run_ingestion(document_id: uuid.UUID, path: str, content_type: str) -> None:
    # Background tasks get their own DB session, independent of the
    # request-scoped one that has already been returned to the pool.
    async with AsyncSessionLocal() as db:
        await ingest_document(db, document_id, path, content_type)


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(400, "Only .pdf, .txt, and .docx files are supported")

    os.makedirs(settings.upload_dir, exist_ok=True)
    doc = Document(filename=file.filename, content_type=file.content_type or "", status="pending")
    db.add(doc)
    await db.flush()

    dest_path = _upload_path(doc)
    with open(dest_path, "wb") as out:
        out.write(await file.read())

    await db.commit()
    await db.refresh(doc)

    background_tasks.add_task(_run_ingestion, doc.id, dest_path, file.content_type or "")

    return doc


@router.get("", response_model=list[DocumentOut])
async def list_documents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).order_by(Document.uploaded_at.desc()))
    return result.scalars().all()


@router.get("/chunks/{chunk_id}", response_model=ChunkContext)
async def get_chunk_context(chunk_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    chunk = await db.get(Chunk, chunk_id)
    if not chunk:
        raise HTTPException(404, "This source no longer exists (the document may have been deleted)")
    doc = await db.get(Document, chunk.document_id)

    neighbours = (
        await db.execute(
            select(Chunk.chunk_index, Chunk.content).where(
                Chunk.document_id == chunk.document_id,
                Chunk.chunk_index.in_([chunk.chunk_index - 1, chunk.chunk_index + 1]),
            )
        )
    ).all()
    by_index = {n.chunk_index: n.content for n in neighbours}
    before = by_index.get(chunk.chunk_index - 1, "")
    after = by_index.get(chunk.chunk_index + 1, "")

    return ChunkContext(
        chunk_id=str(chunk.id),
        document_id=str(chunk.document_id),
        filename=doc.filename,
        chunk_index=chunk.chunk_index,
        chunk_count=doc.chunk_count,
        before=_join_before(before, chunk.content),
        content=chunk.content,
        after=_join_after(chunk.content, after),
    )


@router.get("/{document_id}/file")
async def get_document_file(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    path = _upload_path(doc) if doc else ""
    if not doc or not os.path.isfile(path):
        raise HTTPException(404, "File not found")
    return FileResponse(
        path, media_type=doc.content_type or None, filename=doc.filename, content_disposition_type="inline"
    )


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.delete("/{document_id}")
async def delete_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    await db.execute(delete(Document).where(Document.id == document_id))
    await db.commit()
    return {"deleted": True}
