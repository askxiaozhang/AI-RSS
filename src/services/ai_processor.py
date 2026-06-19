import json
import logging
from typing import Optional, List, Dict, Any
from src.config import settings

logger = logging.getLogger(__name__)

class AIProcessor:
    def __init__(self):
        self.gemini_client = None
        self.openai_client = None
        
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

    async def summarize_article(self, title: str, content: str) -> Dict[str, Any]:
        """
        Generates a summary of the article including:
        - TL;DR (one sentence)
        - Highlights (3 key bullet points)
        - Full Summary (150-word overview)
        """
        prompt = f"""
        Analyze the following article and generate a structured summary in JSON format.
        
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
            "summary": "A concise 150-word summary overview of the article."
        }}
        
        Return ONLY valid raw JSON.
        """
        
        # Try Gemini first, then OpenAI as fallback
        if self.gemini_client:
            try:
                # Running synchronously in arq worker is fine, or we can use thread pool,
                # but google-genai client.models.generate_content is blocking. We can call it directly.
                response = self.gemini_client.models.generate_content(
                    model=settings.DEFAULT_LLM_MODEL,
                    contents=prompt,
                )
                text = response.text.strip()
                # strip potential markdown codeblock formatting ```json ... ```
                if text.startswith("```"):
                    text = text.split("```")[1]
                    if text.startswith("json"):
                        text = text[4:]
                return json.loads(text)
            except Exception as e:
                logger.error(f"Gemini summarization failed: {e}")
                
        if self.openai_client:
            try:
                response = await self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": "You are an AI assistant specialized in reading articles and outputting structured JSON summaries."},
                        {"role": "user", "content": prompt}
                    ]
                )
                text = response.choices[0].message.content
                return json.loads(text)
            except Exception as e:
                logger.error(f"OpenAI summarization failed: {e}")
                
        # Return fallback mock/simple output if no AI service is configured or both failed
        return {
            "tldr": f"Summarized title: {title}",
            "highlights": ["Content length: " + str(len(content)) + " characters."],
            "summary": content[:150] + "..." if content else ""
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
                data = json.loads(text)
                return data.get("match", True)
            except Exception as e:
                logger.error(f"Gemini filtering failed: {e}")
                
        if self.openai_client:
            try:
                response = await self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": "You are a precise classifier deciding if text matches filter criteria."},
                        {"role": "user", "content": prompt}
                    ]
                )
                data = json.loads(response.choices[0].message.content)
                return data.get("match", True)
            except Exception as e:
                logger.error(f"OpenAI filtering failed: {e}")
                
        return True

    async def translate_text(self, text: str, target_lang: str) -> str:
        """Translates the text into target language."""
        if not text:
            return ""
            
        prompt = f"Translate the following text into the language code '{target_lang}'. Return ONLY the translated text, do not add comments or explanations:\n\n{text}"
        
        if self.gemini_client:
            try:
                response = self.gemini_client.models.generate_content(
                    model=settings.DEFAULT_LLM_MODEL,
                    contents=prompt,
                )
                return response.text.strip()
            except Exception as e:
                logger.error(f"Gemini translation failed: {e}")
                
        if self.openai_client:
            try:
                response = await self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "user", "content": prompt}
                    ]
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"OpenAI translation failed: {e}")
                
        return text

    async def get_embedding(self, text: str) -> List[float]:
        """Generates vector embedding for the text (for semantic search & pgvector)."""
        # If no AI client, return a mock/dummy 1536-dim embedding vector
        if not text:
            return [0.0] * 1536
            
        if self.gemini_client:
            try:
                # google-genai SDK uses client.models.embed_content
                response = self.gemini_client.models.embed_content(
                    model=settings.DEFAULT_EMBEDDING_MODEL,
                    contents=text
                )
                # response.embeddings contains the embedding
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
