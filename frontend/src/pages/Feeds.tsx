import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Loader2 } from 'lucide-react'
import AnimatedPage from '../components/AnimatedPage'
import FeedCard from '../components/FeedCard'
import EmptyState from '../components/EmptyState'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { feedsApi } from '../api/client'
import type { Feed, Subscription } from '../types'

export default function Feeds() {
  const navigate = useNavigate()
  const [subs, setSubs] = useState<Subscription[]>([])
  const [feeds, setFeeds] = useState<Record<string, Feed>>({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newFolder, setNewFolder] = useState('Uncategorized')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadFeeds()
  }, [])

  const loadFeeds = async () => {
    try {
      const { data } = await feedsApi.listSubscriptions()
      setSubs(data)
      // We don't have a list-all-feeds endpoint, so we use the subscription's feed_id
      // and fetch feed details if needed. For now, render with what we have.
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

  return (
    <AnimatedPage>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">订阅源</h1>
          <p className="mt-1 text-sm text-slate-500">
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

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur"
          >
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Feed URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  分类文件夹
                </label>
                <input
                  type="text"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
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
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Grid */}
      {loading ? (
        <LoadingSkeleton count={6} />
      ) : subs.length === 0 ? (
        <EmptyState
          title="还没有订阅"
          description="添加你喜欢的 RSS 源，或者用 AI 解析任意网站生成订阅"
          action={
            <button
              onClick={() => navigate('/analyze')}
              className="rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md"
            >
              去 AI 解析
            </button>
          }
        />
      ) : (
        <motion.div
          layout
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {subs.map((sub, i) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <FeedCard
                feed={{
                  id: sub.feed_id,
                  title: sub.feed_id.slice(0, 8),
                  url: sub.feed_id,
                  feed_type: 'standard',
                  refresh_interval: 3600,
                  created_at: sub.created_at,
                }}
                subscription={sub}
                onClick={() => navigate(`/feeds/${sub.feed_id}`)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatedPage>
  )
}
