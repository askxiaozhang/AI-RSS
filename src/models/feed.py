from uuid import UUID, uuid4
from datetime import datetime
from sqlmodel import SQLModel, Field
from typing import Optional

class FeedBase(SQLModel):
    title: str
    url: str
    feed_type: str = "standard"  # "standard" or "agent_crawled"
    crawl_instructions: Optional[str] = None
    refresh_interval: int = 21600  # in seconds (default 6 hours)

class Feed(FeedBase, table=True):
    __tablename__ = "feeds"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    last_fetched_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FeedCreate(FeedBase):
    pass

class FeedRead(FeedBase):
    id: UUID
    last_fetched_at: Optional[datetime]
    created_at: datetime

# UserSubscription connects users to feeds, supporting custom semantic filters
class UserSubscriptionBase(SQLModel):
    feed_id: UUID
    folder_name: str = "Uncategorized"
    ai_filter_rules: Optional[str] = None  # e.g., "Only show articles about large language models"
    is_active: bool = True

class UserSubscription(UserSubscriptionBase, table=True):
    __tablename__ = "user_subscriptions"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserSubscriptionCreate(UserSubscriptionBase):
    pass

class UserSubscriptionRead(UserSubscriptionBase):
    id: UUID
    user_id: UUID
    created_at: datetime
