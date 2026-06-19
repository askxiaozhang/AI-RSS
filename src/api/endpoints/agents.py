from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any

from src.api.endpoints.auth import get_current_user
from src.models.user import User
from src.services.ai_agent import ai_agent_crawler

router = APIRouter(prefix="/agents", tags=["agents"])

class AgentTestRequest(BaseModel):
    url: str
    instructions: str

class AgentTestResponse(BaseModel):
    items_count: int
    items: List[Dict[str, Any]]

@router.post("/test-crawl", response_model=AgentTestResponse)
async def test_agent_crawl(
    payload: AgentTestRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Test endpoint allowing users or developers to verify if the AI Crawler Agent 
    correctly parses and extracts feed items from a target URL with instructions.
    """
    try:
        items = await ai_agent_crawler.crawl_and_extract(payload.url, payload.instructions)
        return AgentTestResponse(
            items_count=len(items),
            items=items
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Crawl test failed: {e}"
        )
