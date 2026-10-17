from pathlib import Path

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()
Path(settings.data_dir).mkdir(parents=True, exist_ok=True)

engine = create_async_engine(settings.database_url, connect_args={"timeout": 30})


@event.listens_for(engine.sync_engine, "connect")
def _sqlite_pragmas(dbapi_connection, _record):
    # SQLite needs foreign keys switched on per connection for ON DELETE
    # CASCADE to work; WAL lets the UI read while a document is ingesting.
    cur = dbapi_connection.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")
    cur.close()


AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


# create_all never changes an existing table, so columns added after the
# first release are listed here and added to databases made before them.
ADDED_COLUMNS = {
    "messages": {"cited_scores": "JSON", "rating": "INTEGER", "model": "VARCHAR(128)"},
    "documents": {
        "source_url": "TEXT",
        "summary_status": "VARCHAR(16)",
        "summary": "TEXT",
        "key_points": "JSON",
        "suggested_questions": "JSON",
    },
}


async def init_db() -> None:
    from app import models  # noqa: F401  (registers tables on Base.metadata)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for table, added in ADDED_COLUMNS.items():
            existing = {row[1] for row in await conn.execute(text(f"PRAGMA table_info({table})"))}
            for column, sql_type in added.items():
                if column not in existing:
                    await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))
        # A summary still "pending" at startup was cut off by a restart;
        # mark it failed so the UI offers "Try again" instead of waiting forever
        await conn.execute(text("UPDATE documents SET summary_status = 'failed' WHERE summary_status = 'pending'"))


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
