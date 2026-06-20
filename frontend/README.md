# AI-RSS Frontend

简洁优雅的前端界面，基于 React + TypeScript + TailwindCSS + Framer Motion 构建。

## 技术栈

- **React 18** + **TypeScript** — 现代化组件开发
- **Vite** — 极速构建工具
- **TailwindCSS 3** — 原子化 CSS，响应式设计
- **Framer Motion** — 流畅的页面过渡与交互动画
- **Zustand** — 轻量级状态管理
- **React Router 6** — 声明式路由
- **Axios** — HTTP 请求
- **Lucide Icons** — 精美的图标库
- **date-fns** — 日期处理

## 页面结构

| 页面 | 路由 | 说明 |
|------|------|------|
| 登录 | `/login` | 邮箱密码登录 |
| 注册 | `/register` | 新用户注册 |
| 仪表盘 | `/` | 总览：统计、快捷入口 |
| AI 解析 | `/analyze` | 输入网址，AI 自动提取为 RSS |
| 订阅源 | `/feeds` | 管理订阅，添加新源 |
| 订阅详情 | `/feeds/:id` | 查看文章列表，AI 摘要、已读/收藏 |
| 智能过滤 | `/filter` | 自然语言过滤规则（占位，后续实现） |
| 对话助手 | `/chat` | RAG 问答，基于订阅内容 |

## 快速开始

```bash
cd frontend
npm install
npm run dev      # 启动开发服务器 (http://localhost:5173)
npm run build    # 构建生产版本
npm run preview  # 预览构建产物
```

## 前后端分离

开发模式下，Vite 自动将 `/api/*` 请求代理到 `http://localhost:8000`（FastAPI 后端）。
生产部署时，请将构建产物交由 Nginx 或类似服务器托管，并配置反向代理。

## 设计特点

- **简洁优雅**：克制的色彩体系、清晰的层次、充足的留白
- **玻璃拟态**：半透明磨砂背景，微妙的渐变光晕
- **流畅动画**：页面切换、列表增删、交互反馈均有精心设计的过渡
- **响应式**：桌面端侧边栏 + 移动端抽屉式导航
- **中文优先**：所有文案使用简体中文

## 与后端 API 对接

前端调用以下后端端点（见 `src/api/client.ts`）：

| 模块 | 端点 |
|------|------|
| Auth | `POST /api/auth/register`, `POST /api/auth/token` |
| Feeds | `POST /api/feeds/`, `POST /api/feeds/subscribe`, `GET /api/feeds/subscriptions`, `PUT /api/feeds/subscriptions/:id` |
| Items | `GET /api/items/unread`, `POST /api/items/:id/read`, `POST /api/items/:id/star` |
| Agents | `POST /api/agents/test-crawl` |
| Chat | `GET /api/chat/conversations`, `POST /api/chat/conversations`, `POST /api/chat/conversations/:id/messages` |

JWT token 存储在 localStorage，通过 Axios interceptor 自动附加到请求头。
