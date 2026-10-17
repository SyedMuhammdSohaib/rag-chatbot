import random

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.language import with_language
from app.llm import complete, parse_json_reply
from app.models import Chunk, Document
from app.schemas import QuizOut, QuizQuestion, QuizRequest

router = APIRouter(prefix="/quiz", tags=["quiz"])

QUIZ_SYSTEM_PROMPT = (
    "You are a teacher who writes multiple-choice questions (MCQs) to test a student "
    "on their study material. Use ONLY the numbered passages you are given. Every "
    "question has exactly 4 options and exactly one correct option. Wrong options "
    "must be believable, not silly. Reply with JSON only, no other text."
)

# Small local models are much more reliable when shown the exact shape.
JSON_SHAPE = (
    '{"questions": [{"question": "...", "options": ["...", "...", "...", "..."], '
    '"answer": 0, "explanation": "one short sentence on why", "passage": 1}]}'
)

# A quiz is longer than a chat answer: about 150 tokens per question.
QUIZ_MAX_TOKENS = 2600


def _parse_questions(raw: str) -> list[dict]:
    data = parse_json_reply(raw)
    if isinstance(data, dict):
        data = data.get("questions", [])
    return data if isinstance(data, list) else []


def _answer_index(value, option_count: int) -> int | None:
    """Accepts 0, "0", "B" or "b" style answers."""
    if isinstance(value, str):
        value = value.strip()
        if len(value) == 1 and value.upper() in "ABCDEF":
            value = "ABCDEF".index(value.upper())
        elif value.isdigit():
            value = int(value)
    if isinstance(value, int) and 0 <= value < option_count:
        return value
    return None


@router.post("", response_model=QuizOut)
async def create_quiz(body: QuizRequest, db: AsyncSession = Depends(get_db)):
    query = (
        select(Chunk.id, Chunk.content, Chunk.chunk_index, Document.filename)
        .join(Document, Chunk.document_id == Document.id)
        .where(Document.status == "ready")
    )
    if body.document_id:
        query = query.where(Document.id == body.document_id)
    chunks = (await db.execute(query)).all()
    if not chunks:
        raise HTTPException(400, "No ready documents found. Upload a file on the Documents page first.")

    # A random spread of passages, so every new quiz asks about different parts
    picked = random.sample(chunks, min(body.num_questions, len(chunks)))
    passages = "\n\n".join(f"[Passage {i}]\n{c.content}" for i, c in enumerate(picked, start=1))
    prompt = (
        f"Passages:\n{passages}\n\n"
        f"Write exactly {body.num_questions} MCQs about these passages. "
        f'"answer" is the 0-based index of the correct option, "passage" is the passage number it comes from.\n'
        f"Reply in this JSON shape:\n{JSON_SHAPE}"
    )

    try:
        raw = await complete(with_language(QUIZ_SYSTEM_PROMPT, body.language), prompt, QUIZ_MAX_TOKENS)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"LLM error: {exc}") from exc

    questions: list[QuizQuestion] = []
    for item in _parse_questions(raw):
        if not isinstance(item, dict):
            continue
        options = [str(o).strip() for o in item.get("options") or [] if str(o).strip()]
        answer = _answer_index(item.get("answer"), len(options))
        question = str(item.get("question") or "").strip()
        if not question or len(options) < 2 or answer is None:
            continue

        # Models love putting the right answer first; shuffle so it isn't guessable
        correct = options[answer]
        random.shuffle(options)

        passage = item.get("passage")
        source = picked[passage - 1] if isinstance(passage, int) and 1 <= passage <= len(picked) else picked[0]
        questions.append(
            QuizQuestion(
                question=question,
                options=options,
                answer_index=options.index(correct),
                explanation=str(item.get("explanation") or "").strip(),
                chunk_id=str(source.id),
                filename=source.filename,
            )
        )

    if not questions:
        raise HTTPException(502, "The model didn't return a usable quiz. Please try again.")
    return QuizOut(questions=questions[: body.num_questions])
