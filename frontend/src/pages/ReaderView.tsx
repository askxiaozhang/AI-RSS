import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, X, Rss, Inbox, Bookmark,
  BookOpen, AlertCircle, Loader2,
} from 'lucide-react'
import ReaderCard from '../components/ReaderCard'
import { itemsApi, feedsApi } from '../api/client'
import type { FeedItem, Feed } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TimeFilter = 'all' | '1d' | '3d' | '1w' | '1m'
type StatusFilter = 'all' | 'unread' | 'starred'

const TIME_OPTIONS: { value: TimeFilter; label: string; hours: number | null }[] = [
  { value: 'all', label: '全部',  hours: null },
  { value: '1d',  label: '今天',  hours: 24 },
  { value: '3d',  label: '3 天',  hours: 72 },
  { value: '1w',  label: '一周',  hours: 168 },
  { value: '1m',  label: '一月',  hours: 720 },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ReaderView() {
  const [allItems, setAllItems] = useState<FeedItem[]>([])
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('unread')
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Local state overlay (tracks changes made in this session)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())   // forced unread
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())
  const [unstarredIds, setUnstarredIds] = useState<Set<string>>(new Set())

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [itemsRes, feedsRes] = await Promise.allSettled([
        itemsApi.listAll(),
        feedsApi.listFeeds(),
      ])
      if (itemsRes.status === 'fulfilled') setAllItems(itemsRes.value.data)
      else setError('加载文章失败，请刷新重试')
      if (feedsRes.status === 'fulfilled') setFeeds(feedsRes.value.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ---------------------------------------------------------------------------
  // Derived read/starred status (local overrides win)
  // ---------------------------------------------------------------------------
  const isRead = useCallback((item: FeedItem) => {
    if (readIds.has(item.id)) return true
    if (unreadIds.has(item.id)) return false
    return item.read_status ?? false
  }, [readIds, unreadIds])

  const isStarred = useCallback((item: FeedItem) => {
    if (starredIds.has(item.id)) return true
    if (unstarredIds.has(item.id)) return false
    return item.starred_status ?? false
  }, [starredIds, unstarredIds])

  // ---------------------------------------------------------------------------
  // Filtered items
  // ---------------------------------------------------------------------------
  const filteredItems = useMemo(() => {
    const now = Date.now()
    const timeOpt = TIME_OPTIONS.find((o) => o.value === timeFilter)!

    return allItems.filter((item) => {
      // Feed filter
      if (selectedFeedId && item.feed_id !== selectedFeedId) return false

      // Time filter
      if (timeOpt.hours !== null && item.published_at) {
        const diff = (now - new Date(item.published_at).getTime()) / 3_600_000
        if (diff > timeOpt.hours) return false
      }

      // Status filter
      if (statusFilter === 'unread' && isRead(item)) return false
      if (statusFilter === 'starred' && !isStarred(item)) return false

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !item.title.toLowerCase().includes(q) &&
          !(item.ai_tldr?.toLowerCase().includes(q)) &&
          !(item.ai_summary?.toLowerCase().includes(q))
        ) return false
      }

      return true
    })
  }, [allItems, selectedFeedId, timeFilter, statusFilter, searchQuery, isRead, isStarred])

  // Per-feed unread counts (for sidebar)
  const feedUnreadCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    allItems.forEach((item) => {
      if (!isRead(item)) {
        counts[item.feed_id] = (counts[item.feed_id] ?? 0) + 1
      }
    })
    return counts
  }, [allItems, isRead])

  const totalUnread = useMemo(
    () => allItems.filter((i) => !isRead(i)).length,
    [allItems, isRead],
  )

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const handleRead = async (id: string, forceRead?: boolean) => {
    const item = allItems.find((i) => i.id === id)
    if (!item) return
    const nowRead = forceRead !== undefined ? forceRead : !isRead(item)

    // Optimistic update
    if (nowRead) {
      setReadIds((p) => new Set([...p, id]))
      setUnreadIds((p) => { const n = new Set(p); n.delete(id); return n })
    } else {
      setUnreadIds((p) => new Set([...p, id]))
      setReadIds((p) => { const n = new Set(p); n.delete(id); return n })
    }
    await itemsApi.markRead(id, nowRead)
  }

  const handleStar = async (id: string, starred: boolean) => {
    if (starred) {
      setStarredIds((p) => new Set([...p, id]))
      setUnstarredIds((p) => { const n = new Set(p); n.delete(id); return n })
    } else {
      setUnstarredIds((p) => new Set([...p, id]))
      setStarredIds((p) => { const n = new Set(p); n.delete(id); return n })
    }
    await itemsApi.markStarred(id, starred)
  }

  // Mark all visible as read
  const handleMarkAllRead = async () => {
    const ids = filteredItems.filter((i) => !isRead(i)).map((i) => i.id)
    setReadIds((p) => new Set([...p, ...ids]))
    await Promise.all(ids.map((id) => itemsApi.markRead(id, true)))
  }

  // Feeds that have items
  const feedsWithItems = useMemo(
    () => feeds.filter((f) => allItems.some((i) => i.feed_id === f.id)),
    [feeds, allItems],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50/30">
      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-slate-200/70 bg-white px-3 py-4">
        {/* Status tabs */}
        <div className="mb-5 space-y-0.5">
          {[
            { value: 'all',    label: '全部文章',  icon: BookOpen,  count: allItems.length },
            { value: 'unread', label: '未读',      icon: Inbox,     count: totalUnread },
            { value: 'starred',label: '已收藏',    icon: Bookmark,  count: allItems.filter(isStarred).length },
          ].map(({ value, label, icon: Icon, count }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value as StatusFilter)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="flex-1 text-left">{label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                statusFilter === value ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Time filter */}
        <div className="mb-5">
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            时间范围
          </p>
          <div className="space-y-0.5">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeFilter(opt.value)}
                className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  timeFilter === opt.value
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feed list */}
        <div>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            订阅源
          </p>
          <div className="space-y-0.5">
            <button
              onClick={() => setSelectedFeedId(null)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                !selectedFeedId ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">全部来源</span>
            </button>
            {feedsWithItems.map((feed) => {
              const unread = feedUnreadCounts[feed.id] ?? 0
              return (
                <button
                  key={feed.id}
                  onClick={() => setSelectedFeedId(selectedFeedId === feed.id ? null : feed.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    selectedFeedId === feed.id
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <Rss className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate text-left">{feed.title}</span>
                  {unread > 0 && (
                    <span className="rounded-full bg-brand-100 px-1.5 text-[10px] font-semibold text-brand-700">
                      {unread}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white px-5 py-2.5">
          <span className="text-sm font-medium text-slate-500">
            {filteredItems.length > 0
              ? `${filteredItems.length} 篇`
              : '0 篇'}
          </span>

          {/* Mark all read */}
          {statusFilter === 'unread' && filteredItems.length > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              全部标为已读
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文章…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Article list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">加载中…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-20 text-slate-500">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm">{error}</p>
              <button onClick={load} className="text-sm text-brand-600 hover:underline">重试</button>
            </div>
          ) : allItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
              <Inbox className="h-10 w-10" />
              <div className="text-center">
                <p className="font-medium text-slate-600">还没有文章</p>
                <p className="mt-1 text-sm">先在「订阅源」页面添加并订阅 RSS 源</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
              <Filter className="h-8 w-8" />
              <div className="text-center">
                <p className="font-medium text-slate-600">没有符合条件的文章</p>
                <p className="mt-1 text-sm">
                  {statusFilter === 'unread' ? '所有文章都已读完 🎉' : '尝试调整筛选条件'}
                </p>
              </div>
              {statusFilter === 'unread' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="mt-1 rounded-lg bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                >
                  查看全部文章
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="divide-y divide-slate-100">
                {filteredItems.map((item, i) => {
                  const feed = feeds.find((f) => f.id === item.feed_id)
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    >
                      <ReaderCard
                        item={item}
                        feedTitle={feed?.title}
                        read={isRead(item)}
                        starred={isStarred(item)}
                        onRead={(id) => handleRead(id)}
                        onStar={handleStar}
                      />
                    </motion.div>
                  )
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
