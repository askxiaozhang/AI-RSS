from uuid import UUID, uuid4
from datetime import datetime
from sqlmodel import SQLModel, Field
from typing import Optional

class FeedItemBase(SQLModel):
    feed_id: UUID = Field(index=True)
    title: str
    link: str
    raw_content: Optional[str] = None
    author: Optional[str] = None
    published_at: Optional[datetime] = None

class FeedItem(FeedItemBase, table=True):
    __tablename__ = "feed_items"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # AI enrichment columns
    ai_tldr: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_translation: Optional[str] = None
    
    # We will represent vector field manually in SQLModel, or as a JSON string,
    # or handle the pgvector type mapping in SQLAlchemy.
    # To keep it simple, we define it as Optional[str] containing vector JSON,
    # or rely on direct DB query mapping for pgvector. We'll store it as list of floats
    # or handle it through SQLAlchemy. Since pgvector requires `vector` type in PG,
    # we can define it using SA Column.
    # We'll use a standard list[float] or a utility in raw SQL queries.

class FeedItemRead(FeedItemBase):
    id: UUID
    created_at: datetime
    ai_tldr: Optional[str]
    ai_summary: Optional[str]
    ai_translation: Optional[str]

# ItemState records if a specific user has read or starred a specific item
class ItemState(SQLModel, table=True):
    __tablename__ = "item_states"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True)
    item_id: UUID = Field(index=True)
    read_status: bool = Field(default=False)
    starred_status: bool = Field(default=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
