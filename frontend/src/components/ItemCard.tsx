import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Check, ExternalLink, Sparkles, ChevronDown } from 'lucide-react'
import type { FeedItem } from '../types'

interface Props {
  item: FeedItem
  onRead?: (id: string) => void
  onStar?: (id: string, starred: boolean) => void
  read?: boolean
  starred?: boolean
}

export default function ItemCard({
  item,
  onRead,
  onStar,
  read = false,
  starred = false,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const published = item.published_at
    ? new Date(item.published_at).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className={`group relative overflow-hidden rounded-xl border bg-white/90 backdrop-blur transition-all dark:bg-slate-800/90 ${
        read
          ? 'border-slate-100 opacity-70 dark:border-slate-800'
          : 'border-slate-200/70 shadow-sm hover:shadow-md dark:border-slate-700/70 dark:hover:shadow-black/20'
      }`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-base font-semibold text-slate-900 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-400"
            >
              <span className="truncate">{item.title}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-600" />
            </a>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
              {item.author && <span>{item.author}</span>}
              {item.author && published && <span>·</span>}
              {published && <span>{published}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => onStar?.(item.id, !starred)}
              className={`rounded-lg p-2 transition-colors ${
                starred
                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-400'
              }`}
            >
              <Bookmark className="h-4 w-4" fill={starred ? 'currentColor' : 'none'} />
            </button>
            {!read && (
              <button
                onClick={() => onRead?.(item.id)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-600 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
                title="标记已读"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* AI TL;DR */}
        {item.ai_tldr && (
          <div className="mt-3 flex gap-2 rounded-lg border border-brand-100 bg-brand-50/50 p-3 dark:border-brand-700/30 dark:bg-brand-900/20">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500 dark:text-brand-400" />
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{item.ai_tldr}</p>
          </div>
        )}

        {/* Expand/collapse for full summary & content */}
        {(item.ai_summary || item.raw_content) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-400"
          >
            {expanded ? '收起' : '展开详情'}
            <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
          </button>
        )}

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                {item.ai_summary && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      AI 摘要
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {item.ai_summary}
                    </p>
                  </div>
                )}
                {item.ai_translation && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      翻译
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {item.ai_translation}
                    </p>
                  </div>
                )}
                {item.raw_content && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      原文
                    </h4>
                    <div
                      className="prose prose-sm prose-slate max-w-none text-slate-600 dark:prose-invert dark:text-slate-400"
                      dangerouslySetInnerHTML={{ __html: item.raw_content.slice(0, 2000) }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  )
}
