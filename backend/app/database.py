import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

# Get Database URL from environment, fallback to SQLite if not provided
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Default to sqlite if not configured in .env (for backward compatibility / safety fallback)
    DATABASE_URL = "sqlite+aiosqlite:///./hc_verify.db"
else:
    # If standard postgresql url is provided, convert it to asyncpg dialect
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

try:
    if "postgresql" in DATABASE_URL:
        import asyncpg
    engine = create_async_engine(
        DATABASE_URL,
        echo=True
    )
except Exception:
    DATABASE_URL = "sqlite+aiosqlite:///./hc_verify.db"
    engine = create_async_engine(
        DATABASE_URL,
        echo=True
    )

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session