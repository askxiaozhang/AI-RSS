import asyncio
import json
import logging
from typing import Optional, List, Dict, Any
from src.config import settings

logger = logging.getLogger(__name__)


class AIProcessor:
    def __init__(self):
        self.gemini_client = None
        self.openai_client = None
        self.anthropic_client = None
        # Limit concurrent LLM calls to avoid API throttling (429s)
        self._semaphore = asyncio.Semaphore(1)

        # Initialize Gemini client if API key is provided
        if settings.GEMINI_API_KEY:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
                logger.info("Gemini Client initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini Client: {e}")

        # Initialize OpenAI client if API key is provided
        if settings.OPENAI_API_KEY:
            try:
                from openai import AsyncOpenAI
                self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
                logger.info("OpenAI Client initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI Client: {e}")

        # Initialize Anthropic-compatible client if API key is provided
        if settings.ANTHROPIC_API_KEY:
            try:
                from anthropic import AsyncAnthropic
                self.anthropic_client = AsyncAnthropic(
                    api_key=settings.ANTHROPIC_API_KEY,
                    base_url=settings.ANTHROPIC_BASE_URL,
                )
                logger.info(
                    f"Anthropic Client initialized successfully (base_url={settings.ANTHROPIC_BASE_URL})."
                )
            except Exception as e:
                logger.error(f"Failed to initialize Anthropic Client: {e}")

    # ------------------------------------------------------------------
    # Unified LLM helpers — try each provider in order:
    #   Gemini → Anthropic → OpenAI
    # ------------------------------------------------------------------

    async def _call_llm(self, prompt: str, system_prompt: Optional[str] = None) -> Optional[str]:
        """Call LLM with a plain-text prompt, return the raw text response or None on failure."""
        async with self._semaphore:
            return await self._call_llm_inner(prompt, system_prompt)

    async def _call_llm_inner(self, prompt: str, system_prompt: Optional[str] = None) -> Optional[str]:
        # 1. Gemini
        if self.gemini_client:
            try:
                response = self.gemini_client.models.generate_content(
                    model=settings.DEFAULT_LLM_MODEL,
                    contents=prompt,
                )
                return response.text.strip()
            except Exception as e:
                logger.error(f"Gemini LLM call failed: {e}")

        # 2. Anthropic (async)
        if self.anthropic_client:
            try:
                messages = [{"role": "user", "content": prompt}]
                kwargs: Dict[str, Any] = {
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 4096,
                    "messages": messages,
                }
                if system_prompt:
                    kwargs["system"] = system_prompt
                response = await self.anthropic_client.messages.create(**kwargs)
                # Skip ThinkingBlock entries (extended thinking); find first TextBlock
                text_block = next((b for b in response.content if hasattr(b, "text")), None)
                if text_block:
                    return text_block.text.strip()
            except Exception as e:
                logger.error(f"Anthropic LLM call failed: {e}")

        # 3. OpenAI (async)
        if self.openai_client:
            try:
                msgs = []
                if system_prompt:
                    msgs.append({"role": "system", "content": system_prompt})
                msgs.append({"role": "user", "content": prompt})
                response = await self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=msgs,
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"OpenAI LLM call failed: {e}")

        return None

    async def _call_llm_json(self, prompt: str, system_prompt: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Call LLM expecting a JSON response. Parses and returns the dict, or None on failure."""
        async with self._semaphore:
            return await self._call_llm_json_inner(prompt, system_prompt)

    async def _call_llm_json_inner(self, prompt: str, system_prompt: Optional[str] = None) -> Optional[Dict[str, Any]]:
        # 1. Gemini
        if self.gemini_client:
            try:
                response = self.gemini_client.models.generate_content(
                    model=settings.DEFAULT_LLM_MODEL,
                    contents=prompt,
                )
                text = response.text.strip()
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                return json.loads(text)
            except Exception as e:
                logger.error(f"Gemini JSON call failed: {e}")

        # 2. Anthropic (async)
        if self.anthropic_client:
            try:
                messages = [{"role": "user", "content": prompt}]
                kwargs: Dict[str, Any] = {
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 4096,
                    "messages": messages,
                }
                if system_prompt:
                    kwargs["system"] = system_prompt
                response = await self.anthropic_client.messages.create(**kwargs)
                # Skip ThinkingBlock entries; find first TextBlock
                text_block = next((b for b in response.content if hasattr(b, "text")), None)
                if not text_block:
                    return None
                text = text_block.text.strip()
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                return json.loads(text)
            except Exception as e:
                logger.error(f"Anthropic JSON call failed: {e}")

        # 3. OpenAI (async, with JSON mode)
        if self.openai_client:
            try:
                msgs = []
                if system_prompt:
                    msgs.append({"role": "system", "content": system_prompt})
                msgs.append({"role": "user", "content": prompt})
                response = await self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    response_format={"type": "json_object"},
                    messages=msgs,
                )
                return json.loads(response.choices[0].message.content)
            except Exception as e:
                logger.error(f"OpenAI JSON call failed: {e}")

        return None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def summarize_article(self, title: str, content: str, custom_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Generates a structured analysis including TL;DR, highlights, summary,
        an importance score (1–10), and 3–5 keyword tags.
        """
        extra = f"\n\nAdditional user instruction: {custom_prompt.strip()}" if custom_prompt and custom_prompt.strip() else ""
        prompt = f"""
        Analyze the following article and return a structured JSON response.{extra}

        Title: {title}
        Content: {content}

        Required JSON format:
        {{
            "tldr": "One sentence summarizing the main point.",
            "highlights": [
                "Key takeaway 1",
                "Key takeaway 2",
                "Key takeaway 3"
            ],
            "summary": "A concise 150-word summary overview of the article.",
            "importance_score": <float 1.0-10.0>,
            "keywords": ["keyword1", "keyword2", "keyword3"]
        }}

        Scoring guide for importance_score:
        - 9-10: Breaking news, major model/product launch, >$100M funding, industry-shifting event
        - 7-8: Significant update, important research, notable partnership or acquisition
        - 5-6: Useful article, moderate impact, relevant industry news
        - 3-4: Minor update, opinion piece, niche interest
        - 1-2: Low-signal content, repetitive or tangential

        Keyword guide (3-5 tags, mix of):
        - Domain (领域): e.g. AI、科技、商业、政策、安全、医疗、自动驾驶
        - Type (类型): e.g. 产品发布、研究论文、融资、合作、监管、开源
        - Key entity: e.g. OpenAI、Anthropic、Google、Meta

        Prefer Chinese tags for domain/type. Use the original name for entities.
        Return ONLY valid raw JSON.
        """

        result = await self._call_llm_json(
            prompt,
            system_prompt="You are an AI assistant that analyses tech/AI articles and outputs structured JSON.",
        )
        if result:
            return result

        return {
            "tldr": f"Summarized title: {title}",
            "highlights": ["Content length: " + str(len(content)) + " characters."],
            "summary": content[:150] + "..." if content else "",
            "importance_score": None,
            "keywords": [],
        }

    async def filter_article(self, title: str, summary: str, rule: str) -> bool:
        """
        Evaluates whether an article matches the user's semantic filtering rules.
        Returns True to keep the article, False to filter it out.
        """
        prompt = f"""
        You are a smart news filter. Decide if the article matches the user's filtering criteria.

        Criteria: "{rule}"

        Article Title: {title}
        Article Summary: {summary}

        Output your decision in JSON format:
        {{
            "match": true or false,
            "reason": "Brief explanation of why it matched or did not match the criteria."
        }}

        Return ONLY valid raw JSON.
        """

        result = await self._call_llm_json(
            prompt,
            system_prompt="You are a precise classifier deciding if text matches filter criteria.",
        )
        if result:
            return result.get("match", True)

        return True

    async def translate_text(self, text: str, target_lang: str) -> str:
        """Translates the text into target language."""
        if not text:
            return ""

        prompt = f"Translate the following text into the language code '{target_lang}'. Return ONLY the translated text, do not add comments or explanations:\n\n{text}"

        result = await self._call_llm(prompt)
        return result if result else text

    async def get_embedding(self, text: str) -> List[float]:
        """Generates vector embedding for the text (for semantic search & pgvector)."""
        if not text:
            return [0.0] * 1536

        if self.gemini_client:
            try:
                response = self.gemini_client.models.embed_content(
                    model=settings.DEFAULT_EMBEDDING_MODEL,
                    contents=text
                )
                if hasattr(response, 'embeddings') and response.embeddings:
                    return response.embeddings[0].values
                elif hasattr(response, 'embedding') and response.embedding:
                    return response.embedding.values
            except Exception as e:
                logger.error(f"Gemini embedding failed: {e}")

        if self.openai_client:
            try:
                response = await self.openai_client.embeddings.create(
                    model="text-embedding-3-small",
                    input=text
                )
                return response.data[0].embedding
            except Exception as e:
                logger.error(f"OpenAI embedding failed: {e}")

        # Fallback dummy embedding (1536 dimensions)
        return [0.0] * 1536


ai_processor = AIProcessor()
