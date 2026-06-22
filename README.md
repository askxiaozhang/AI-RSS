<div align="center">

<img src="docs/screenshots/dashboard.png" alt="AI-RSS Dashboard" width="800" />

# AI-RSS

**把任意网站变成 AI 驱动的 RSS 订阅源**

将 AI 能力融入传统 RSS 阅读，无论是手动添加 Feed 链接、还是用可视化交互选取任意网页元素生成自定义订阅，都能获得 AI 自动摘要、重要性评分、关键词标签、语义过滤和多语言翻译。

[![Python](https://img.shields.io/badge/Python-3.12+-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Playwright](https://img.shields.io/badge/Playwright-1.60-orange?logo=playwright)](https://playwright.dev)

</div>

---

## ✨ 功能亮点

| 功能 | 说明 |
|------|------|
| **标准 RSS 订阅** | 支持 RSS / Atom / JSON Feed，自动抓取并同步 |
| **可视化 AI 抓取** | 打开任意网页，**浏览/选择**两种模式切换，点击文章卡片即可生成自定义 Feed |
| **真实浏览器渲染** | 集成 Playwright Chromium，支持 B站、抖音等 JS 渲染 SPA，自动检测并切换 |
| **AI 摘要 & TL;DR** | 每篇文章自动生成一句话总结、三条要点、150 字概览 |
| **重要性评分** | AI 对每篇文章打 1–10 分，颜色区分（极高/重要/一般/较低）|
| **关键词标签** | AI 自动提取领域、类型、主体实体等 3–5 个标签 |
| **语义智能过滤** | 用自然语言描述过滤规则，AI 帮你筛掉不感兴趣的内容 |
| **自定义抓取间隔** | 每个订阅源可独立设置刷新频率（1 小时～1 周），Worker 定时调度 |
| **阅读状态追踪** | 已读 / 未读 / 收藏，多维度筛选与搜索，支持全部标为已读 |
| **对话助手** | 基于 RAG 与订阅内容对话问答 |
| **可折叠侧边栏** | 一键折叠左侧导航栏至图标模式，释放阅读空间，状态自动记忆 |
| **全局 AI 提示词** | 在侧边栏统一设置 AI 总结风格（如"请用中文总结并提炼关键数据"），适用于全部信息源 |
| **单源 AI 提示词** | 每个订阅源可单独配置提示词，优先级高于全局设置，实现精细化定制 |

---

## 📸 界面预览

### 智能阅读器
> 每篇文章显示 AI TL;DR 摘要、**重要性评分徽章**（1–10 分色标）、**关键词标签**  
> 左侧栏：全部 / 未读 / 收藏视图 + 时间范围筛选 + 订阅源过滤（含未读计数）

<img src="docs/screenshots/reader.png" alt="Reader View" width="800" />

---

### 可视化 AI 抓取 — 真实浏览器模式（支持 JS SPA）
> 输入 B站、抖音等单页应用链接后自动切换为 Playwright 渲染模式  
> 截图显示完整渲染后的页面，切换到「选择」模式后点击任意元素即可识别同类区块  
> SVG 高亮框坐标与点击位置精准对齐

<img src="docs/screenshots/analyze_browser_mode.png" alt="Browser Mode - Bilibili" width="800" />

---

### 可视化 AI 抓取 — 静态预览模式（普通网站）
> 常规 SSR/静态网站走静态 fetch 模式，速度更快  
> 浏览模式可正常点击链接跳转，选择模式点击高亮选取  
> 两种模式一键切换，自动检测

<img src="docs/screenshots/analyze.png" alt="AI URL Analyzer" width="800" />

---

### 订阅源管理
> 卡片式展示所有订阅，显示类型标签（RSS / AI 抓取）、文件夹分类、最后抓取时间  
> 每张卡片可**直接修改抓取间隔**，未订阅的系统源一键订阅

<img src="docs/screenshots/feeds.png" alt="Feeds Management" width="800" />

---

## 🏗 技术架构

```
┌─────────────────────────────────────────────────┐
│              React 18 + TypeScript               │
│         Vite · Tailwind · Framer Motion          │
└────────────────────┬────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────┐
│           FastAPI (Python 3.12+)                 │
│   Auth · Feeds · Items · Agents · Chat           │
└──────┬─────────────┬──────────────┬─────────────┘
       │             │              │
┌──────▼──┐   ┌──────▼──┐   ┌──────▼──────────────┐
│PostgreSQL│   │  Redis  │   │    AI Providers      │
│ SQLModel │   │  arq    │   │ Anthropic / OpenAI   │
│ pgvector │   │ worker  │   │ Gemini / Dashscope   │
└──────────┘   └─────────┘   └─────────────────────┘
                                       ↑
                              ┌────────┴────────┐
                              │   Playwright     │
                              │ Chromium (SPA)   │
                              └─────────────────┘
```

**后端**
- [FastAPI](https://fastapi.tiangolo.com) — 异步 REST API
- [SQLModel](https://sqlmodel.tiangolo.com) — ORM（基于 SQLAlchemy + Pydantic）
- [arq](https://arq-docs.helpmanual.io) — Redis 异步任务队列，定时抓取 Feed
- [Playwright](https://playwright.dev/python/) — 真实 Chromium 渲染，支持 JS SPA
- [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/) — HTML 解析与元素选取
- [feedparser](https://feedparser.readthedocs.io) — RSS/Atom 解析

**前端**
- [React 18](https://react.dev) + [TypeScript](https://typescriptlang.org)
- [Vite](https://vitejs.dev) — 构建工具
- [Tailwind CSS](https://tailwindcss.com) — 样式
- [Framer Motion](https://www.framer.com/motion/) — 动画
- [Zustand](https://zustand-demo.pmnd.rs) — 状态管理

**AI**
- 统一 LLM 调用层，按优先级依次尝试：Gemini → Anthropic → OpenAI
- 支持 Anthropic-compatible 第三方接口（如阿里云灵积 Dashscope）
- Semaphore 限流防 429，ThinkingBlock 兼容处理

---

## 🚀 快速开始

### 前置依赖

- [Docker](https://www.docker.com/) — 运行 PostgreSQL 和 Redis
- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) — Python 包管理

### 1. 克隆并安装依赖

```bash
git clone <repo-url> && cd ai-rss

# Python 依赖（含 Playwright）
uv sync
uv run playwright install chromium

# 前端依赖
cd frontend && npm install && cd ..
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，至少配置一个 AI 服务的 API Key：

```env
# 数据库 & Redis
DATABASE_URL=postgresql+asyncpg://postgres:postgrespassword@localhost:5432/ai_rss
REDIS_URL=redis://localhost:6379

# AI Provider — 至少配置一个
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# 使用 Anthropic-compatible 第三方接口（可选）
ANTHROPIC_BASE_URL=https://your-proxy-url/anthropic
ANTHROPIC_MODEL=your-model-name
```

### 3. 一键启动

```bash
chmod +x dev.sh && ./dev.sh
```

这会自动启动：
- PostgreSQL + Redis（Docker）
- FastAPI 后端 → http://localhost:8000
- arq 后台 Worker（定时抓取）
- Vite 前端 → http://localhost:5173

### 4. 初始化种子数据（可选）

```bash
uv run python scripts/seed_feeds.py
```

导入预配置的 AI/科技类 RSS 源（OpenAI、Anthropic、Google AI、TechCrunch AI 等）。

---

## 📁 项目结构

```
ai-rss/
├── dev.sh                    # 一键启动脚本
├── docker-compose.yml        # PostgreSQL + Redis
├── pyproject.toml            # Python 依赖
│
├── src/
│   ├── main.py               # FastAPI 应用入口
│   ├── config.py             # 配置（从 .env 加载）
│   ├── api/endpoints/        # REST 端点
│   │   ├── auth.py           # 注册 / 登录 / JWT
│   │   ├── feeds.py          # 订阅源 CRUD + 自定义抓取间隔
│   │   ├── items.py          # 文章列表 / 已读 / 收藏 / AI 摘要
│   │   ├── agents.py         # AI 抓取 / 浏览器渲染 / 选择器预览
│   │   └── chat.py           # RAG 对话
│   ├── models/               # SQLModel 数据模型
│   ├── services/
│   │   ├── ai_processor.py   # LLM 调用（摘要 / 评分 / 关键词 / 过滤 / 翻译）
│   │   ├── browser_service.py # Playwright session 池（真实浏览器渲染）
│   │   ├── ai_agent.py       # AI 网页爬取 Agent
│   │   ├── feed_parser.py    # RSS/Atom 解析
│   │   └── scraper.py        # HTML 抓取 & CSS 选择器解析
│   └── tasks/
│       └── worker.py         # arq 后台任务（定时抓取 / AI 富化）
│
├── frontend/
│   └── src/
│       ├── pages/            # 页面（Dashboard / Feeds / Reader / UrlAnalyzer…）
│       ├── components/       # 共用组件（ReaderCard 含评分 & 关键词）
│       ├── api/client.ts     # Axios API 客户端
│       ├── store/            # Zustand 状态
│       └── types/index.ts    # TypeScript 类型定义
│
└── scripts/
    ├── seed_feeds.py         # 导入预置订阅源
    └── sync_feeds.py         # 手动触发同步
```

---

## 🔌 API 文档

启动后访问 http://localhost:8000/docs 查看自动生成的 Swagger UI。

主要端点：

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/token` | 登录（返回 JWT） |
| `GET` | `/api/feeds/` | 获取所有订阅源 |
| `POST` | `/api/feeds/` | 添加订阅源（标准 RSS 或 AI 抓取型） |
| `PATCH` | `/api/feeds/{id}` | 更新抓取间隔等设置 |
| `GET` | `/api/items/` | 获取订阅文章（含已读 / 收藏 / 评分 / 关键词） |
| `POST` | `/api/items/{id}/summarize` | AI 生成摘要 + 评分 + 关键词（可传 `custom_prompt` 覆盖提示词） |
| `POST` | `/api/agents/fetch-preview` | 静态 HTML 预览（普通网站） |
| `POST` | `/api/agents/browser/render` | Playwright 真实渲染 + 截图 |
| `POST` | `/api/agents/browser/click` | 坐标 → DOM 元素 → CSS 选择器 + 高亮矩形 |
| `POST` | `/api/agents/browser/preview-selector` | 在 live DOM 中预览选择器提取结果 |

---

## 📋 更新记录

### 2026-06-22

**团队协作与权限管理**

- **团队与角色权限**：新增团队功能，支持三种角色——管理员（全部权限）、普通成员、游客（只读）。管理员可改名、增删成员、调整角色、管理共享源、生成邀请链接、解散团队；普通成员可分享订阅源；游客仅可查看。

- **共享订阅源**：团队成员可将自己已订阅的信息源分享至团队内，团队成员共享查看；管理员可移除任意共享源，普通成员可移除自己分享的。

- **邀请链接加入**：管理员可生成可分享的邀请链接（支持指定加入后角色、可选过期时间与最大使用次数），他人通过链接即可加入团队；未登录时自动跳转登录并在登录后回到邀请页。

- **暗色主题**：全站新增暗色模式，配套 `themeStore` 主题切换，所有页面与组件适配深色配色。

- **邀请链接地址可配置**：新增 `VITE_PUBLIC_BASE_URL` 环境变量用于生成对外分享的邀请链接（默认回退当前访问地址），并将 Vite 开发服务器暴露到局域网（`server.host`），方便其他设备打开邀请链接。

- **后端 API**：新增 `/api/teams` 系列接口——团队 CRUD、成员与角色管理、共享源管理、邀请链接生成/预览/接受/吊销、退出团队，均带基于角色的权限校验。

---

### 2026-06-21

**侧边栏折叠 + AI 提示词定制**

- **可折叠侧边栏**：左侧导航栏新增折叠/展开切换按钮，折叠后仅显示图标（带 tooltip），通过 Framer Motion spring 动画过渡；折叠状态持久化到 `localStorage`，刷新页面保持上次选择。

- **全局 AI 总结提示词**：侧边栏底部新增「AI 总结提示词」可展开面板，输入全局默认提示词（如"请用中文总结，重点提炼核心观点"），存入 `localStorage` 并在所有信息源的 AI 摘要请求中生效。

- **单个信息源 AI 提示词**：订阅源管理页每张卡片新增「AI 提示词」折叠区域，可为单个信息源单独配置提示词（优先级高于全局设置），已设置时显示紫色标识点。

- **后端 API 扩展**：`POST /api/items/{id}/summarize` 新增可选 `custom_prompt` 字段，传入后追加到 LLM 提示词末尾，支持任意信息源级别的总结风格定制。

---

### 2026-06-19

**Playwright 浏览器模式 + 高亮框修正**

- 真实浏览器渲染模式（Playwright Chromium）支持 B站、抖音等 JS 渲染 SPA
- 修复浏览器截图高亮框坐标与点击位置偏移问题

---

### 2026-06-18

**AI 重要性评分 & 关键词标签**

- 每篇文章 AI 自动打 1–10 分，颜色区分四档（极高 / 重要 / 一般 / 较低）
- AI 自动提取 3–5 个关键词标签（领域、类型、主体实体）

---

## 📄 License

MIT
