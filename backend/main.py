import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

from db.connection import run_migrations
from routers.ptm import router as ptm_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ptm")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_migrations()
    yield


app = FastAPI(
    title="PTM AI Agent",
    description="Backend for the Super Sheldon PTM report automation",
    version="0.1.0",
    lifespan=lifespan,
)

# Allow localhost + any *.vercel.app deploy + any *.app.github.dev Codespace +
# an explicit FRONTEND_URL override.
_explicit = [o for o in ("http://localhost:3000", os.getenv("FRONTEND_URL", "")) if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_explicit,
    allow_origin_regex=r"https://.*\.(vercel\.app|app\.github\.dev)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"},
    )

app.include_router(ptm_router)

# Static folder for TTS-generated audio files. Created lazily by tts_service.
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}
