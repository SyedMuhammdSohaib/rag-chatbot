import asyncio
import re
import uuid

import numpy as np
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.llm import get_embeddings
from app.models import Chunk, Document

settings = get_settings()

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".bmp")
# A page with less text than this is treated as a scanned image
MIN_PAGE_TEXT = 25

_ocr = None
# One-letter words wordninja may produce that are real words
_SINGLE_LETTER_WORDS = {"a", "A", "I"}


def _restore_spaces(line: str) -> str:
    """RapidOCR's model often drops the spaces in English text
    ("Thewatercycleis"). Split long letter runs back into words with
    wordninja's English word list, and space out punctuation and numbers.
    Normal text with spaces comes through unchanged."""
    import wordninja

    def split_run(match: re.Match) -> str:
        run = match.group(0)
        if len(run) < 7:  # short runs are usually real words or names
            return run
        parts = wordninja.split(run)
        if len(parts) < 2 or any(len(p) == 1 and p not in _SINGLE_LETTER_WORDS for p in parts):
            return run
        return " ".join(parts)

    line = re.sub(r"[A-Za-z]+", split_run, line)
    line = re.sub(r"([,.;:!?])(?=[A-Za-z])", r"\1 ", line)  # "rivers,lakes"
    line = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", line)  # "Rs500"
    return re.sub(r"(?<=\d)(?=[A-Za-z])(?!(?:st|nd|rd|th)\b)", " ", line)  # "2026in", keeps "1st"


def _ocr_text(image) -> str:
    """Reads text from an image (file path or numpy array) with RapidOCR.
    Runs on the CPU with no internet; it reads English (and Chinese) print."""
    global _ocr
    if _ocr is None:
        from rapidocr_onnxruntime import RapidOCR

        _ocr = RapidOCR()
    result, _ = _ocr(image)
    return "\n".join(_restore_spaces(line[1]) for line in result or [])


def _ocr_scanned_pages(path: str, pages: list[str]) -> list[str]:
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(path)
    try:
        return [
            text if len(text.strip()) >= MIN_PAGE_TEXT else _ocr_text(pdf[i].render(scale=2).to_numpy())
            for i, text in enumerate(pages)
        ]
    finally:
        pdf.close()


def extract_text(path: str, content_type: str) -> str:
    """Pull raw text out of a PDF / DOCX / TXT file or an image. Scanned
    PDF pages and images are read with OCR."""
    lower = path.lower()
    if lower.endswith(".pdf") or content_type == "application/pdf":
        from pypdf import PdfReader

        reader = PdfReader(path)
        pages = [page.extract_text() or "" for page in reader.pages]
        if any(len(p.strip()) < MIN_PAGE_TEXT for p in pages):
            pages = _ocr_scanned_pages(path, pages)
        return "\n\n".join(pages)

    if lower.endswith(IMAGE_EXTENSIONS) or content_type.startswith("image/"):
        return _ocr_text(path)

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

        # OCR can take a while, so keep it off the event loop
        text = await asyncio.to_thread(extract_text, path, content_type)
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
