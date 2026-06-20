import asyncio
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlmodel import select
from arq import cron
from arq.connections import RedisSettings
from src.config import settings
from src.core.database import async_session_maker
from src.models.feed import Feed, UserSubscription
from src.models.item import FeedItem, ItemState
from src.services.feed_parser import feed_parser_service
from src.services.ai_agent import ai_agent_crawler
from src.services.ai_processor import ai_processor


def _parse_date(value) -> datetime | None:
    """Coerce published_at to a datetime; handles str ISO dates from AI-crawled feeds."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)  # strip tz for naive DB column
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt.replace(tzinfo=None)
        except ValueError:
            pass
    return datetime.utcnow()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def process_feed_item(db_session, item_data: dict, feed_id: UUID):
    """Processes a single feed item: summaries, translation, and filtering."""
    # 1. Check if item already exists
    stmt = select(FeedItem).where(FeedItem.link == item_data["link"])
    result = await db_session.execute(stmt)
    existing_item = result.scalars().first()
    
    if existing_item:
        return
        
    # 2. Create new item
    new_item = FeedItem(
        feed_id=feed_id,
        title=item_data["title"],
        link=item_data["link"],
        raw_content=item_data.get("description"),
        author=item_data.get("author"),
        published_at=_parse_date(item_data.get("published_at")),
    )
    
    # 3. AI Enrichment (Summarization + score + keywords)
    try:
        summary_data = await ai_processor.summarize_article(new_item.title, new_item.raw_content or "")
        new_item.ai_tldr = summary_data.get("tldr")
        new_item.ai_summary = summary_data.get("summary")
        new_item.importance_score = summary_data.get("importance_score")
        kw = summary_data.get("keywords")
        if kw:
            import json as _json
            new_item.keywords = _json.dumps(kw, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Enrichment error: {e}")
        
    db_session.add(new_item)
    await db_session.commit()
    await db_session.refresh(new_item)
    
    # 4. Check user subscriptions to filter and notify
    stmt_subs = select(UserSubscription).where(UserSubscription.feed_id == feed_id)
    subs_result = await db_session.execute(stmt_subs)
    subscriptions = subs_result.scalars().all()
    
    for sub in subscriptions:
        # Evaluate user-defined AI filters
        keep = True
        if sub.ai_filter_rules:
            keep = await ai_processor.filter_article(
                new_item.title,
                new_item.ai_summary or new_item.raw_content or "",
                sub.ai_filter_rules
            )
            
        if keep:
            # Create user-specific state for this item
            item_state = ItemState(
                user_id=sub.user_id,
                item_id=new_item.id,
                read_status=False,
                starred_status=False
            )
            db_session.add(item_state)
            
            # Optional: Translate to user's preferred language (e.g. if source is different)
            # This is where we could call ai_processor.translate_text if needed.
            
    await db_session.commit()

async def fetch_feed_job(ctx, feed_id_str: str):
    """Background task job to fetch and parse a feed (either standard or AI crawled)."""
    feed_id = UUID(feed_id_str)
    async with async_session_maker() as session:
        feed = await session.get(Feed, feed_id)
        if not feed:
            logger.error(f"Feed {feed_id} not found.")
            return
            
        logger.info(f"Starting fetch job for feed: {feed.title} ({feed.url})")
        
        items = []
        if feed.feed_type == "standard":
            items = await feed_parser_service.fetch_and_parse_standard_feed(feed.url)
        elif feed.feed_type == "agent_crawled" and feed.crawl_instructions:
            items = await ai_agent_crawler.crawl_and_extract(feed.url, feed.crawl_instructions)
            
        logger.info(f"Fetched {len(items)} items for feed {feed.title}")
        
        # Process each item sequentially; rollback and continue on per-item errors
        for item in items:
            try:
                await process_feed_item(session, item, feed.id)
            except Exception as e:
                logger.error(f"Error processing item {item.get('link')}: {e}")
                await session.rollback()
                
        # Update feed fetch status
        feed.last_fetched_at = datetime.utcnow()
        session.add(feed)
        await session.commit()

async def schedule_due_feeds(ctx):
    """Cron job: enqueue fetch_feed_job for every feed whose refresh interval has elapsed."""
    now = datetime.utcnow()
    async with async_session_maker() as session:
        result = await session.execute(select(Feed))
        feeds = result.scalars().all()

    due = [
        f for f in feeds
        if f.last_fetched_at is None
        or (now - f.last_fetched_at) >= timedelta(seconds=f.refresh_interval)
    ]

    if not due:
        logger.info("schedule_due_feeds: no feeds due for refresh")
        return

    redis = ctx["redis"]
    for feed in due:
        await redis.enqueue_job("fetch_feed_job", str(feed.id))
        logger.info(f"Scheduled refresh for feed: {feed.title} (interval={feed.refresh_interval}s)")


async def startup(ctx):
    logger.info("Background Worker starting up...")

async def shutdown(ctx):
    logger.info("Background Worker shutting down...")

class WorkerSettings:
    """arq worker configuration settings."""
    functions = [fetch_feed_job]
    cron_jobs = [
        # Check every 30 minutes which feeds are due and enqueue them
        cron(schedule_due_feeds, minute={0, 30}),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    job_timeout = 600  # 10 minutes per job (AI summarization of many articles is slow)
