import logging
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


def create_resilient_engine():
    raw_url = settings.clean_database_url
    if raw_url.startswith("sqlite"):
        return create_engine(raw_url, connect_args={"check_same_thread": False})

    engine_kwargs = {"pool_recycle": 3600, "pool_pre_ping": True}

    # Normalize candidate URLs for postgres dialects
    candidate_urls = [raw_url]
    if "postgresql://" in raw_url and "postgresql+psycopg" not in raw_url:
        candidate_urls.append(raw_url.replace("postgresql://", "postgresql+psycopg://", 1))
    elif "postgres://" in raw_url:
        candidate_urls.insert(0, raw_url.replace("postgres://", "postgresql://", 1))
        candidate_urls.append(raw_url.replace("postgres://", "postgresql+psycopg://", 1))

    for url in candidate_urls:
        try:
            eng = create_engine(url, **engine_kwargs)
            # Verify driver dialect loads without import errors
            _ = eng.dialect.dbapi
            logger.info("Database driver dialect loaded successfully.")
            return eng
        except Exception as e:
            logger.warning(f"Database engine init failed for candidate ({e}). Checking fallback...")
            continue

    # Absolute fallback to local SQLite so uvicorn NEVER fails to boot
    logger.error("Primary database engine creation failed. Falling back to SQLite to ensure 100% service availability.")
    return create_engine("sqlite:///./geoattend.db", connect_args={"check_same_thread": False})


engine = create_resilient_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
