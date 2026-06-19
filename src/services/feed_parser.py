import feedparser
import httpx
import logging
from datetime import datetime
from typing import List, Dict, Any
import time

logger = logging.getLogger(__name__)

class FeedParserService:
    async def fetch_and_parse_standard_feed(self, url: str) -> List[Dict[str, Any]]:
        """Fetches and parses a standard RSS/Atom/JSON feed."""
        try:
            # Fetch feed XML over HTTP
            async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                feed_data = response.text
                
            # Parse using feedparser
            # Since feedparser is synchronous, we run it in a helper, but it's very fast on strings
            parsed = feedparser.parse(feed_data)
            
            items = []
            for entry in parsed.entries:
                # Extract title
                title = entry.get("title", "No Title")
                
                # Extract link
                link = entry.get("link", "")
                
                # Extract description/content
                description = entry.get("summary", "")
                if not description and "content" in entry:
                    description = entry.content[0].value
                    
                # Extract author
                author = entry.get("author", None)
                
                # Parse date
                published_at = None
                date_parsed = entry.get("published_parsed", entry.get("updated_parsed", None))
                if date_parsed:
                    try:
                        published_at = datetime.fromtimestamp(time.mktime(date_parsed))
                    except Exception:
                        published_at = datetime.utcnow()
                else:
                    published_at = datetime.utcnow()
                    
                items.append({
                    "title": title,
                    "link": link,
                    "description": description,
                    "author": author,
                    "published_at": published_at
                })
            return items
        except Exception as e:
            logger.error(f"Error parsing feed {url}: {e}")
            return []

feed_parser_service = FeedParserService()
