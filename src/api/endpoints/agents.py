from urllib.parse import urljoin

from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from src.api.endpoints.auth import get_current_user
from src.models.user import User
from src.services.ai_agent import ai_agent_crawler
from src.services.scraper import scraper_service
from src.services.ai_processor import ai_processor

router = APIRouter(prefix="/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# Interactive crawl builder helpers
# ---------------------------------------------------------------------------

class FetchPreviewRequest(BaseModel):
    url: str

class FetchPreviewResponse(BaseModel):
    title: str
    html: str  # sanitised <body> HTML, safe to render client-side


@router.post("/fetch-preview", response_model=FetchPreviewResponse)
async def fetch_preview(
    payload: FetchPreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """Fetch a page and return sanitised HTML for the interactive selector UI.

    Returns a complete <head>…<body>… string so the iframe renders with full
    CSS.  Only executable content (script/noscript/iframe/form) is stripped.
    Link hrefs are preserved so browse-mode navigation works client-side.
    """
    raw = await scraper_service.fetch_html(payload.url)
    if not raw:
        raise HTTPException(status_code=400, detail="无法访问该网页，请检查地址是否正确")

    soup = BeautifulSoup(raw, "html.parser")

    title_tag = soup.find("title")
    title = title_tag.get_text(strip=True) if title_tag else payload.url

    # Strip only executable / embedding elements — keep <style> and CSS links
    for tag in soup(["script", "noscript", "iframe", "form",
                     "canvas", "object", "embed"]):
        tag.decompose()

    # Remove on* event attributes everywhere; keep href (browse-mode needs it)
    for tag in soup.find_all(True):
        for attr in list(tag.attrs.keys()):
            if attr.lower().startswith("on"):
                del tag.attrs[attr]

    # Rewrite relative URLs to absolute (images, stylesheets, etc.)
    for tag, attr in [("img", "src"), ("link", "href"), ("source", "src"),
                      ("video", "poster"), ("input", "src")]:
        for el in soup.find_all(tag):
            val = el.get(attr, "")
            if val and not val.startswith(("http", "data:", "//", "#", "mailto:")):
                el[attr] = urljoin(payload.url, val)
            elif val.startswith("//"):
                el[attr] = "https:" + val

    # Inject <base href> into <head> so all remaining relative refs resolve
    head = soup.find("head")
    if not head:
        head = soup.new_tag("head")
        soup.insert(0, head)
    base = soup.new_tag("base", href=payload.url)
    head.insert(0, base)

    body = soup.find("body") or soup
    # Return head + body so the iframe gets proper stylesheets
    return FetchPreviewResponse(title=title, html=str(head) + str(body))


class PreviewSelectorRequest(BaseModel):
    url: str
    selector: str  # CSS selector for the repeating article container

class PreviewSelectorItem(BaseModel):
    title: str
    link: str
    description: str

class PreviewSelectorResponse(BaseModel):
    count: int
    items: List[PreviewSelectorItem]


@router.post("/preview-selector", response_model=PreviewSelectorResponse)
async def preview_selector(
    payload: PreviewSelectorRequest,
    current_user: User = Depends(get_current_user),
):
    """Apply a CSS selector to a URL and return a preview of the matched items."""
    raw = await scraper_service.fetch_html(payload.url)
    if not raw:
        raise HTTPException(status_code=400, detail="无法访问该网页")

    soup = BeautifulSoup(raw, "html.parser")
    try:
        containers = soup.select(payload.selector)
    except Exception:
        raise HTTPException(status_code=422, detail=f"无效的 CSS 选择器：{payload.selector}")

    items: List[PreviewSelectorItem] = []
    for c in containers[:20]:
        # Title: prefer heading > element text
        title_el = c.find(["h1", "h2", "h3", "h4", "h5", "h6"])
        title = (title_el.get_text(strip=True) if title_el else c.get_text(strip=True))[:200]

        # Link: container itself may be <a>, otherwise find nested anchor
        if c.name == "a":
            href = c.get("href", "")
        else:
            a = c.find("a")
            href = a.get("href", "") if a else ""
        link = urljoin(payload.url, href) if href else ""

        # Description: first <p>
        p = c.find("p")
        desc = p.get_text(strip=True)[:300] if p else ""

        if title or link:
            items.append(PreviewSelectorItem(title=title, link=link, description=desc))

    return PreviewSelectorResponse(count=len(items), items=items)

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
