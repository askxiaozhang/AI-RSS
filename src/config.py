import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI-RSS"
    DEBUG: bool = False
    
    # Database Settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/ai_rss"
    
    # Redis Settings
    REDIS_URL: str = "redis://localhost:6379"
    
    # JWT Auth Settings
    JWT_SECRET: str = "supersecretjwtkeyforairssplatformdevonlychangeinprod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # AI API Keys
    GEMINI_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    
    # LLM Settings
    DEFAULT_LLM_MODEL: str = "gemini-2.5-flash"  # Default Gemini model
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-004"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
