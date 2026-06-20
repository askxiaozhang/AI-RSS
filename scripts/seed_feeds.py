"""
种子数据脚本 - 添加热门科技/AI 新闻订阅源
"""
import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from src.core.database import async_session_maker, init_db
from src.models.feed import Feed, UserSubscription
from src.models.user import User
from src.core.security import get_password_hash

# 热门科技/AI 新闻 RSS 源
SEED_FEEDS = [
    {
        "title": "OpenAI News",
        "url": "https://openai.com/news/rss.xml",
        "feed_type": "standard",
    },
    {
        "title": "Anthropic News",
        "url": "https://www.anthropic.com/news",
        "feed_type": "agent_crawled",
        "crawl_instructions": "Extract all news articles from the Anthropic news page. For each article, get the title, URL link, date, and a brief description/summary if available.",
    },
    {
        "title": "Google AI Blog",
        "url": "https://blog.google/technology/ai/rss/",
        "feed_type": "standard",
    },
    {
        "title": "Google DeepMind Blog",
        "url": "https://deepmind.google/blog/rss.xml",
        "feed_type": "standard",
    },
    {
        "title": "TechCrunch AI",
        "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "feed_type": "standard",
    },
    {
        "title": "The Verge AI",
        "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
        "feed_type": "standard",
    },
    {
        "title": "Hacker News",
        "url": "https://hnrss.org/frontpage",
        "feed_type": "standard",
    },
    {
        "title": "Ars Technica AI",
        "url": "https://feeds.arstechnica.com/arstechnica/technology-lab",
        "feed_type": "standard",
    },
    {
        "title": "MIT Technology Review",
        "url": "https://www.technologyreview.com/feed/",
        "feed_type": "standard",
    },
]

BACKDOOR_EMAIL = "admin@ai-rss.com"


async def seed_feeds():
    """添加种子订阅源"""
    async with async_session_maker() as session:
        # 查找或创建后门用户
        stmt = select(User).where(User.email == BACKDOOR_EMAIL)
        result = await session.execute(stmt)
        user = result.scalars().first()

        if not user:
            user = User(
                email=BACKDOOR_EMAIL,
                hashed_password=get_password_hash("admin123"),
                preferred_language="zh"
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print(f"✅ 创建后门用户：{BACKDOOR_EMAIL}")

        # 添加订阅源
        for feed_data in SEED_FEEDS:
            # 检查是否已存在
            stmt = select(Feed).where(Feed.url == feed_data["url"])
            result = await session.execute(stmt)
            feed = result.scalars().first()

            if not feed:
                feed = Feed(**feed_data)
                session.add(feed)
                await session.commit()
                await session.refresh(feed)
                print(f"✅ 添加订阅源：{feed.title} ({feed.url})")
            else:
                print(f"⏭️  订阅源已存在：{feed.title}")

            # 检查是否已订阅
            stmt = select(UserSubscription).where(
                UserSubscription.user_id == user.id,
                UserSubscription.feed_id == feed.id
            )
            result = await session.execute(stmt)
            sub = result.scalars().first()

            if not sub:
                sub = UserSubscription(
                    user_id=user.id,
                    feed_id=feed.id,
                    folder_name="科技/AI",
                    is_active=True
                )
                session.add(sub)
                await session.commit()
                print(f"✅ 订阅：{feed.title}")
            else:
                print(f"⏭️  已订阅：{feed.title}")

        print("\n 种子数据添加完成！")


if __name__ == "__main__":
    asyncio.run(init_db())
    asyncio.run(seed_feeds())
