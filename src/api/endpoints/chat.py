from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select, and_
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List
from uuid import UUID

from src.core.database import get_session
from src.api.endpoints.auth import get_current_user
from src.models.user import User
from src.models.chat import (
    ChatConversation, ChatConversationRead, ChatMessage, ChatMessageRead, ChatMessageCreate
)
from src.models.item import FeedItem, ItemState
from src.services.ai_processor import ai_processor

router = APIRouter(prefix="/chat", tags=["chat"])

@router.post("/conversations", response_model=ChatConversationRead, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    title: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Creates a new conversational thread for feed-related RAG."""
    conv = ChatConversation(title=title, user_id=current_user.id)
    session.add(conv)
    await session.commit()
    await session.refresh(conv)
    return conv

@router.get("/conversations", response_model=List[ChatConversationRead])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Lists all chat conversations for the current user."""
    stmt = select(ChatConversation).where(ChatConversation.user_id == current_user.id)
    result = await session.execute(stmt)
    return result.scalars().all()

@router.post("/conversations/{conv_id}/messages", response_model=ChatMessageRead)
async def send_chat_message(
    conv_id: str,
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Sends a user query, performs RAG context lookup on the user's feed items, 
    and returns the AI assistant response.
    """
    conversation = await session.get(ChatConversation, UUID(conv_id))
    if not conversation or conversation.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    # 1. Save user message
    user_msg = ChatMessage(
        conversation_id=conversation.id,
        sender="user",
        content=payload.content
    )
    session.add(user_msg)
    await session.commit()
    
    # 2. Retrieve vector embedding of the query for semantic RAG search
    # (Since pgvector is optional/mockable here, we'll do semantic retrieval by finding matchings)
    query_emb = await ai_processor.get_embedding(payload.content)
    
    # RAG: Retrieve articles from the user's active feed items to answer the question.
    # In a full pgvector setup, we would run:
    # SELECT * FROM feed_items WHERE id IN (SELECT item_id FROM item_states WHERE user_id = current_user.id)
    # ORDER BY embedding <=> query_emb LIMIT 5
    # For this skeleton, we'll retrieve the 5 most recent feed items as fallback context.
    stmt_context = (
        select(FeedItem)
        .join(ItemState, ItemState.item_id == FeedItem.id)
        .where(ItemState.user_id == current_user.id)
        .order_by(FeedItem.published_at.desc())
        .limit(5)
    )
    res_context = await session.execute(stmt_context)
    related_items = res_context.scalars().all()
    
    context_str = ""
    for item in related_items:
        context_str += f"- Title: {item.title}\n  Summary: {item.ai_summary or item.raw_content or ''}\n\n"
        
    # 3. Request LLM response with context
    llm_prompt = f"""
    You are an AI-RSS Assistant. Answer the user's question based on their subscribed articles context.
    
    Subscribed Articles Context:
    {context_str}
    
    User Question: "{payload.content}"
    
    Answer clearly and concisely.
    """
    
    assistant_content = "I could not access the AI models at this moment. Please check your API keys."
    
    if ai_processor.gemini_client:
        try:
            response = ai_processor.gemini_client.models.generate_content(
                model=settings.DEFAULT_LLM_MODEL,
                contents=llm_prompt,
            )
            assistant_content = response.text.strip()
        except Exception:
            pass
    elif ai_processor.openai_client:
        try:
            response = await ai_processor.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": llm_prompt}
                ]
            )
            assistant_content = response.choices[0].message.content.strip()
        except Exception:
            pass
            
    # 4. Save assistant response
    assistant_msg = ChatMessage(
        conversation_id=conversation.id,
        sender="assistant",
        content=assistant_content
    )
    session.add(assistant_msg)
    await session.commit()
    await session.refresh(assistant_msg)
    
    return assistant_msg
