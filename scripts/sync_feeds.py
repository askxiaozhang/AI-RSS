"""
同步抓取订阅源并保存文章到数据库
"""
import asyncio
from uuid import UUID
from sqlmodel import select
from src.core.database import async_session_maker
from src.models.feed import Feed, UserSubscription
from src.models.item import FeedItem, ItemState
from src.services.feed_parser import feed_parser_service


async def sync_feed(feed_id: UUID, limit: int = 10):
    """同步抓取单个订阅源"""
    async with async_session_maker() as session:
        # 获取 feed
        feed = await session.get(Feed, feed_id)
        if not feed:
            print(f"  ❌ Feed {feed_id} 不存在")
            return 0

        print(f"\n📡 抓取：{feed.title}")
        print(f"   URL: {feed.url}")

        # 抓取文章
        items = await feed_parser_service.fetch_and_parse_standard_feed(feed.url)
        print(f"   获取 {len(items)} 篇文章")

        if not items:
            return 0

        # 只处理前 limit 篇
        items = items[:limit]

        # 获取该 feed 的所有订阅用户
        stmt_subs = select(UserSubscription).where(UserSubscription.feed_id == feed_id)
        subs_result = await session.exec(stmt_subs)
        subscriptions = subs_result.all()

        saved_count = 0
        for item_data in items:
            # 检查是否已存在
            stmt = select(FeedItem).where(FeedItem.link == item_data["link"])
            result = await session.exec(stmt)
            existing = result.first()

            if existing:
                continue

            # 创建新文章
            new_item = FeedItem(
                feed_id=feed_id,
                title=item_data["title"],
                link=item_data["link"],
                raw_content=item_data.get("description", ""),
                author=item_data.get("author"),
                published_at=item_data.get("published_at"),
            )
            session.add(new_item)
            await session.commit()
            await session.refresh(new_item)

            # 为每个订阅用户创建状态
            for sub in subscriptions:
                item_state = ItemState(
                    user_id=sub.user_id,
                    item_id=new_item.id,
                    read_status=False,
                    starred_status=False,
                )
                session.add(item_state)

            await session.commit()
            saved_count += 1

            # 打印前 3 篇
            if saved_count <= 3:
                print(f"   ✅ {item_data['title'][:50]}...")

        print(f"   保存 {saved_count} 篇新文章")
        return saved_count


async def main():
    print("=" * 60)
    print("同步抓取科技/AI 订阅源")
    print("=" * 60)

    # 科技/AI 相关的 feed IDs
    feed_ids = [
        UUID("8bba4717-3edc-486e-870c-c6c4fada243b"),  # OpenAI News
        UUID("5b161582-78ed-422d-b18a-4125ab370aad"),  # Google AI Blog
        UUID("63177254-1bbc-400b-b3b9-22ff31f6cab5"),  # Google DeepMind Blog
        UUID("1f22b52e-302e-434f-9ba5-beb69449d8a2"),  # TechCrunch AI
        UUID("46f20ac1-32a2-45a6-b6be-66159e67410e"),  # The Verge AI
        UUID("f8e284ec-1127-4950-9987-c58124a64a8b"),  # Hacker News
        UUID("821b5bb4-4622-4add-b2eb-3914b9c01620"),  # Ars Technica AI
        UUID("4dc41221-6f6b-4122-9eea-1de7920d6e47"),  # MIT Technology Review
    ]

    total_saved = 0
    for feed_id in feed_ids:
        try:
            count = await sync_feed(feed_id, limit=5)
            total_saved += count
        except Exception as e:
            print(f"  ❌ 错误：{e}")

    print("\n" + "=" * 60)
    print(f"完成！共保存 {total_saved} 篇文章")

    # 查询后门用户的未读文章数
    async with async_session_maker() as session:
        stmt = (
            select(FeedItem)
            .join(ItemState, ItemState.item_id == FeedItem.id)
            .where(
                ItemState.user_id == UUID("00000000-0000-0000-0000-000000000000"),  # 需要替换为实际用户 ID
                ItemState.read_status == False,
            )
        )
        # 简化查询
        from src.models.user import User

        stmt_user = select(User).where(User.email == "admin@ai-rss.com")
        result = await session.exec(stmt_user)
        user = result.first()

        if user:
            stmt_count = select(ItemState).where(
                ItemState.user_id == user.id,
                ItemState.read_status == False,
            )
            count_result = await session.exec(stmt_count)
            unread_count = len(count_result.all())
            print(f"后门用户未读文章：{unread_count} 篇")


if __name__ == "__main__":
    asyncio.run(main())
