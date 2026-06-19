# AI-RSS

AI-RSS is an advanced news aggregation and analysis system. Unlike traditional RSS readers, AI-RSS incorporates a powerful AI layer using Gemini or OpenAI models to:
1.  **Crawl Dynamic Web Pages**: Convert any website without standard RSS feeds into custom RSS feeds based on natural language instructions.
2.  **Semantic Filter**: Filter out noise and irrelevant content using sophisticated semantic matching rather than simple keywords.
3.  **Summarize & Translate**: Generate instant TL;DRs, bullet-pointed highlights, and translate foreign language feeds to your preference.
4.  **Chat with Feeds (RAG)**: Search and query your entire subscription history via conversational QA.

---

## 📂 Project Structure

```
workdir/
├── pyproject.toml              # Project dependencies (FastAPI, SQLModel, arq, google-genai)
├── docker-compose.yml          # Postgres + pgvector and Redis local services
├── main.py                     # CLI entrypoint to start Web Server or Background Worker
├── DESIGN.md                   # Detailed feature plans & database schema designs
│
├── src/                        # Main Application Code
│   ├── main.py                 # FastAPI app definition and lifespan hooks
│   ├── config.py               # Pydantic Settings configuration (loads from .env)
│   │
│   ├── api/                    # HTTP Endpoints (auth, feeds, items, agents, chat)
│   ├── core/                   # DB engine, security helpers
│   ├── models/                 # SQLModel Database & Pydantic definitions
│   ├── services/               # Parsers, web scrapers, AI agents, and RAG services
│   └── tasks/                  # Background worker jobs (arq)
│
└── tests/                      # Automated test suite
```

---

## 🚀 Getting Started

### 1. Prerequisites & Environment
Ensure you have the following installed:
*   [Docker](https://www.docker.com/) (for running database and queue services)
*   Python 3.12+

Create and activate your virtual environment:
```bash
# Create the virtual environment (if not already done)
uv venv

# Activate the virtual environment
source .venv/bin/activate
```

Install dependencies:
```bash
uv sync --index https://pypi.org/simple
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
# AI Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# DB / Redis Connections
DATABASE_URL=postgresql+asyncpg://postgres:postgrespassword@localhost:5432/ai_rss
REDIS_URL=redis://localhost:6379
```

### 3. Spin Up Infrastructure
Start PostgreSQL (with `pgvector` extension) and Redis using Docker Compose:
```bash
docker-compose up -d
```

### 4. Run the Web Server
Start the FastAPI server:
```bash
python main.py
# Or run directly via uvicorn:
# uvicorn src.main:app --reload
```
Once started, the API docs will be accessible at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 5. Run the Background Worker
In a separate terminal (with the virtual environment activated), start the background worker:
```bash
python main.py worker
# Or run directly via arq:
# arq src.tasks.worker.WorkerSettings
```

---

## 🛠️ Testing & Development

We use `pytest` for testing. Run tests with:
```bash
pytest
```
