import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Loader2, Rss, AlertCircle, Check } from 'lucide-react'
import AnimatedPage from '../components/AnimatedPage'
import FeedCard from '../components/FeedCard'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { feedsApi } from '../api/client'
import type { Feed, Subscription } from '../types'

export default function Feeds() {
  const navigate = useNavigate()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [feedsMap, setFeedsMap] = useState<Record<string, Feed>>({})
  const [allFeeds, setAllFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newFolder, setNewFolder] = useState('Uncategorized')
  const [adding, setAdding] = useState(false)
  const [subscribingId, setSubscribingId] = useState<string | null>(null)

  useEffect(() => {
    loadFeeds()
  }, [])

  const loadFeeds = async () => {
    setError('')
    try {
      const [subsRes, feedsRes] = await Promise.allSettled([
        feedsApi.listSubscriptions(),
        feedsApi.listFeeds(),
      ])

      let subsData: Subscription[] = []
      let feedsData: Feed[] = []

      if (subsRes.status === 'fulfilled') {
        subsData = subsRes.value.data
        setSubs(subsData)
      } else {
        setError('加载订阅列表失败，请刷新重试')
      }

      if (feedsRes.status === 'fulfilled') {
        feedsData = feedsRes.value.data
        const map: Record<string, Feed> = {}
        feedsData.forEach((f) => { map[f.id] = f })
        setFeedsMap(map)
        setAllFeeds(feedsData)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUrl.trim()) return
    setAdding(true)
    try {
      const { data: feed } = await feedsApi.create({
        title: new URL(newUrl.trim()).hostname.replace('www.', ''),
        url: newUrl.trim(),
      })
      await feedsApi.subscribe({ feed_id: feed.id, folder_name: newFolder })
      setNewUrl('')
      setShowAdd(false)
      loadFeeds()
    } catch (err) {
      console.error(err)
    } finally {
      setAdding(false)
    }
  }

  const handleQuickSubscribe = async (feed: Feed) => {
    setSubscribingId(feed.id)
    try {
      await feedsApi.subscribe({ feed_id: feed.id, folder_name: 'Uncategorized' })
      await loadFeeds()
    } catch (err) {
      console.error(err)
    } finally {
      setSubscribingId(null)
    }
  }

  const subscribedFeedIds = new Set(subs.map((s) => s.feed_id))
  const unsubscribedFeeds = allFeeds.filter((f) => !subscribedFeedIds.has(f.id))

  return (
    <AnimatedPage>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">订阅源</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            管理你的 RSS 订阅，AI 会自动抓取并处理内容
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          添加订阅
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/80"
          >
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Feed URL</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-700 dark:focus:ring-brand-900/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">分类文件夹</label>
                <input
                  type="text"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:bg-slate-700 dark:focus:ring-brand-900/30"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {adding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  添加
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  取消
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <LoadingSkeleton count={6} />
      ) : (
        <>
          {/* My subscriptions */}
          {subs.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                我的订阅 · {subs.length}
              </h2>
              <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subs.map((sub, i) => {
                  const feed = feedsMap[sub.feed_id]
                  return (
                    <motion.div
                      key={sub.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <FeedCard
                        feed={feed ?? {
                          id: sub.feed_id,
                          title: '加载中…',
                          url: '',
                          feed_type: 'standard',
                          refresh_interval: 21600,
                          created_at: sub.created_at,
                        }}
                        subscription={sub}
                        onClick={() => navigate(`/feeds/${sub.feed_id}`)}
                        onFeedUpdated={(updated) =>
                          setFeedsMap((prev) => ({ ...prev, [updated.id]: updated }))
                        }
                      />
                    </motion.div>
                  )
                })}
              </motion.div>
            </section>
          )}

          {/* Unsubscribed system feeds */}
          {unsubscribedFeeds.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
                {subs.length === 0 ? '可用订阅源 · 点击一键订阅' : '更多可订阅'}
              </h2>
              <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unsubscribedFeeds.map((feed, i) => (
                  <motion.div
                    key={feed.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4 backdrop-blur transition-all hover:border-brand-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-brand-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-700 group-hover:text-brand-700 dark:text-slate-300 dark:group-hover:text-brand-400">
                          {feed.title}
                        </h3>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-600">{feed.url}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                        feed.feed_type === 'agent_crawled'
                          ? 'bg-purple-50 text-purple-700 ring-purple-600/10 dark:bg-purple-950/40 dark:text-purple-400 dark:ring-purple-500/20'
                          : 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/20'
                      }`}>
                        {feed.feed_type === 'agent_crawled' ? 'AI 抓取' : 'RSS'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleQuickSubscribe(feed)}
                      disabled={subscribingId === feed.id}
                      className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 py-1.5 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50 dark:border-brand-700/30 dark:bg-brand-900/20 dark:text-brand-300 dark:hover:bg-brand-900/40"
                    >
                      {subscribingId === feed.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Rss className="h-3.5 w-3.5" />
                          订阅
                        </>
                      )}
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}

          {/* Truly empty — no feeds at all */}
          {subs.length === 0 && unsubscribedFeeds.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Rss className="h-7 w-7 text-slate-400 dark:text-slate-600" />
              </div>
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">还没有任何订阅源</p>
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-600">添加 RSS 链接或用 AI 解析任意网站</p>
              </div>
              <button
                onClick={() => navigate('/analyze')}
                className="rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md"
              >
                去 AI 解析
              </button>
            </div>
          )}
        </>
      )}
    </AnimatedPage>
  )
}
