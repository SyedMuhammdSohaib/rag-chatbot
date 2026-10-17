from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import chat, conversations, documents, presets, quiz, stats

settings = get_settings()

@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()  # creates the SQLite tables on first run
    yield


app = FastAPI(title="RAG Chatbot API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(presets.router)
app.include_router(quiz.router)
app.include_router(stats.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
