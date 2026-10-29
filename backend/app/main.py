import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from contextlib import asynccontextmanager
from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-initialize database tables and seed data if fresh database
    try:
        from app.models import Base
        from app.db.session import engine, SessionLocal
        Base.metadata.create_all(bind=engine)

        db = SessionLocal()
        from app.models import User
        if db.query(User).count() == 0:
            logger.info("Fresh database detected. Seeding initial campus data...")
            try:
                from scripts.seed import seed
                seed()
                logger.info("Initial seed completed successfully.")
            except Exception as se:
                logger.warning(f"Seed note: {se}")
        db.close()
    except Exception as e:
        logger.warning(f"Database bootstrap note: {e}")
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", debug=settings.debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, (StarletteHTTPException, RequestValidationError)):
        raise exc

    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Database or internal server error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
def root():
    return {
        "app": settings.app_name,
        "status": "online",
        "version": "1.0.0",
        "api_v1": settings.api_v1_prefix,
        "documentation": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/v1/system/bootstrap")
def bootstrap_db():
    from app.models import Base
    from app.db.session import engine
    Base.metadata.create_all(bind=engine)
    from scripts.seed import seed
    seed()
    return {"status": "ok", "message": "Database bootstrapped and all demo users seeded successfully!"}

