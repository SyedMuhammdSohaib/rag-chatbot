from pathlib import Path

from sqlalchemy import event
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


async def init_db() -> None:
    from app import models  # noqa: F401  (registers tables on Base.metadata)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
