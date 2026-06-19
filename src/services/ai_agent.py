import json
import logging
from typing import List, Dict, Any, Optional
from src.services.scraper import scraper_service
from src.services.ai_processor import ai_processor
from src.config import settings

logger = logging.getLogger(__name__)

class AIAgentCrawler:
    """
    AI Agent that fetches web pages and extracts structured news/articles lists
    according to user instructions, turning any arbitrary web page into a feed.
    """
    
    async def crawl_and_extract(self, url: str, instructions: str) -> List[Dict[str, Any]]:
        # 1. Fetch raw HTML
        html = await scraper_service.fetch_html(url)
        if not html:
            logger.error(f"AI Agent failed to crawl {url} - no HTML returned.")
            return []
            
        # 2. Extract main content (or a truncated version to fit LLM window)
        cleaned_content = await scraper_service.extract_main_content(html)
        # Cap text length to avoid token limits for basic models
        context_text = cleaned_content[:15000]
        
        # 3. Formulate prompt for LLM
        prompt = f"""
        You are a web scraping AI Agent. Analyze the following webpage text content and extract a list of articles, announcements, updates, or blog posts according to the user's instructions.
        
        Target URL: {url}
        User Instructions: "{instructions}"
        
        Webpage Content (truncated):
        {context_text}
        
        Required JSON Output format:
        {{
            "items": [
                {{
                    "title": "Title of the article",
                    "link": "Absolute URL link to the article (resolve relative URLs based on the Target URL)",
                    "description": "Brief summary of the article body from the page",
                    "author": "Author name (if available, otherwise null)",
                    "published_at": "ISO formatted date string if available, e.g. '2026-06-19T00:00:00Z' (otherwise null)"
                }}
            ]
        }}
        
        Rules:
        1. Resolve relative URLs (like '/posts/1') to absolute URLs (like '{url}/posts/1' or matching domain).
        2. Extrapolate published dates into valid ISO format when possible.
        3. Only return items that match the user's instructions.
        4. Return ONLY valid raw JSON.
        """
        
        # 4. Invoke LLM
        if ai_processor.gemini_client:
            try:
                response = ai_processor.gemini_client.models.generate_content(
                    model=settings.DEFAULT_LLM_MODEL,
                    contents=prompt,
                )
                text = response.text.strip()
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                data = json.loads(text)
                return data.get("items", [])
            except Exception as e:
                logger.error(f"Gemini agent crawling failed: {e}")
                
        if ai_processor.openai_client:
            try:
                response = await ai_processor.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": "You are a professional web data extraction agent."},
                        {"role": "user", "content": prompt}
                    ]
                )
                data = json.loads(response.choices[0].message.content)
                return data.get("items", [])
            except Exception as e:
                logger.error(f"OpenAI agent crawling failed: {e}")
                
        # Return empty list if no API or both failed
        return []

ai_agent_crawler = AIAgentCrawler()
