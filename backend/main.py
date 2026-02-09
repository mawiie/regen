"""
Audio Transcription API - FastAPI Application
Phase 1: Upload, Transcribe, Edit
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.routes import upload, transcripts


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    print("🚀 Starting Audio Transcription API...")
    yield
    # Shutdown
    print("👋 Shutting down Audio Transcription API...")


app = FastAPI(
    title="Audio Transcription API",
    description="Upload audio files, transcribe with speaker diarization, and edit transcripts",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(transcripts.router, prefix="/api", tags=["Transcripts"])


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}
