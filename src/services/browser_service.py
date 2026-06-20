"""
Browser rendering service using Playwright.

Maintains a pool of reusable browser sessions keyed by (user_id, session_id)
so the page doesn't need to reload on every click.  Sessions auto-expire after
5 minutes of inactivity.
"""
import asyncio
import base64
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Optional

from playwright.async_api import async_playwright, Browser, Page, Playwright

logger = logging.getLogger(__name__)

# How long (seconds) to keep an idle session alive
SESSION_TTL = 300


@dataclass
class BrowserSession:
    page: Page
    url: str
    last_used: float = field(default_factory=time.monotonic)

    def touch(self):
        self.last_used = time.monotonic()

    def is_expired(self) -> bool:
        return (time.monotonic() - self.last_used) > SESSION_TTL


class BrowserService:
    def __init__(self):
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._sessions: Dict[str, BrowserSession] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def _ensure_browser(self):
        """Lazy-init the shared Playwright browser."""
        if self._browser and self._browser.is_connected():
            return
        if not self._playwright:
            self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        logger.info("Playwright Chromium launched")

    async def close(self):
        for session in self._sessions.values():
            try:
                await session.page.close()
            except Exception:
                pass
        self._sessions.clear()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    # ------------------------------------------------------------------
    # Session management
    # ------------------------------------------------------------------

    async def _get_or_create_session(self, session_id: str, url: str) -> BrowserSession:
        """Return existing session if URL matches, else create a new one."""
        async with self._lock:
            # Evict expired sessions
            expired = [k for k, s in self._sessions.items() if s.is_expired()]
            for k in expired:
                try:
                    await self._sessions[k].page.close()
                except Exception:
                    pass
                del self._sessions[k]
                logger.debug(f"Evicted expired session {k}")

            session = self._sessions.get(session_id)
            if session and session.url == url and not session.is_expired():
                session.touch()
                return session

            # Close old session for this key if URL changed
            if session:
                try:
                    await session.page.close()
                except Exception:
                    pass

            await self._ensure_browser()
            ctx = await self._browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            page = await ctx.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            # Extra wait for JS-heavy SPAs
            await page.wait_for_timeout(2500)

            new_session = BrowserSession(page=page, url=url)
            self._sessions[session_id] = new_session
            logger.info(f"Created browser session {session_id} for {url}")
            return new_session

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def render(self, url: str, session_id: str) -> dict:
        """
        Navigate to URL, take a screenshot, return base64 PNG + page metadata.
        Reuses an existing session when possible.
        """
        session = await self._get_or_create_session(session_id, url)
        page = session.page

        title = await page.title()
        viewport = page.viewport_size or {"width": 1280, "height": 800}

        # Full screenshot of visible viewport
        screenshot_bytes = await page.screenshot(
            type="jpeg", quality=85, full_page=False
        )
        screenshot_b64 = base64.b64encode(screenshot_bytes).decode()

        return {
            "title": title,
            "screenshot": screenshot_b64,
            "width": viewport["width"],
            "height": viewport["height"],
            "current_url": page.url,
        }

    async def click_and_get_selector(self, session_id: str, x: int, y: int) -> dict:
        """
        Find the element at viewport coordinates (x, y) in the live page.
        Returns:
          selector      — CSS selector for the repeating container
          match_count   — how many sibling elements the selector matches
          highlights    — list of {x,y,width,height} bounding boxes for matched elements
          sample_text   — first element's trimmed text
        """
        session = self._sessions.get(session_id)
        if not session:
            return {"error": "Session expired — please reload the page"}

        session.touch()
        page = session.page

        result = await page.evaluate(
            """([px, py]) => {
            const el = document.elementFromPoint(px, py);
            if (!el || el === document.body || el === document.documentElement) {
                return { error: "No element at this position" };
            }

            function makeSelector(el) {
                if (el.id) return '#' + CSS.escape(el.id);
                const tag = el.tagName.toLowerCase();
                const classes = [...el.classList]
                    .filter(c => c && !/^(active|selected|hover|focus|show|open|is-|js-)/.test(c))
                    .slice(0, 2);
                return classes.length ? tag + '.' + classes.join('.') : tag;
            }

            // Extract link: self > child a > ancestor a
            function getLink(el) {
                if (el.tagName === 'A' && el.href) return el.href;
                const child = el.querySelector('a[href]');
                if (child) return child.href;
                let p = el.parentElement;
                while (p && p !== document.body) {
                    if (p.tagName === 'A' && p.href) return p.href;
                    p = p.parentElement;
                }
                return '';
            }

            // Extract title: heading > a text > img alt > aria-label > text
            function getTitle(el) {
                const h = el.querySelector('h1,h2,h3,h4,h5,h6');
                if (h) return h.innerText.trim();
                if (el.tagName === 'A') return (el.getAttribute('title') || el.innerText || '').trim();
                const a = el.querySelector('a[href]');
                if (a) return (a.getAttribute('title') || a.innerText || '').trim();
                const img = el.querySelector('img[alt]');
                if (img && img.alt) return img.alt.trim();
                const label = el.getAttribute('aria-label') || el.getAttribute('title');
                if (label) return label.trim();
                const txt = (el.innerText || '').trim();
                return txt.length < 300 ? txt : txt.slice(0, 200);
            }

            // Check if element carries useful content
            function hasContent(el) {
                return !!(getTitle(el) || getLink(el));
            }

            // Walk up to find repeating ancestor WITH content
            function findRepeating(el) {
                let best = null;
                let cur = el;
                while (cur.parentElement && cur.parentElement !== document.body) {
                    const parent = cur.parentElement;
                    const same = [...parent.children].filter(c => c.tagName === cur.tagName);
                    if (same.length >= 2) {
                        // Prefer the first ancestor that has usable content
                        if (!best || hasContent(cur)) best = cur;
                        // Keep walking up — a higher container might be richer
                        if (hasContent(cur) && same.length >= 2) break;
                    }
                    cur = parent;
                }
                return best || cur;
            }

            const target = findRepeating(el);
            const selector = makeSelector(target);

            let matches = [];
            try { matches = [...document.querySelectorAll(selector)]; } catch(e) {}

            const highlights = matches.slice(0, 30).map(m => {
                const r = m.getBoundingClientRect();
                return { x: Math.round(r.left), y: Math.round(r.top),
                         width: Math.round(r.width), height: Math.round(r.height) };
            }).filter(r => r.width > 0 && r.height > 0);

            return {
                selector,
                match_count: matches.length,
                highlights,
                sample_text: (getTitle(target) || target.innerText?.trim() || '').slice(0, 120),
                tag: target.tagName.toLowerCase(),
            };
        }""",
            [x, y],
        )

        return result or {"error": "Could not inspect element"}

    async def navigate(self, session_id: str, url: str) -> dict:
        """Navigate an existing session to a new URL."""
        session = self._sessions.get(session_id)
        if not session:
            # Create fresh session
            return await self.render(url, session_id)

        session.touch()
        session.url = url
        await session.page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        await session.page.wait_for_timeout(2000)
        return await self.render(url, session_id)

    async def screenshot(self, session_id: str) -> dict:
        """Take a fresh screenshot of the current session state."""
        session = self._sessions.get(session_id)
        if not session:
            return {"error": "Session not found"}
        session.touch()
        page = session.page
        title = await page.title()
        viewport = page.viewport_size or {"width": 1280, "height": 800}
        screenshot_bytes = await page.screenshot(type="jpeg", quality=85, full_page=False)
        return {
            "title": title,
            "screenshot": base64.b64encode(screenshot_bytes).decode(),
            "width": viewport["width"],
            "height": viewport["height"],
            "current_url": page.url,
        }

    async def scroll(self, session_id: str, delta_y: int) -> dict:
        """Scroll the page and return a fresh screenshot."""
        session = self._sessions.get(session_id)
        if not session:
            return {"error": "Session not found"}
        session.touch()
        await session.page.evaluate(f"window.scrollBy(0, {delta_y})")
        await session.page.wait_for_timeout(300)
        return await self.screenshot(session_id)

    async def preview_selector(self, session_id: str, selector: str) -> dict:
        """
        Run querySelectorAll(selector) in the live browser session and return
        up to 20 extracted {title, link, description} items.
        This is the correct way to preview selectors for JS-rendered pages —
        unlike the static HTTP approach, the DOM is already fully rendered.
        """
        session = self._sessions.get(session_id)
        if not session:
            return {"count": 0, "items": [], "error": "Session expired — please reload"}

        session.touch()

        result = await session.page.evaluate(
            """(selector) => {
            // Shared helpers — same logic as click_and_get_selector
            function getLink(el) {
                if (el.tagName === 'A' && el.href) return el.href;
                const child = el.querySelector('a[href]');
                if (child) return child.href;
                let p = el.parentElement;
                while (p && p !== document.body) {
                    if (p.tagName === 'A' && p.href) return p.href;
                    p = p.parentElement;
                }
                return '';
            }

            function getTitle(el) {
                const h = el.querySelector('h1,h2,h3,h4,h5,h6');
                if (h) return h.innerText.trim();
                if (el.tagName === 'A') return (el.getAttribute('title') || el.innerText || '').trim();
                const a = el.querySelector('a[href]');
                if (a) return (a.getAttribute('title') || a.innerText || '').trim();
                const img = el.querySelector('img[alt]');
                if (img && img.alt) return img.alt.trim();
                const label = el.getAttribute('aria-label') || el.getAttribute('title');
                if (label) return label.trim();
                const txt = (el.innerText || '').trim();
                return txt.length < 300 ? txt : txt.slice(0, 200);
            }

            function getDesc(el) {
                const p = el.querySelector('p, [class*="desc"], [class*="intro"], [class*="subtitle"], [class*="summary"]');
                return p ? (p.innerText || '').trim().slice(0, 300) : '';
            }

            try {
                const els = [...document.querySelectorAll(selector)];
                const items = els.slice(0, 20).map(el => ({
                    title: getTitle(el).slice(0, 200),
                    link: getLink(el),
                    description: getDesc(el),
                })).filter(i => i.title || i.link);

                return { count: els.length, items };
            } catch (e) {
                return { count: 0, items: [], error: String(e) };
            }
        }""",
            selector,
        )

        return result or {"count": 0, "items": []}


browser_service = BrowserService()
