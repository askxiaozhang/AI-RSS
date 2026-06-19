from uuid import UUID, uuid4
from datetime import datetime
from sqlmodel import SQLModel, Field
from typing import Optional

class ChatConversationBase(SQLModel):
    title: str

class ChatConversation(ChatConversationBase, table=True):
    __tablename__ = "chat_conversations"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatConversationRead(ChatConversationBase):
    id: UUID
    user_id: UUID
    created_at: datetime

class ChatMessageBase(SQLModel):
    sender: str  # "user" or "assistant"
    content: str

class ChatMessage(ChatMessageBase, table=True):
    __tablename__ = "chat_messages"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    conversation_id: UUID = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatMessageCreate(ChatMessageBase):
    pass

class ChatMessageRead(ChatMessageBase):
    id: UUID
    conversation_id: UUID
    created_at: datetime
