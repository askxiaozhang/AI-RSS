from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from src.config import settings

# Create database engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True
)

# Async session factory
async_session_maker = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_session() -> AsyncSession:
    """Dependency injection for FastAPI to get database session."""
    async with async_session_maker() as session:
        yield session

async def init_db():
    """Initializes the database schema (creates tables + incremental migrations)."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

        # Incremental column additions — safe to re-run (IF NOT EXISTS)
        migrations = [
            "ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS importance_score FLOAT",
            "ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS keywords TEXT",
        ]
        for sql in migrations:
            await conn.execute(__import__("sqlalchemy").text(sql))
