import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Globe,
  FileText,
  Check,
  Loader2,
  Plus,
  ArrowRight,
  X,
} from 'lucide-react'
import AnimatedPage from '../components/AnimatedPage'
import { agentsApi, feedsApi } from '../api/client'
import type { AgentTestResult } from '../types'

export default function UrlAnalyzer() {
  const [url, setUrl] = useState('')
  const [instructions, setInstructions] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AgentTestResult | null>(null)
  const [error, setError] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [feedTitle, setFeedTitle] = useState('')
  const [folder, setFolder] = useState('Uncategorized')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setError('')
    setResult(null)
    setSubscribed(false)
    setLoading(true)
    try {
      const { data } = await agentsApi.testCrawl(
        url.trim(),
        instructions.trim() || 'Extract all article titles, links and summaries from this page.',
      )
      setResult(data)
      // Auto-generate feed title from URL host
      try {
        const host = new URL(url.trim()).hostname.replace('www.', '')
        setFeedTitle(host)
      } catch {
        setFeedTitle('')
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || '分析失败，请检查网址是否正确')
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    if (!result || !feedTitle) return
    setSubscribing(true)
    try {
      const { data: feed } = await feedsApi.create({
        title: feedTitle,
        url: url.trim(),
        feed_type: 'agent_crawled',
        crawl_instructions: instructions.trim() || undefined,
      })
      await feedsApi.subscribe({
        feed_id: feed.id,
        folder_name: folder,
        ai_filter_rules: instructions.trim() || undefined,
      })
      setSubscribed(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || '订阅失败')
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <AnimatedPage>
      {/* Hero */}
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
          <Sparkles className="h-3.5 w-3.5" />
          AI 网站解析
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          把任意网站变成 <span className="text-gradient">RSS 源</span>
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          输入网址，告诉 AI 你想提取什么内容，它会自动分析并生成订阅源。
          没有 RSS？没关系，AI 帮你搞定。
        </p>
      </div>

      {/* Form */}
      <motion.form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur"
      >
        <div className="space-y-4">
          {/* URL input */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              网站地址
            </label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/blog"
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
              />
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              抓取说明 <span className="text-slate-400">(可选)</span>
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="例如：提取页面中的所有文章标题、链接和摘要，忽略广告和侧边栏内容…"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
            />
          </div>

          {/* Example prompts */}
          <div className="flex flex-wrap gap-2">
            {[
              '提取所有文章标题和链接',
              '只要关于 AI 的内容，忽略其他',
              '提取产品发布和更新日志',
            ].map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => setInstructions(hint)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {hint}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 py-3 text-sm font-semibold text-white shadow-md shadow-brand-500/20 transition-all hover:shadow-lg disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 正在分析…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                开始分析
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </motion.form>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <X className="h-4 w-4" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 space-y-4"
          >
            {/* Summary */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-emerald-900">分析完成</div>
                  <div className="text-sm text-emerald-700">
                    发现 {result.items_count} 条可订阅内容
                  </div>
                </div>
              </div>
            </div>

            {/* Items preview */}
            {result.items.length > 0 && (
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 backdrop-blur">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileText className="h-4 w-4 text-slate-500" />
                  提取结果预览
                </h3>
                <div className="space-y-2">
                  {result.items.slice(0, 8).map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        {item.title && (
                          <div className="font-medium text-slate-900">
                            {String(item.title)}
                          </div>
                        )}
                        {item.link && (
                          <a
                            href={String(item.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-xs text-brand-600 hover:underline"
                          >
                            {String(item.link)}
                          </a>
                        )}
                        {item.summary && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                            {String(item.summary)}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {result.items.length > 8 && (
                    <p className="pt-2 text-center text-xs text-slate-400">
                      还有 {result.items.length - 8} 条…
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Subscribe card */}
            {!subscribed ? (
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 backdrop-blur">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Plus className="h-4 w-4 text-slate-500" />
                  订阅此源
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      订阅名称
                    </label>
                    <input
                      type="text"
                      value={feedTitle}
                      onChange={(e) => setFeedTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      分类文件夹
                    </label>
                    <input
                      type="text"
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      placeholder="Uncategorized"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                    />
                  </div>
                  <button
                    onClick={handleSubscribe}
                    disabled={subscribing || !feedTitle}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                  >
                    {subscribing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RssIcon />
                        订阅此源
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-4"
              >
                <Check className="h-5 w-5 text-emerald-600" />
                <span className="font-medium text-emerald-900">
                  已成功订阅！前往「订阅源」页面查看。
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatedPage>
  )
}

function RssIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  )
}
