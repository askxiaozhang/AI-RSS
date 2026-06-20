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

        # 4. Invoke LLM via unified helper
        data = await ai_processor._call_llm_json(
            prompt,
            system_prompt="You are a professional web data extraction agent.",
        )
        if data:
            return data.get("items", [])

        # Return empty list if no API or all failed
        return []

    async def analyze_page_structure(self, url: str) -> Dict[str, Any]:
        """
        AI Agent crawls the website, simplifies its DOM tree structure,
        and analyzes it to return the CSS selectors for key elements.
        """
        html = await scraper_service.fetch_html(url)
        if not html:
            logger.error(f"AI Agent failed to crawl {url} for structure analysis.")
            return {}

        simplified_dom = scraper_service.get_simplified_dom(html)

        prompt = f"""
        You are a web scraping AI Agent. Analyze the simplified DOM structure of the webpage and determine the recurring list items/articles structure.
        Identify the CSS selectors needed to parse:
        1. The container element representing each article/item card.
        2. The title element inside the container.
        3. The link element (anchor tag) inside the container.
        4. The description/snippet element inside the container.

        Target URL: {url}

        Simplified DOM Structure:
        {simplified_dom}

        Required JSON Output format:
        {{
            "container_selector": "CSS selector for the container element (e.g. '.athing', 'div.card', 'article')",
            "title_selector": "CSS selector for the title relative to the container (e.g. 'h2', 'a.storylink', '.card-title')",
            "link_selector": "CSS selector for the link anchor tag relative to the container (e.g. 'a', 'a.storylink')",
            "description_selector": "CSS selector for the description relative to the container (e.g. 'p', '.card-body', '.text-muted')",
            "explanation": "Brief explanation of the identified selectors and structure pattern"
        }}

        Rules:
        1. Keep the selectors standard, valid, and clean.
        2. Return ONLY valid raw JSON.
        """

        # Invoke LLM via unified helper
        data = await ai_processor._call_llm_json(
            prompt,
            system_prompt="You are a professional web data extraction agent.",
        )
        if data:
            return data

        # Fallback default selectors for generic list
        return {
            "container_selector": "article, div.post, div.item, li.item",
            "title_selector": "h1, h2, h3, a.title",
            "link_selector": "a",
            "description_selector": "p, .description, .summary",
            "explanation": "Fallback selectors used as no AI model is active/configured."
        }


ai_agent_crawler = AIAgentCrawler()
