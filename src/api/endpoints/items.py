from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, and_
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy import outerjoin
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID, uuid4
from pydantic import BaseModel

from src.core.database import get_session
from src.api.endpoints.auth import get_current_user
from src.models.user import User
from src.models.feed import UserSubscription
from src.models.item import FeedItem, FeedItemRead, ItemState
from src.services.ai_processor import ai_processor

router = APIRouter(prefix="/items", tags=["items"])


# ---------------------------------------------------------------------------
# Response model that includes read/starred state
# ---------------------------------------------------------------------------
class FeedItemWithState(BaseModel):
    id: str
    feed_id: str
    title: str
    link: str
    raw_content: Optional[str] = None
    author: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    ai_tldr: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_translation: Optional[str] = None
    read_status: bool = False
    starred_status: bool = False


@router.get("/", response_model=List[FeedItemWithState])
async def list_items(
    days: Optional[int] = None,
    feed_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Returns all feed items from the user's subscribed feeds, with per-user
    read/starred status included (LEFT JOIN — items without state default to
    unread/not-starred).  Ordered newest-first, capped at 500.
    """
    # 1. Collect subscribed feed IDs
    subs_stmt = select(UserSubscription.feed_id).where(
        UserSubscription.user_id == current_user.id,
        UserSubscription.is_active == True,
    )
    subs_result = await session.execute(subs_stmt)
    feed_ids = [row[0] for row in subs_result.fetchall()]

    if not feed_ids:
        return []

    # 2. LEFT JOIN FeedItem ← ItemState (per user)
    stmt = (
        select(FeedItem, ItemState)
        .outerjoin(
            ItemState,
            and_(
                ItemState.item_id == FeedItem.id,
                ItemState.user_id == current_user.id,
            ),
        )
        .where(FeedItem.feed_id.in_(feed_ids))
    )

    if feed_id:
        stmt = stmt.where(FeedItem.feed_id == UUID(feed_id))

    if days:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)
        stmt = stmt.where(
            (FeedItem.published_at >= cutoff) | (FeedItem.published_at == None)
        )

    stmt = stmt.order_by(FeedItem.published_at.desc().nullslast()).limit(500)

    result = await session.execute(stmt)
    rows = result.all()

    return [
        FeedItemWithState(
            id=str(fi.id),
            feed_id=str(fi.feed_id),
            title=fi.title,
            link=fi.link,
            raw_content=fi.raw_content,
            author=fi.author,
            published_at=fi.published_at,
            created_at=fi.created_at,
            ai_tldr=fi.ai_tldr,
            ai_summary=fi.ai_summary,
            ai_translation=fi.ai_translation,
            read_status=st.read_status if st else False,
            starred_status=st.starred_status if st else False,
        )
        for fi, st in rows
    ]


# Keep legacy endpoint for background worker compatibility
@router.get("/unread", response_model=List[FeedItemRead])
async def list_unread_items(
    folder_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    stmt = (
        select(FeedItem)
        .join(ItemState, ItemState.item_id == FeedItem.id)
        .where(
            and_(
                ItemState.user_id == current_user.id,
                ItemState.read_status == False,
            )
        )
        .order_by(FeedItem.published_at.desc())
    )
    result = await session.execute(stmt)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Upsert helper
# ---------------------------------------------------------------------------
async def _get_or_create_state(
    session: AsyncSession, user_id: UUID, item_id: UUID
) -> ItemState:
    stmt = select(ItemState).where(
        ItemState.user_id == user_id,
        ItemState.item_id == item_id,
    )
    result = await session.execute(stmt)
    state = result.scalars().first()
    if not state:
        state = ItemState(user_id=user_id, item_id=item_id)
        session.add(state)
        await session.flush()
    return state


@router.post("/{item_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_item_read(
    item_id: str,
    read: bool = True,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    state = await _get_or_create_state(session, current_user.id, UUID(item_id))
    state.read_status = read
    state.updated_at = datetime.utcnow()
    session.add(state)
    await session.commit()


@router.post("/{item_id}/star", status_code=status.HTTP_204_NO_CONTENT)
async def mark_item_starred(
    item_id: str,
    starred: bool = True,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    state = await _get_or_create_state(session, current_user.id, UUID(item_id))
    state.starred_status = starred
    state.updated_at = datetime.utcnow()
    session.add(state)
    await session.commit()


# ---------------------------------------------------------------------------
# Summarize
# ---------------------------------------------------------------------------
class SummarizeResponse(BaseModel):
    tldr: str
    highlights: List[str]
    summary: str


@router.post("/{item_id}/summarize", response_model=SummarizeResponse)
async def summarize_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    item = await session.get(FeedItem, UUID(item_id))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    content = item.raw_content or item.ai_summary or item.ai_tldr or ""
    result = await ai_processor.summarize_article(item.title, content)

    item.ai_tldr = result.get("tldr", item.ai_tldr)
    item.ai_summary = result.get("summary", item.ai_summary)
    session.add(item)
    await session.commit()

    return SummarizeResponse(
        tldr=result.get("tldr", ""),
        highlights=result.get("highlights", []),
        summary=result.get("summary", ""),
    )
