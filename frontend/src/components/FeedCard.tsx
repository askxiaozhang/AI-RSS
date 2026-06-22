import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, Clock, Save, Sparkles } from 'lucide-react'
import type { Feed, Subscription } from '../types'
import { feedsApi } from '../api/client'

interface Props {
  feed: Feed
  subscription?: Subscription
  itemCount?: number
  onClick?: () => void
  onFeedUpdated?: (updated: Feed) => void
}

const typeLabels: Record<string, { label: string; className: string }> = {
  standard: {
    label: 'RSS',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/20',
  },
  agent_crawled: {
    label: 'AI 抓取',
    className: 'bg-purple-50 text-purple-700 ring-purple-600/10 dark:bg-purple-950/40 dark:text-purple-400 dark:ring-purple-500/20',
  },
}

const INTERVAL_OPTIONS = [
  { value: 3600,   label: '1 小时' },
  { value: 10800,  label: '3 小时' },
  { value: 21600,  label: '6 小时' },
  { value: 43200,  label: '12 小时' },
  { value: 86400,  label: '24 小时' },
  { value: 259200, label: '3 天' },
  { value: 604800, label: '1 周' },
]

function intervalLabel(seconds: number): string {
  return INTERVAL_OPTIONS.find((o) => o.value === seconds)?.label ?? `${seconds / 3600}h`
}

export default function FeedCard({ feed, subscription, itemCount = 0, onClick, onFeedUpdated }: Props) {
  const typeInfo = typeLabels[feed.feed_type] ?? typeLabels.standard
  const [refreshInterval, setRefreshInterval] = useState(feed.refresh_interval)
  const [saving, setSaving] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  // Per-feed AI prompt
  const promptKey = `ai_prompt_feed_${feed.id}`
  const [showPrompt, setShowPrompt] = useState(false)
  const [feedPrompt, setFeedPrompt] = useState(() => localStorage.getItem(promptKey) || '')
  const [promptSaved, setPromptSaved] = useState(false)

  const savePrompt = () => {
    localStorage.setItem(promptKey, feedPrompt)
    setPromptSaved(true)
    setTimeout(() => setPromptSaved(false), 2000)
  }

  const hasCustomPrompt = !!localStorage.getItem(promptKey)

  const handleIntervalChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    const next = Number(e.target.value)
    setSaving(true)
    try {
      const { data } = await feedsApi.updateFeed(feed.id, { refresh_interval: next })
      setRefreshInterval(data.refresh_interval)
      onFeedUpdated?.(data)
    } catch {
      if (selectRef.current) selectRef.current.value = String(refreshInterval)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-5 text-left shadow-sm backdrop-blur transition-shadow hover:shadow-md dark:border-slate-700/70 dark:bg-slate-800/80 dark:hover:shadow-black/20 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-400">
            {feed.title}
          </h3>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-500">{feed.url}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${typeInfo.className}`}
        >
          {typeInfo.label}
        </span>
      </div>

      {subscription?.folder_name && (
        <div className="text-xs text-slate-500 dark:text-slate-500">
          📁 {subscription.folder_name}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-700/60 dark:text-slate-500">
        <span>
          {feed.last_fetched_at
            ? `更新于 ${new Date(feed.last_fetched_at).toLocaleString('zh-CN')}`
            : '尚未抓取'}
        </span>
        <span className="font-semibold text-brand-600 dark:text-brand-400">
          {itemCount > 0 ? `${itemCount} 篇` : '—'}
        </span>
      </div>

      {/* Refresh interval selector */}
      <div
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-700/40"
        onClick={(e) => e.stopPropagation()}
      >
        <Clock className={`h-3.5 w-3.5 shrink-0 ${saving ? 'animate-pulse text-brand-500' : 'text-slate-400 dark:text-slate-500'}`} />
        <span className="text-[11px] text-slate-500 dark:text-slate-400">抓取间隔</span>
        <select
          ref={selectRef}
          value={refreshInterval}
          onChange={handleIntervalChange}
          disabled={saving}
          className="ml-auto cursor-pointer rounded border-0 bg-transparent text-[11px] font-semibold text-slate-700 outline-none focus:ring-0 disabled:opacity-50 dark:text-slate-300"
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Per-feed AI prompt */}
      <div onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setShowPrompt((v) => !v)}
          className="flex w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-400 dark:hover:bg-slate-700"
        >
          <Sparkles className="h-3.5 w-3.5 text-purple-400 dark:text-purple-400" />
          <span>AI 提示词</span>
          {hasCustomPrompt && (
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          )}
          <motion.span
            animate={{ rotate: showPrompt ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="ml-auto"
          >
            <ChevronDown className="h-3 w-3" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {showPrompt && (
            <motion.div
              key="feed-prompt"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-1.5">
                <textarea
                  value={feedPrompt}
                  onChange={(e) => setFeedPrompt(e.target.value)}
                  placeholder="留空则使用全局提示词..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:placeholder-slate-500 dark:focus:border-purple-600 dark:focus:ring-purple-900/20"
                />
                <button
                  onClick={savePrompt}
                  className="flex w-full items-center justify-center gap-1 rounded-md bg-purple-50 py-1 text-[10px] font-semibold text-purple-700 transition-colors hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40"
                >
                  {promptSaved ? <Check className="h-2.5 w-2.5" /> : <Save className="h-2.5 w-2.5" />}
                  {promptSaved ? '已保存' : '保存提示词'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Subtle gradient highlight on hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.div>
  )
}
