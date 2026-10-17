import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.ingestion import IMAGE_EXTENSIONS, ingest_document
from app.models import Chunk, Document
from app.schemas import ChunkContext, CompareDocumentsRequest, DocumentOut, LinkRequest, SummaryRequest
from app.summary import compare_documents, summarize_document
from app.web import fetch_link

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()

ALLOWED_TYPES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = (".pdf", ".txt", ".docx", *IMAGE_EXTENSIONS)


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


async def _run_ingestion(document_id: uuid.UUID, path: str, content_type: str, language: str | None) -> None:
    # Background tasks get their own DB session, independent of the
    # request-scoped one that has already been returned to the pool.
    async with AsyncSessionLocal() as db:
        await ingest_document(db, document_id, path, content_type)
    # Summary + suggested questions; skipped by itself if ingestion failed
    await summarize_document(document_id, language)


async def _save_and_ingest(
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    filename: str,
    content: bytes,
    content_type: str,
    language: str | None,
    source_url: str | None = None,
) -> Document:
    os.makedirs(settings.upload_dir, exist_ok=True)
    doc = Document(filename=filename, content_type=content_type, status="pending", source_url=source_url)
    db.add(doc)
    await db.flush()

    dest_path = _upload_path(doc)
    with open(dest_path, "wb") as out:
        out.write(content)

    await db.commit()
    await db.refresh(doc)

    background_tasks.add_task(_run_ingestion, doc.id, dest_path, content_type, language)
    return doc


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: str | None = Form(None),  # language of the auto summary
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith(ALLOWED_EXTENSIONS):
        raise HTTPException(400, "Only .pdf, .txt, .docx and image files (.png, .jpg) are supported")

    return await _save_and_ingest(
        db, background_tasks, file.filename, await file.read(), file.content_type or "", language
    )


@router.post("/link", response_model=DocumentOut)
async def add_link(body: LinkRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    url = body.url.strip()
    try:
        filename, content, content_type = await fetch_link(url)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return await _save_and_ingest(db, background_tasks, filename, content, content_type, body.language, url)


@router.post("/compare")
async def compare(body: CompareDocumentsRequest, db: AsyncSession = Depends(get_db)):
    if body.document_a == body.document_b:
        raise HTTPException(400, "Pick two different documents")
    doc_a = await db.get(Document, body.document_a)
    doc_b = await db.get(Document, body.document_b)
    if not doc_a or not doc_b:
        raise HTTPException(404, "Document not found")
    if doc_a.status != "ready" or doc_b.status != "ready":
        raise HTTPException(400, "Both documents must finish processing first")
    try:
        answer = await compare_documents(doc_a, doc_b, body.language)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"LLM error: {exc}") from exc
    return {"answer": answer}


@router.post("/{document_id}/summary", response_model=DocumentOut)
async def resummarize(
    document_id: uuid.UUID,
    body: SummaryRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != "ready":
        raise HTTPException(400, "The document is still processing")
    doc.summary_status = "pending"
    await db.commit()
    await db.refresh(doc)
    background_tasks.add_task(summarize_document, doc.id, body.language)
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
        source_url=doc.source_url,
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
