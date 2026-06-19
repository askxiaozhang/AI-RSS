from uuid import UUID, uuid4
from datetime import datetime
from sqlmodel import SQLModel, Field
from pydantic import EmailStr

class UserBase(SQLModel):
    email: EmailStr = Field(index=True, unique=True)
    preferred_language: str = "zh"  # default to Chinese or English

class User(UserBase, table=True):
    __tablename__ = "users"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: UUID
    created_at: datetime

class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(SQLModel):
    email: str | None = None
