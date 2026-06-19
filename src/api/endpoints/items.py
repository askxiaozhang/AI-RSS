from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, and_
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from src.core.database import get_session
from src.api.endpoints.auth import get_current_user
from src.models.user import User
from src.models.item import FeedItem, FeedItemRead, ItemState

router = APIRouter(prefix="/items", tags=["items"])

@router.get("/unread", response_model=List[FeedItemRead])
async def list_unread_items(
    folder_name: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Retrieves all unread, filtered feed items for the current user."""
    # We select FeedItems where their states indicate read_status = False for this user
    stmt = (
        select(FeedItem)
        .join(ItemState, ItemState.item_id == FeedItem.id)
        .where(
            and_(
                ItemState.user_id == current_user.id,
                ItemState.read_status == False
            )
        )
        .order_by(FeedItem.published_at.desc())
    )
    
    result = await session.execute(stmt)
    return result.scalars().all()

@router.post("/{item_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_item_read(
    item_id: str,
    read: bool = True,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Marks a specific article as read or unread."""
    stmt = select(ItemState).where(
        ItemState.user_id == current_user.id,
        ItemState.item_id == UUID(item_id)
    )
    result = await session.execute(stmt)
    state = result.scalars().first()
    
    if not state:
        raise HTTPException(status_code=404, detail="Item state not found for user")
        
    state.read_status = read
    state.updated_at = datetime.utcnow()
    
    session.add(state)
    await session.commit()

@router.post("/{item_id}/star", status_code=status.HTTP_204_NO_CONTENT)
async def mark_item_starred(
    item_id: str,
    starred: bool = True,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Bookmarks / stars a specific article."""
    stmt = select(ItemState).where(
        ItemState.user_id == current_user.id,
        ItemState.item_id == UUID(item_id)
    )
    result = await session.execute(stmt)
    state = result.scalars().first()
    
    if not state:
        raise HTTPException(status_code=404, detail="Item state not found for user")
        
    state.starred_status = starred
    state.updated_at = datetime.utcnow()
    
    session.add(state)
    await session.commit()
