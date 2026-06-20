"""
测试 RSS 源是否可访问
"""
import asyncio
import httpx
import feedparser
from typing import List, Dict

# 热门科技/AI 新闻 RSS 源
RSS_FEEDS = [
    {"title": "OpenAI News", "url": "https://openai.com/news/rss.xml"},
    {"title": "Google AI Blog", "url": "https://blog.google/technology/ai/rss/"},
    {"title": "Anthropic News", "url": "https://www.anthropic.com/news/rss.xml"},
    {"title": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/"},
    {"title": "The Verge AI", "url": "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"},
    {"title": "Hacker News", "url": "https://hnrss.org/frontpage"},
    {"title": "Ars Technica AI", "url": "https://feeds.arstechnica.com/arstechnica/technology-lab"},
    {"title": "MIT Technology Review", "url": "https://www.technologyreview.com/feed/"},
]


async def test_feed(feed: Dict[str, str]) -> Dict:
    """测试单个 RSS 源"""
    result = {
        "title": feed["title"],
        "url": feed["url"],
        "status": "error",
        "items_count": 0,
        "sample_items": [],
        "error": None,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(feed["url"])
            response.raise_for_status()

            # 解析 RSS
            parsed = feedparser.parse(response.content)

            if parsed.entries:
                result["status"] = "success"
                result["items_count"] = len(parsed.entries)
                # 获取前 3 个条目作为样本
                result["sample_items"] = [
                    {
                        "title": entry.get("title", "No title"),
                        "link": entry.get("link", "No link"),
                        "published": entry.get("published", "No date"),
                    }
                    for entry in parsed.entries[:3]
                ]
            else:
                result["status"] = "empty"
                result["error"] = "No entries found"

    except httpx.HTTPError as e:
        result["error"] = f"HTTP Error: {str(e)}"
    except Exception as e:
        result["error"] = f"Error: {str(e)}"

    return result


async def main():
    print("测试热门科技/AI 新闻 RSS 源\n")
    print("=" * 80)

    tasks = [test_feed(feed) for feed in RSS_FEEDS]
    results = await asyncio.gather(*tasks)

    success_count = 0
    for result in results:
        status_icon = "✅" if result["status"] == "success" else "❌"
        print(f"\n{status_icon} {result['title']}")
        print(f"   URL: {result['url']}")

        if result["status"] == "success":
            success_count += 1
            print(f"   文章数：{result['items_count']}")
            print("   最新文章：")
            for item in result["sample_items"]:
                print(f"     - {item['title'][:60]}...")
        elif result["status"] == "empty":
            print(f"   ️  无内容")
        else:
            print(f"   ❌ 错误：{result['error']}")

    print("\n" + "=" * 80)
    print(f"\n测试完成：{success_count}/{len(RSS_FEEDS)} 个源可用")


if __name__ == "__main__":
    asyncio.run(main())
