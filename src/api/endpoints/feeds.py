from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List
from arq import create_pool
from arq.connections import RedisSettings

from src.config import settings
from src.core.database import get_session
from src.api.endpoints.auth import get_current_user
from src.models.user import User
from src.models.feed import Feed, FeedCreate, FeedRead, UserSubscription, UserSubscriptionCreate, UserSubscriptionRead

router = APIRouter(prefix="/feeds", tags=["feeds"])

@router.post("/", response_model=FeedRead, status_code=status.HTTP_201_CREATED)
async def create_feed(
    feed_in: FeedCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Creates a new Feed in the system (or retrieves it if already exists)."""
    stmt = select(Feed).where(Feed.url == feed_in.url)
    result = await session.execute(stmt)
    existing_feed = result.scalars().first()
    
    if existing_feed:
        return existing_feed
        
    db_feed = Feed.from_orm(feed_in)
    session.add(db_feed)
    await session.commit()
    await session.refresh(db_feed)
    
    # Trigger background fetch immediately
    try:
        redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
        await redis.enqueue_job("fetch_feed_job", str(db_feed.id))
    except Exception:
        # Ignore queue errors in dev if redis is not running
        pass
        
    return db_feed

@router.post("/subscribe", response_model=UserSubscriptionRead)
async def subscribe_to_feed(
    sub_in: UserSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Subscribes the logged-in user to a feed, applying custom AI filters and folder categorization."""
    # Check if feed exists
    feed = await session.get(Feed, sub_in.feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
        
    # Check if already subscribed
    stmt = select(UserSubscription).where(
        UserSubscription.user_id == current_user.id,
        UserSubscription.feed_id == sub_in.feed_id
    )
    res = await session.execute(stmt)
    if res.scalars().first():
        raise HTTPException(status_code=400, detail="Already subscribed to this feed")
        
    db_sub = UserSubscription(
        user_id=current_user.id,
        feed_id=sub_in.feed_id,
        folder_name=sub_in.folder_name,
        ai_filter_rules=sub_in.ai_filter_rules,
        is_active=sub_in.is_active
    )
    session.add(db_sub)
    await session.commit()
    await session.refresh(db_sub)
    return db_sub

@router.get("/subscriptions", response_model=List[UserSubscriptionRead])
async def list_subscriptions(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Lists all active subscriptions for the current user."""
    stmt = select(UserSubscription).where(UserSubscription.user_id == current_user.id)
    result = await session.execute(stmt)
    return result.scalars().all()

@router.put("/subscriptions/{sub_id}", response_model=UserSubscriptionRead)
async def update_subscription(
    sub_id: str,
    sub_in: UserSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Updates subscription preferences (e.g. changing folder or AI filtering rules)."""
    sub = await session.get(UserSubscription, sub_id)
    if not sub or sub.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Subscription not found")
        
    sub.folder_name = sub_in.folder_name
    sub.ai_filter_rules = sub_in.ai_filter_rules
    sub.is_active = sub_in.is_active
    
    session.add(sub)
    await session.commit()
    await session.refresh(sub)
    return sub
