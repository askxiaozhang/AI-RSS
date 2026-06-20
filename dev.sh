#!/usr/bin/env bash
set -euo pipefail

# ── 颜色 ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[ai-rss]${RESET} $*"; }
success() { echo -e "${GREEN}[ai-rss]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[ai-rss]${RESET} $*"; }
error()   { echo -e "${RED}[ai-rss]${RESET} $*" >&2; }

# ── 项目根目录（脚本所在目录）────────────────────────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/.logs"
mkdir -p "$LOG_DIR"

# ── PID 追踪，Ctrl-C 时统一清理 ──────────────────────────────────────────
PIDS=()

cleanup() {
  echo ""
  warn "正在停止所有服务…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  success "全部服务已退出"
  exit 0
}
trap cleanup INT TERM

# ── 1. Docker 基础设施（postgres + redis）────────────────────────────────
info "启动 Docker 服务 (postgres / redis)…"
docker compose -f "$ROOT/docker-compose.yml" up -d postgres redis \
  || { error "docker compose 失败，请确认 Docker Desktop 已运行"; exit 1; }

# ── 等待 postgres ─────────────────────────────────────────────────────────
info "等待 PostgreSQL 就绪…"
for i in $(seq 1 30); do
  if docker exec ai_rss_postgres pg_isready -U postgres -d ai_rss -q 2>/dev/null; then
    success "PostgreSQL 就绪 ✓"
    break
  fi
  [ "$i" -eq 30 ] && { error "PostgreSQL 30s 内未就绪，退出"; exit 1; }
  sleep 1
done

# ── 等待 redis ────────────────────────────────────────────────────────────
info "等待 Redis 就绪…"
for i in $(seq 1 15); do
  if docker exec ai_rss_redis redis-cli ping 2>/dev/null | grep -q PONG; then
    success "Redis 就绪 ✓"
    break
  fi
  [ "$i" -eq 15 ] && { error "Redis 15s 内未就绪，退出"; exit 1; }
  sleep 1
done

# ── 2. FastAPI 后端 ──────────────────────────────────────────────────────
info "启动 FastAPI 后端 (port 8000)…"
(
  cd "$ROOT"
  uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
) >> "$LOG_DIR/backend.log" 2>&1 &
PIDS+=($!)
sleep 1
success "FastAPI 已启动 → http://localhost:8000  (日志: .logs/backend.log)"

# ── 3. arq 后台 Worker ───────────────────────────────────────────────────
info "启动 arq Worker…"
(
  cd "$ROOT"
  uv run arq src.tasks.worker.WorkerSettings
) >> "$LOG_DIR/worker.log" 2>&1 &
PIDS+=($!)
success "arq Worker 已启动               (日志: .logs/worker.log)"

# ── 4. Vite 前端开发服务器 ───────────────────────────────────────────────
info "启动 Vite 前端 (port 5173)…"
(
  cd "$ROOT/frontend"
  npm run dev
) >> "$LOG_DIR/frontend.log" 2>&1 &
PIDS+=($!)
sleep 2
success "前端已启动 → http://localhost:5173  (日志: .logs/frontend.log)"

# ── 汇总 ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo -e "${BOLD}  AI-RSS 全栈环境已就绪 🚀${RESET}"
echo -e "${BOLD}════════════════════════════════════════${RESET}"
echo -e "  前端        ${GREEN}http://localhost:5173${RESET}"
echo -e "  后端 API    ${GREEN}http://localhost:8000/api${RESET}"
echo -e "  API 文档    ${GREEN}http://localhost:8000/docs${RESET}"
echo -e "  日志目录    ${CYAN}.logs/${RESET}"
echo -e "${BOLD}────────────────────────────────────────${RESET}"
echo -e "  按 ${BOLD}Ctrl-C${RESET} 停止所有服务"
echo ""

# ── 实时显示后端日志（方便即时发现错误）────────────────────────────────
tail -f "$LOG_DIR/backend.log" "$LOG_DIR/worker.log" "$LOG_DIR/frontend.log" &
PIDS+=($!)

# 等待所有子进程
wait
