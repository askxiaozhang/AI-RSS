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

    def get_simplified_dom(self, html: str, max_depth: int = 4) -> str:
        """Extracts a simplified structure of the DOM tree (only tags, classes, and IDs) to fit LLM limits."""
        if not html:
            return ""
        try:
            soup = BeautifulSoup(html, "html.parser")
            # Decompose boilerplate
            for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "svg", "img"]):
                element.decompose()
                
            def simplify(node, depth):
                if depth > max_depth or node is None:
                    return ""
                if node.name is None:
                    return ""
                
                class_str = f" class=\"{' '.join(node.get('class'))}\"" if node.has_attr("class") and node.get("class") else ""
                id_str = f" id=\"{node.get('id')}\"" if node.has_attr("id") and node.get("id") else ""
                
                children_str = ""
                for child in node.children:
                    if child.name:
                        children_str += simplify(child, depth + 1)
                
                # If no children and no text, ignore
                text_len = len(node.get_text(strip=True))
                if not children_str and text_len == 0:
                    return ""
                
                text_preview = f" ({node.get_text(strip=True)[:30]}...)" if not children_str and text_len > 0 else ""
                
                return f"<{node.name}{id_str}{class_str}>{text_preview}{children_str}</{node.name}>\n"

            return simplify(soup.body or soup, 0)[:8000] # Limit to 8k chars
        except Exception as e:
            logger.error(f"Error simplifying DOM: {e}")
            return html[:5000]

    def parse_with_selectors(self, html: str, selectors: dict, base_url: str = "") -> list:
        """Parses the HTML using custom CSS selectors returned by the AI agent."""
        from urllib.parse import urljoin
        if not html:
            return []
        try:
            soup = BeautifulSoup(html, "html.parser")
            container_sel = selectors.get("container_selector")
            title_sel = selectors.get("title_selector")
            link_sel = selectors.get("link_selector")
            desc_sel = selectors.get("description_selector")
            
            if not container_sel:
                return []
                
            items = []
            containers = soup.select(container_sel)
            for c in containers:
                # Find title
                title_el = c.select_one(title_sel) if title_sel else c
                title = title_el.get_text(strip=True) if title_el else ""
                
                # Find link
                link_el = c.select_one(link_sel) if link_sel else c
                if link_el and link_el.name != 'a':
                    # If selector doesn't point to 'a', find nested anchor
                    link_el = link_el.find('a') or link_el
                link = link_el.get("href", "") if link_el else ""
                if link and base_url:
                    link = urljoin(base_url, link)
                
                # Find description
                desc_el = c.select_one(desc_sel) if desc_sel else None
                desc = desc_el.get_text(strip=True) if desc_el else ""
                
                if title or link:
                    items.append({
                        "title": title,
                        "link": link,
                        "description": desc
                    })
            return items
        except Exception as e:
            logger.error(f"Error parsing with selectors: {e}")
            return []

scraper_service = ScraperService()
