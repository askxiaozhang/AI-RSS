import httpx
import logging
from typing import Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

class ScraperService:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
        }

    async def fetch_html(self, url: str) -> Optional[str]:
        """Fetches the raw HTML of a website."""
        try:
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=15.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.text
        except Exception as e:
            logger.error(f"HTTP scraper error fetching {url}: {e}")
            return None

    async def extract_main_content(self, html: str) -> str:
        """Helper to extract main readable text content from an HTML body (removing scripts, style, navs)."""
        if not html:
            return ""
        try:
            soup = BeautifulSoup(html, "html.parser")
            
            # Remove boilerplates
            for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
                element.decompose()
                
            # Get plain text
            text = soup.get_text(separator="\n")
            
            # Clean up excessive whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = "\n".join(chunk for chunk in chunks if chunk)
            return text
        except Exception as e:
            logger.error(f"Error cleaning HTML: {e}")
            return html[:10000]  # Fallback

scraper_service = ScraperService()
