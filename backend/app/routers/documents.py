import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.ingestion import ingest_document
from app.models import Document
from app.schemas import DocumentOut

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()

ALLOWED_TYPES = {
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = (".pdf", ".txt", ".docx")


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

    dest_path = os.path.join(settings.upload_dir, f"{doc.id}_{file.filename}")
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
