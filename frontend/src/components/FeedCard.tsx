import { motion } from 'framer-motion'
import type { Feed, Subscription } from '../types'

interface Props {
  feed: Feed
  subscription?: Subscription
  itemCount?: number
  onClick?: () => void
}

const typeLabels: Record<string, { label: string; className: string }> = {
  standard: {
    label: 'RSS',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  },
  agent_crawled: {
    label: 'AI 抓取',
    className: 'bg-purple-50 text-purple-700 ring-purple-600/10',
  },
}

export default function FeedCard({ feed, subscription, itemCount = 0, onClick }: Props) {
  const typeInfo = typeLabels[feed.feed_type] ?? typeLabels.standard

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 p-5 text-left shadow-sm backdrop-blur transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-brand-700">
            {feed.title}
          </h3>
          <p className="mt-1 truncate text-xs text-slate-500">{feed.url}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${typeInfo.className}`}
        >
          {typeInfo.label}
        </span>
      </div>

      {subscription?.folder_name && (
        <div className="text-xs text-slate-500">
          📁 {subscription.folder_name}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>
          {feed.last_fetched_at
            ? `更新于 ${new Date(feed.last_fetched_at).toLocaleString('zh-CN')}`
            : '尚未抓取'}
        </span>
        <span className="font-semibold text-brand-600">
          {itemCount > 0 ? `${itemCount} 篇` : '—'}
        </span>
      </div>

      {/* Subtle gradient highlight on hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.button>
  )
}
