import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe, Sparkles, Loader2, Check, X, MousePointer2,
  ArrowRight, RefreshCw, Code2, ChevronLeft, Rss,
  Navigation, Crosshair, ExternalLink, CornerDownLeft,
  MonitorPlay, ChevronUp, ChevronDown as ChevronDownIcon,
} from 'lucide-react'
import { agentsApi, feedsApi } from '../api/client'
import type { BrowserRenderResult, BrowserClickResult } from '../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Step = 'url' | 'inspect' | 'subscribe'
type Mode = 'browse' | 'select'
type RenderMode = 'html' | 'browser'   // html = static scrape, browser = Playwright

interface PreviewItem { title: string; link: string; description: string }
interface AiMessage {
  id: number
  text: string
  items?: PreviewItem[]
  type?: 'info' | 'found' | 'empty' | 'error' | 'confirm' | 'nav'
}

// ---------------------------------------------------------------------------
// Static-HTML iframe helpers
// ---------------------------------------------------------------------------
const INSPECTOR_CSS = `
  body._sel * { cursor: crosshair !important; user-select: none !important; }
  body._sel ._h { outline: 2px solid #818cf8 !important; background: rgba(129,140,248,0.07) !important; }
  ._s { outline: 3px solid #22c55e !important; background: rgba(34,197,94,0.09) !important; }
  ._m { outline: 2px dashed #4ade80 !important; background: rgba(34,197,94,0.04) !important; }
`
function makeSelector(el: Element): string {
  if (el.id) return `#${el.id}`
  const tag = el.tagName.toLowerCase()
  const cls = Array.from(el.classList).filter(c => c && !c.startsWith('_')).slice(0, 2)
  return cls.length ? `${tag}.${cls.join('.')}` : tag
}
function findRepeating(el: Element, body: HTMLElement): Element {
  let cur: Element = el
  while (cur.parentElement && cur.parentElement !== body) {
    const parent = cur.parentElement
    if (Array.from(parent.children).filter(c => c.tagName === cur.tagName).length >= 2) break
    cur = parent
  }
  return cur
}
function applyHighlights(doc: Document, selector: string): number {
  doc.querySelectorAll('._s,._m').forEach(e => e.classList.remove('_s', '_m'))
  try {
    const m = doc.querySelectorAll(selector)
    m.forEach((el, i) => el.classList.add(i === 0 ? '_s' : '_m'))
    return m.length
  } catch { return 0 }
}

let _msgId = 0
const nextId = () => ++_msgId

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function UrlAnalyzer() {
  // ── Core state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('url')
  const [urlInput, setUrlInput] = useState('')
  const [loadedUrl, setLoadedUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState('')

  // ── Render mode ─────────────────────────────────────────────────────────
  const [renderMode, setRenderMode] = useState<RenderMode>('html')
  const [requiresJs, setRequiresJs] = useState(false)

  // ── Static HTML mode ────────────────────────────────────────────────────
  const [pageHtml, setPageHtml] = useState('')
  const [mode, setMode] = useState<Mode>('browse')
  const modeRef = useRef<Mode>('browse')
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const navigateFnRef = useRef<((u: string) => Promise<void>) | null>(null)

  // ── Browser (Playwright) mode ────────────────────────────────────────────
  const [sessionId] = useState(() => Math.random().toString(36).slice(2))
  const [screenshot, setScreenshot] = useState<BrowserRenderResult | null>(null)
  const [browserHighlights, setBrowserHighlights] = useState<BrowserClickResult['highlights']>([])
  const [loadingClick, setLoadingClick] = useState(false)
  const screenshotRef = useRef<HTMLDivElement>(null)

  // ── Selector & AI chat ──────────────────────────────────────────────────
  const [selector, setSelector] = useState('')
  const [selectorInput, setSelectorInput] = useState('')
  const [editingSelector, setEditingSelector] = useState(false)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([])
  const [previewCount, setPreviewCount] = useState(0)
  const [loadingItems, setLoadingItems] = useState(false)

  // ── Subscribe ────────────────────────────────────────────────────────────
  const [feedTitle, setFeedTitle] = useState('')
  const [folder, setFolder] = useState('Uncategorized')
  const [subscribing, setSubscribing] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subError, setSubError] = useState('')

  const chatBottomRef = useRef<HTMLDivElement>(null)

  const pushMsg = (msg: Omit<AiMessage, 'id'>) =>
    setMessages(prev => [...prev, { id: nextId(), ...msg }])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => { modeRef.current = mode }, [mode])

  // ---------------------------------------------------------------------------
  // Load URL — tries static HTML first, falls back to browser mode on SPA
  // ---------------------------------------------------------------------------
  const loadUrl = useCallback(async (rawUrl: string, forceBrowser = false) => {
    const trimmed = rawUrl.trim()
    if (!trimmed) return
    setLoadingPreview(true)
    setPreviewError('')
    setBrowserHighlights([])
    try {
      if (!forceBrowser) {
        const { data } = await agentsApi.fetchPreview(trimmed)
        setLoadedUrl(trimmed)
        setUrlInput(trimmed)
        setPageTitle(data.title)
        if (data.requires_js) {
          // Automatically switch to browser mode for JS SPAs
          setRequiresJs(true)
          setRenderMode('browser')
          setPageHtml('')
          // Immediately kick off browser render
          await _browserLoad(trimmed)
        } else {
          setRequiresJs(false)
          setRenderMode('html')
          setPageHtml(data.html)
        }
      } else {
        await _browserLoad(trimmed)
      }
      try { setFeedTitle(new URL(trimmed).hostname.replace('www.', '')) } catch {}
    } catch (err: any) {
      setPreviewError(err.response?.data?.detail || '无法加载该页面')
    } finally {
      setLoadingPreview(false)
    }
  }, [sessionId]) // eslint-disable-line

  const _browserLoad = async (url: string) => {
    const { data } = await agentsApi.browserRender(url, sessionId)
    setLoadedUrl(data.current_url || url)
    setUrlInput(data.current_url || url)
    setPageTitle(data.title)
    setScreenshot(data)
    setRenderMode('browser')
  }

  useEffect(() => { navigateFnRef.current = loadUrl }, [loadUrl])

  // ---------------------------------------------------------------------------
  // Step 1 submit
  // ---------------------------------------------------------------------------
  const handleLoadPreview = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessages([])
    setSelector('')
    setPreviewItems([])
    setRequiresJs(false)
    await loadUrl(urlInput)
    pushMsg({
      type: 'info',
      text: requiresJs || renderMode === 'browser'
        ? '已用真实浏览器渲染页面！\n\n切换到「选择」模式后，点击页面任意元素即可识别同类区块。'
        : '页面加载完成！\n\n• 浏览模式：点击链接正常跳转\n• 选择模式：点击文章卡片，AI 自动识别同类元素\n\n右上角切换模式。',
    })
    setStep('inspect')
  }

  // ---------------------------------------------------------------------------
  // Preview items for a given selector
  // In browser mode: query the live Playwright session DOM (supports JS SPAs).
  // In html mode: fall back to static HTTP fetch.
  // ---------------------------------------------------------------------------
  const loadPreviewForSelector = useCallback(async (sel: string, targetUrl: string) => {
    setLoadingItems(true)
    try {
      let data: { count: number; items: { title: string; link: string; description: string }[] }

      if (renderMode === 'browser') {
        // Use the live browser session — DOM is already JS-rendered
        const res = await agentsApi.browserPreviewSelector(sessionId, sel)
        data = res.data
      } else {
        // Static HTTP fetch (works for SSR pages)
        const res = await agentsApi.previewSelector(targetUrl, sel)
        data = res.data
      }

      setPreviewItems(data.items)
      setPreviewCount(data.count)
      if (data.count === 0) {
        pushMsg({ type: 'empty', text: `选择器 \`${sel}\` 没有匹配内容，请换一个区块试试。` })
      } else {
        pushMsg({
          type: 'found',
          items: data.items.slice(0, 4),
          text: `识别到 **${data.count}** 个匹配条目（\`${sel}\`）。内容预览如下，这是你想要的吗？`,
        })
      }
    } catch {
      pushMsg({ type: 'error', text: '解析出错，请尝试其他区块或手动编辑选择器。' })
    } finally {
      setLoadingItems(false)
    }
  }, [renderMode, sessionId])

  // ---------------------------------------------------------------------------
  // Browser mode: click on screenshot
  // ---------------------------------------------------------------------------
  const handleScreenshotClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!screenshot || mode !== 'select') return
    const container = screenshotRef.current
    if (!container) return

    // container is now sized exactly to the rendered image (w-full, h-auto)
    // so a single uniform scale factor converts click coords to Playwright coords.
    const rect = container.getBoundingClientRect()
    const scale = screenshot.width / rect.width   // same ratio for x and y
    const x = Math.round((e.clientX - rect.left) * scale)
    const y = Math.round((e.clientY - rect.top)  * scale)

    setLoadingClick(true)
    try {
      const { data } = await agentsApi.browserClick(sessionId, x, y)
      setBrowserHighlights(data.highlights)
      setSelector(data.selector)
      setSelectorInput(data.selector)
      await loadPreviewForSelector(data.selector, loadedUrl)
    } catch (err: any) {
      pushMsg({ type: 'error', text: '点击识别失败，请再试一次。' })
    } finally {
      setLoadingClick(false)
    }
  }

  // Browser mode: scroll
  const handleScroll = async (dir: 1 | -1) => {
    if (renderMode !== 'browser') return
    const deltaY = dir * 400
    try {
      const { data } = await agentsApi.browserScroll(sessionId, deltaY)
      setScreenshot(data)
      setBrowserHighlights([])
    } catch {}
  }

  // Browser mode: link navigation
  const handleBrowserNavigate = async (url: string) => {
    setLoadingPreview(true)
    setBrowserHighlights([])
    try {
      const { data } = await agentsApi.browserNavigate(sessionId, url)
      setScreenshot(data)
      setLoadedUrl(data.current_url || url)
      setUrlInput(data.current_url || url)
      setPageTitle(data.title)
      pushMsg({ type: 'nav', text: `已跳转到：${data.current_url || url}` })
    } catch {
      pushMsg({ type: 'error', text: '页面跳转失败。' })
    } finally {
      setLoadingPreview(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Static iframe: event wiring
  // ---------------------------------------------------------------------------
  const handleElementClick = useCallback((el: Element, body: HTMLElement, doc: Document) => {
    const target = findRepeating(el, body)
    const sel = makeSelector(target)
    applyHighlights(doc, sel)
    setSelector(sel)
    setSelectorInput(sel)
    loadPreviewForSelector(sel, loadedUrl)
  }, [loadedUrl, loadPreviewForSelector])

  const elClickRef = useRef(handleElementClick)
  useEffect(() => { elClickRef.current = handleElementClick }, [handleElementClick])

  const onIframeLoad = useCallback(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    const body = doc?.body as HTMLBodyElement | null
    if (!doc || !body) return

    if (!doc.getElementById('_rss_css')) {
      const style = doc.createElement('style')
      style.id = '_rss_css'
      style.textContent = INSPECTOR_CSS
      doc.head.appendChild(style)
    }
    if (modeRef.current === 'select') body.classList.add('_sel')

    let hovered: Element | null = null
    const onOver = (e: MouseEvent) => {
      if (modeRef.current !== 'select') return
      const t = e.target as Element
      if (t === hovered || t === body) return
      hovered?.classList.remove('_h')
      t.classList.add('_h')
      hovered = t
      e.stopPropagation()
    }
    const onOut = () => { hovered?.classList.remove('_h'); hovered = null }
    const onClick = (e: MouseEvent) => {
      if (modeRef.current === 'select') {
        e.preventDefault(); e.stopPropagation()
        elClickRef.current(e.target as Element, body, doc)
        return
      }
      const anchor = (e.target as Element).closest?.('a') as HTMLAnchorElement | null
      if (anchor) {
        e.preventDefault()
        const href = anchor.getAttribute('href') || ''
        if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
          try {
            const abs = new URL(href, loadedUrl).href
            navigateFnRef.current?.(abs)
            pushMsg({ type: 'nav', text: `正在加载：${abs}` })
          } catch {}
        }
      }
    }
    doc.addEventListener('mouseover', onOver)
    doc.addEventListener('mouseleave', onOut)
    doc.addEventListener('click', onClick, true)
  }, [loadedUrl])

  const switchMode = (next: Mode) => {
    modeRef.current = next
    setMode(next)
    const doc = iframeRef.current?.contentDocument
    if (doc?.body) {
      if (next === 'select') doc.body.classList.add('_sel')
      else { doc.body.classList.remove('_sel'); doc.querySelectorAll('._h').forEach(e => e.classList.remove('_h')) }
    }
  }

  // ---------------------------------------------------------------------------
  // Manual selector
  // ---------------------------------------------------------------------------
  const applyManualSelector = async () => {
    const sel = selectorInput.trim()
    if (!sel) return
    setEditingSelector(false)
    setSelector(sel)
    if (renderMode === 'html') {
      const doc = iframeRef.current?.contentDocument
      if (doc) applyHighlights(doc, sel)
    }
    await loadPreviewForSelector(sel, loadedUrl)
  }

  const handleConfirm = () => {
    pushMsg({ type: 'confirm', text: `已确认！选择器 \`${selector}\` 共 ${previewCount} 条内容。` })
    setStep('subscribe')
  }
  const handleReselect = () => {
    setPreviewItems([])
    setBrowserHighlights([])
    const doc = iframeRef.current?.contentDocument
    doc?.querySelectorAll('._s,._m').forEach(e => e.classList.remove('_s', '_m'))
    pushMsg({ type: 'info', text: '好的，请在左侧重新点击选取区块。' })
    if (renderMode === 'html') switchMode('select')
    else setMode('select')
  }

  const handleSubscribe = async () => {
    if (!feedTitle) return
    setSubscribing(true)
    setSubError('')
    try {
      const { data: feed } = await feedsApi.create({
        title: feedTitle, url: loadedUrl, feed_type: 'agent_crawled',
        crawl_instructions: `使用 CSS 选择器 "${selector}" 提取文章列表，获取每个条目的标题、链接和摘要。`,
      })
      await feedsApi.subscribe({ feed_id: feed.id, folder_name: folder })
      setSubscribed(true)
    } catch (err: any) {
      setSubError(err.response?.data?.detail || '订阅失败，请重试')
    } finally {
      setSubscribing(false)
    }
  }

  const srcdoc = pageHtml ? `<!DOCTYPE html><html>${pageHtml}</html>` : ''

  // ============================================================
  // Step 1: URL input
  // ============================================================
  if (step === 'url') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
            <Sparkles className="h-3.5 w-3.5" />可视化 AI 抓取
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
            把任意网站变成{' '}
            <span className="bg-gradient-to-r from-brand-500 to-purple-600 bg-clip-text text-transparent">RSS 订阅源</span>
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            输入网址后，支持静态预览或真实浏览器渲染（自动检测），点击任意文章卡片即可完成抓取配置。
          </p>
        </div>

        <form onSubmit={handleLoadPreview} className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/80">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">网站地址</label>
              <div className="relative">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com/blog" required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-700 dark:focus:ring-brand-900/30" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {['https://www.anthropic.com/news','https://space.bilibili.com/1845434732','https://techcrunch.com/category/artificial-intelligence'].map(ex => (
                <button key={ex} type="button" onClick={() => setUrlInput(ex)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:border-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400">
                  {ex.replace('https://', '')}
                </button>
              ))}
            </div>
            {previewError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <X className="h-4 w-4 shrink-0" />{previewError}
              </div>
            )}
            <button type="submit" disabled={loadingPreview}
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 py-3 text-sm font-semibold text-white shadow-md shadow-brand-500/20 transition-all hover:shadow-lg disabled:opacity-50">
              {loadingPreview ? <><Loader2 className="h-4 w-4 animate-spin" />正在加载页面…</>
                : <><Navigation className="h-4 w-4" />加载页面<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ============================================================
  // Step 2: Inspector
  // ============================================================
  if (step === 'inspect') {
    return (
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* ── Left panel ── */}
        <div className="relative flex flex-1 flex-col overflow-hidden border-r border-slate-200">
          {/* Address bar */}
          <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
            <button onClick={() => setStep('url')} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <form className="flex min-w-0 flex-1 items-center gap-1"
              onSubmit={e => { e.preventDefault(); loadUrl(urlInput); pushMsg({ type: 'nav', text: `正在加载：${urlInput}` }) }}>
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
                {loadingPreview
                  ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />
                  : <Globe className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none" spellCheck={false} />
                <button type="submit" className="text-slate-400 hover:text-brand-600"><CornerDownLeft className="h-3 w-3" /></button>
              </div>
            </form>
            <a href={loadedUrl} target="_blank" rel="noopener noreferrer"
              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
              <ExternalLink className="h-4 w-4" />
            </a>

            {/* Render mode toggle */}
            <div className="ml-1 flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
              <button onClick={() => { setRenderMode('html'); setMode('browse') }}
                title="静态预览（快速）"
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${renderMode === 'html' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <Globe className="h-3 w-3" />静态
              </button>
              <button onClick={() => { setRenderMode('browser'); loadUrl(loadedUrl, true) }}
                title="真实浏览器渲染（支持 SPA）"
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${renderMode === 'browser' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <MonitorPlay className="h-3 w-3" />浏览器
              </button>
            </div>

            {/* Interaction mode toggle (only for html mode) */}
            {renderMode === 'html' && (
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                <button onClick={() => switchMode('browse')}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${mode === 'browse' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <Navigation className="h-3.5 w-3.5" />浏览
                </button>
                <button onClick={() => switchMode('select')}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${mode === 'select' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <Crosshair className="h-3.5 w-3.5" />选择
                </button>
              </div>
            )}

            {/* Browser mode: select toggle */}
            {renderMode === 'browser' && (
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                <button onClick={() => setMode('browse')}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${mode === 'browse' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <Navigation className="h-3.5 w-3.5" />浏览
                </button>
                <button onClick={() => setMode('select')}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${mode === 'select' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <Crosshair className="h-3.5 w-3.5" />选择
                </button>
              </div>
            )}
          </div>

          {/* Hint bar */}
          <div className={`shrink-0 px-4 py-1 text-[11px] font-medium ${
            renderMode === 'browser' ? 'bg-purple-50 text-purple-700'
            : mode === 'select' ? 'bg-purple-50 text-purple-700'
            : 'bg-brand-50 text-brand-700'
          }`}>
            {renderMode === 'browser'
              ? mode === 'select'
                ? <span className="flex items-center gap-1.5"><Crosshair className="h-3 w-3" />选择模式：点击截图中的文章区块，AI 实时识别同类元素并提取预览</span>
                : <span className="flex items-center gap-1.5"><MonitorPlay className="h-3 w-3" />浏览模式：上下箭头滚动页面 · 切换至「选择」模式后可点击选取</span>
              : mode === 'select'
              ? <span className="flex items-center gap-1.5"><Crosshair className="h-3 w-3" />选择模式：悬停高亮 · 点击选取文章卡片 · AI 自动识别同类条目</span>
              : <span className="flex items-center gap-1.5"><Navigation className="h-3 w-3" />浏览模式：点击链接正常跳转，找到文章列表后切换至「选择」模式</span>
            }
          </div>

          {/* Loading overlay */}
          {(loadingPreview || loadingClick) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
              <div className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 shadow-lg text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                {loadingClick ? 'AI 正在识别元素…' : '正在加载页面…'}
              </div>
            </div>
          )}

          {/* ── Static iframe ── */}
          {renderMode === 'html' && (
            <iframe ref={iframeRef} srcDoc={srcdoc} sandbox="allow-same-origin"
              onLoad={onIframeLoad} title="page-preview"
              className="h-full w-full flex-1 border-0 bg-white" />
          )}

          {/* ── Browser screenshot ── */}
          {renderMode === 'browser' && screenshot && (
            // Outer div scrolls vertically so we never crop the image
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-100">
              {/* Scroll-to-load buttons (Playwright page scroll, not just visual scroll) */}
              <div className="sticky top-2 right-0 z-10 flex justify-end pr-3 pointer-events-none">
                <div className="pointer-events-auto flex flex-col gap-1.5">
                  <button onClick={() => handleScroll(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md text-slate-600 hover:bg-slate-50 hover:shadow-lg">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleScroll(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md text-slate-600 hover:bg-slate-50 hover:shadow-lg">
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/*
                Key fix: image fills full width with natural (auto) height.
                The inner div becomes exactly the same size as the rendered image,
                so the SVG overlay coordinate system matches 1:1.
                (No object-contain letterboxing = no coordinate mismatch.)
              */}
              <div
                ref={screenshotRef}
                onClick={handleScreenshotClick}
                className={`relative w-full ${mode === 'select' ? 'cursor-crosshair' : 'cursor-default'}`}
              >
                <img
                  src={`data:image/jpeg;base64,${screenshot.screenshot}`}
                  alt="Browser preview"
                  className="block w-full"
                  draggable={false}
                />
                {/* SVG overlay — same dimensions as the img, so viewBox maps perfectly */}
                {browserHighlights.length > 0 && (
                  <svg
                    className="pointer-events-none absolute inset-0 w-full h-full"
                    viewBox={`0 0 ${screenshot.width} ${screenshot.height}`}
                    preserveAspectRatio="none"
                  >
                    {browserHighlights.map((r, i) => (
                      <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height}
                        fill={i === 0 ? 'rgba(34,197,94,0.15)' : 'rgba(74,222,128,0.08)'}
                        stroke={i === 0 ? '#22c55e' : '#4ade80'}
                        strokeWidth={i === 0 ? 3 : 2}
                        strokeDasharray={i === 0 ? '' : '6,3'}
                        rx={3}
                      />
                    ))}
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: AI chat panel ── */}
        <div className="flex w-[360px] shrink-0 flex-col bg-white dark:bg-slate-900">
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI 抓取助手</div>
              <div className="truncate text-[11px] text-slate-400 flex items-center gap-1">
                {renderMode === 'browser' && <MonitorPlay className="h-3 w-3 text-purple-500" />}
                {pageTitle}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${msg.type === 'nav' ? 'bg-slate-100' : 'bg-brand-100'}`}>
                      {msg.type === 'nav' ? <Navigation className="h-3.5 w-3.5 text-slate-500" /> : <Sparkles className="h-3.5 w-3.5 text-brand-600" />}
                    </div>
                    <div className={`min-w-0 flex-1 rounded-2xl rounded-tl-sm px-3 py-2.5 ${msg.type === 'nav' ? 'bg-slate-50 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-700'}`}>
                      <p className="whitespace-pre-line text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
                        {msg.text.split(/(\*\*.*?\*\*|`.*?`)/g).map((part, i) => {
                          if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
                          if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="rounded bg-slate-200 px-1 font-mono text-[11px] text-brand-700">{part.slice(1, -1)}</code>
                          return part
                        })}
                      </p>
                      {msg.items && msg.items.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {msg.items.map((item, i) => (
                            <div key={i} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                              <div className="flex items-start gap-1.5">
                                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">{i + 1}</span>
                                <div className="min-w-0">
                                  <p className="truncate text-[12px] font-medium text-slate-800">{item.title || '(无标题)'}</p>
                                  {item.link && <p className="truncate text-[10px] text-brand-500">{item.link}</p>}
                                  {item.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{item.description}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {(loadingItems || loadingClick) && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                </div>
                AI 正在解析选中区块…
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Bottom actions */}
          <div className="shrink-0 space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
            {selector && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">当前选择器</span>
                  <button onClick={() => { setEditingSelector(v => !v); setSelectorInput(selector) }}
                    className="text-[11px] font-medium text-brand-600 hover:text-brand-700">
                    <Code2 className="mr-0.5 inline h-3 w-3" />{editingSelector ? '取消' : '手动编辑'}
                  </button>
                </div>
                {editingSelector ? (
                  <div className="flex gap-1.5">
                    <input value={selectorInput} onChange={e => setSelectorInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && applyManualSelector()} autoFocus
                      className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[12px] text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
                    <button onClick={applyManualSelector}
                      className="rounded bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-600">应用</button>
                  </div>
                ) : (
                  <code className="block truncate font-mono text-[12px] text-slate-700">{selector}</code>
                )}
                {previewCount > 0 && !editingSelector && (
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    匹配 <span className="font-semibold text-emerald-600">{previewCount}</span> 个条目
                  </p>
                )}
              </div>
            )}
            {selector && !loadingItems && !loadingClick && previewCount > 0 ? (
              <div className="flex gap-2">
                <button onClick={handleReselect}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                  <RefreshCw className="h-3.5 w-3.5" />重新选择
                </button>
                <button onClick={handleConfirm}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md">
                  <Check className="h-3.5 w-3.5" />确认选择
                </button>
              </div>
            ) : (
              !selector && (
                <p className="text-center text-xs text-slate-400">
                  {mode === 'select'
                    ? renderMode === 'browser' ? '点击截图中的文章区块来选取' : '点击左侧页面中的文章卡片开始'
                    : '先浏览到文章列表页，再切换至「选择」模式'}
                </p>
              )
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Step 3: Subscribe
  // ============================================================
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => setStep('inspect')} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="font-semibold text-slate-900">设置订阅</h2>
          <p className="text-xs text-slate-500">
            将以 <code className="rounded bg-slate-100 px-1 text-brand-700">{selector}</code> 抓取 {previewCount} 条内容
          </p>
        </div>
      </div>

      {!subscribed ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          {previewItems.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">内容预览（前 {Math.min(previewItems.length, 3)} 条）</p>
              <div className="space-y-1.5">
                {previewItems.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                      {item.link && <p className="truncate text-[11px] text-brand-500">{item.link}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">订阅名称</label>
              <input type="text" value={feedTitle} onChange={e => setFeedTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">分类文件夹</label>
              <input type="text" value={folder} onChange={e => setFolder(e.target.value)} placeholder="Uncategorized"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100" />
            </div>
            {subError && <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><X className="h-4 w-4 shrink-0" />{subError}</div>}
            <button onClick={handleSubscribe} disabled={subscribing || !feedTitle}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50">
              {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Rss className="h-4 w-4" />确认并订阅</>}
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-7 w-7 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-900">订阅成功！</h3>
            <p className="mt-1 text-sm text-emerald-700">「{feedTitle}」已添加，AI 将按设定间隔自动抓取更新。</p>
          </div>
          <button onClick={() => { setStep('url'); setUrlInput(''); setSelector(''); setPreviewItems([]); setMessages([]); setSubscribed(false); setFeedTitle(''); setScreenshot(null) }}
            className="text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900">再添加一个</button>
        </motion.div>
      )}
    </div>
  )
}
