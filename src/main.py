from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import settings
from src.core.database import init_db
from src.api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    # Cleanly shut down the shared Playwright browser on exit
    from src.services.browser_service import browser_service
    await browser_service.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Advanced RSS Platform with AI summarization, translation, filtering, and chat Q&A.",
    version="1.0.0",
    lifespan=lifespan
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include main API router
app.include_router(api_router, prefix="/api")

from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import os

# Mount static files directory
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/", response_class=HTMLResponse)
async def root():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>AI-RSS Web App</h1><p>Please place index.html in the src/static folder.</p>")
