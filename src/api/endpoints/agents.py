from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from src.api.endpoints.auth import get_current_user
from src.models.user import User
from src.services.ai_agent import ai_agent_crawler
from src.services.scraper import scraper_service
from src.services.ai_processor import ai_processor

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

class AnalyzeStructureRequest(BaseModel):
    url: str

class AnalyzeStructureResponse(BaseModel):
    container_selector: str
    title_selector: str
    link_selector: str
    description_selector: str
    explanation: Optional[str] = None

@router.post("/analyze-structure", response_model=AnalyzeStructureResponse)
async def analyze_structure(payload: AnalyzeStructureRequest):
    """
    AI-Agent analyzes the target webpage structure and returns the CSS selectors of target elements.
    """
    try:
        selectors = await ai_agent_crawler.analyze_page_structure(payload.url)
        return AnalyzeStructureResponse(
            container_selector=selectors.get("container_selector", "article"),
            title_selector=selectors.get("title_selector", "h2"),
            link_selector=selectors.get("link_selector", "a"),
            description_selector=selectors.get("description_selector", "p"),
            explanation=selectors.get("explanation", "")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Structure analysis failed: {e}"
        )

class ParseElementsRequest(BaseModel):
    url: str
    container_selector: str
    title_selector: str
    link_selector: str
    description_selector: str

class ParsedItem(BaseModel):
    title: str
    link: str
    description: str

class ParseElementsResponse(BaseModel):
    items_count: int
    items: List[ParsedItem]

@router.post("/parse-elements", response_model=ParseElementsResponse)
async def parse_elements(payload: ParseElementsRequest):
    """
    Parser parses the target page's DOM elements using the CSS selectors and returns items.
    """
    try:
        html = await scraper_service.fetch_html(payload.url)
        if not html:
            raise HTTPException(status_code=400, detail="Failed to fetch target URL content.")
        
        selectors = {
            "container_selector": payload.container_selector,
            "title_selector": payload.title_selector,
            "link_selector": payload.link_selector,
            "description_selector": payload.description_selector
        }
        items = scraper_service.parse_with_selectors(html, selectors, base_url=payload.url)
        return ParseElementsResponse(
            items_count=len(items),
            items=[ParsedItem(**item) for item in items]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Parsing elements failed: {e}"
        )

class SummarizeRequest(BaseModel):
    title: str
    content: str

class SummarizeResponse(BaseModel):
    tldr: str
    highlights: List[str]
    summary: str

@router.post("/summarize-content", response_model=SummarizeResponse)
async def summarize_content(payload: SummarizeRequest):
    """
    AI summarizes the original content.
    """
    try:
        summary_data = await ai_processor.summarize_article(payload.title, payload.content)
        return SummarizeResponse(
            tldr=summary_data.get("tldr", ""),
            highlights=summary_data.get("highlights", []),
            summary=summary_data.get("summary", "")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Content summarization failed: {e}"
        )
