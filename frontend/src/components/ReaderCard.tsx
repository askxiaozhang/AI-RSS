import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bookmark,
  Check,
  ExternalLink,
  Sparkles,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  ListChecks,
  Tag,
} from 'lucide-react'
import type { FeedItem, SummarizeResult } from '../types'
import { itemsApi } from '../api/client'

interface Props {
  item: FeedItem
  onRead?: (id: string) => void
  onStar?: (id: string, starred: boolean) => void
  read?: boolean
  starred?: boolean
  feedTitle?: string
}

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------
function parseScore(item: FeedItem, result: SummarizeResult | null): number | null {
  if (result?.importance_score != null) return result.importance_score
  if (item.importance_score != null) return item.importance_score
  return null
}

function parseKeywords(item: FeedItem, result: SummarizeResult | null): string[] {
  if (result?.keywords?.length) return result.keywords
  if (item.keywords) {
    try { return JSON.parse(item.keywords) } catch { return [] }
  }
  return []
}

/** Score badge: color + label based on 1–10 value */
function ScoreBadge({ score }: { score: number }) {
  const s = Math.round(score * 10) / 10
  const { bg, text, ring, label } =
    score >= 8.5
      ? { bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-600/20',    label: '极高' }
      : score >= 6.5
      ? { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-600/20', label: '重要' }
      : score >= 4.5
      ? { bg: 'bg-blue-50',   text: 'text-blue-700',   ring: 'ring-blue-600/20',   label: '一般' }
      : { bg: 'bg-slate-100', text: 'text-slate-500',  ring: 'ring-slate-400/20',  label: '较低' }

  return (
    <span
      title={`重要性评分：${s} / 10`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${bg} ${text} ${ring}`}
    >
      <span className="font-mono">{s}</span>
      <span className="opacity-70">{label}</span>
    </span>
  )
}

/** Keyword chip */
function KeywordChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function ReaderCard({
  item,
  onRead,
  onStar,
  read = false,
  starred = false,
  feedTitle,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryResult, setSummaryResult] = useState<SummarizeResult | null>(null)
  const [summaryError, setSummaryError] = useState(false)

  const published = item.published_at
    ? new Date(item.published_at).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  const tldr      = summaryResult?.tldr      ?? item.ai_tldr
  const aiSummary = summaryResult?.summary   ?? item.ai_summary
  const highlights = summaryResult?.highlights ?? []
  const score     = parseScore(item, summaryResult)
  const keywords  = parseKeywords(item, summaryResult)
  const hasExpandable = aiSummary || item.raw_content || highlights.length > 0

  const handleSummarize = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSummarizing(true)
    setSummaryError(false)
    try {
      const customPrompt =
        localStorage.getItem(`ai_prompt_feed_${item.feed_id}`) ||
        localStorage.getItem('ai_prompt_global') ||
        undefined
      const { data } = await itemsApi.summarize(item.id, customPrompt)
      setSummaryResult(data)
      setExpanded(true)
    } catch {
      setSummaryError(true)
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={`group rounded-lg border-b border-slate-100 bg-white transition-all ${
        read ? 'opacity-60' : ''
      } ${expanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}`}
    >
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start gap-3">
          {/* Read checkbox */}
          <button
            onClick={() => onRead?.(item.id)}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
              read
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 hover:border-brand-500'
            }`}
            title={read ? '标记未读' : '标记已读'}
          >
            {read && <Check className="h-3.5 w-3.5" />}
          </button>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-w-0 items-center gap-1.5 text-[15px] font-semibold hover:text-brand-700 ${
                  read ? 'text-slate-500' : 'text-slate-900'
                }`}
              >
                <span className="truncate">{item.title}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </a>
              <div className="flex shrink-0 items-center gap-1.5">
                {/* Score badge (if available) */}
                {score != null && <ScoreBadge score={score} />}
                {/* Star */}
                <button
                  onClick={() => onStar?.(item.id, !starred)}
                  className={`rounded p-1.5 transition-colors ${
                    starred
                      ? 'text-amber-500 hover:bg-amber-50'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                  title={starred ? '取消收藏' : '收藏'}
                >
                  <Bookmark className="h-4 w-4" fill={starred ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>

            {/* Meta row */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {published && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {published}
                </span>
              )}
              {item.author && <span>· {item.author}</span>}
              {feedTitle && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                  <FileText className="h-3 w-3" />
                  {feedTitle}
                </span>
              )}
            </div>

            {/* TL;DR */}
            {tldr && (
              <div className="mt-2 flex gap-2 rounded-lg bg-slate-50 p-2.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-600">{tldr}</p>
              </div>
            )}

            {/* Keywords row */}
            {keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Tag className="h-3 w-3 shrink-0 text-slate-400" />
                {keywords.map((kw) => (
                  <KeywordChip key={kw} label={kw} />
                ))}
              </div>
            )}

            {/* Action row */}
            <div className="mt-2 flex items-center gap-3">
              {hasExpandable && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-700"
                >
                  {expanded ? '收起' : '展开全文'}
                  <motion.span animate={{ rotate: expanded ? 180 : 0 }}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </motion.span>
                </button>
              )}

              <button
                onClick={handleSummarize}
                disabled={summarizing}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-60"
              >
                {summarizing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {summarizing ? 'AI 解析中…' : 'AI 一键总结'}
              </button>

              {summaryError && (
                <span className="text-[11px] text-red-500">总结失败，请重试</span>
              )}
            </div>

            {/* Expanded content */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                    {/* Highlights */}
                    {highlights.length > 0 && (
                      <div>
                        <h4 className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <ListChecks className="h-3.5 w-3.5 text-brand-500" />
                          关键要点
                        </h4>
                        <ul className="space-y-1">
                          {highlights.map((point, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[13px] text-slate-600">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* AI Summary */}
                    {aiSummary && (
                      <div>
                        <h4 className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                          AI 全文摘要
                        </h4>
                        <p className="text-[13px] leading-relaxed text-slate-600">{aiSummary}</p>
                      </div>
                    )}

                    {/* Raw content */}
                    {item.raw_content && (
                      <div>
                        <h4 className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <FileText className="h-3.5 w-3.5 text-slate-500" />
                          原文内容
                        </h4>
                        <div
                          className="prose prose-sm prose-slate max-w-none rounded-lg border border-slate-100 bg-slate-50 p-3 text-[13px] text-slate-600"
                          dangerouslySetInnerHTML={{ __html: item.raw_content.slice(0, 3000) }}
                        />
                        {item.raw_content.length > 3000 && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            （仅显示前 3000 字符，
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                              阅读完整原文
                            </a>
                            ）
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.article>
  )
}
