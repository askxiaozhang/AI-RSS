import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Sparkles,
  Rss,
  Filter,
  MessageSquare,
  BookOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Save,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘', end: true },
  { to: '/analyze', icon: Sparkles, label: 'AI 解析', end: false },
  { to: '/feeds', icon: Rss, label: '订阅源', end: false },
  { to: '/reader', icon: BookOpen, label: '阅读', end: false },
  { to: '/filter', icon: Filter, label: '智能过滤', end: false },
  { to: '/chat', icon: MessageSquare, label: '对话助手', end: false },
]

// ---------------------------------------------------------------------------
// Global AI prompt settings (shown when sidebar is expanded)
// ---------------------------------------------------------------------------
function GlobalPromptSettings() {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState(() => localStorage.getItem('ai_prompt_global') || '')
  const [saved, setSaved] = useState(false)

  const save = () => {
    localStorage.setItem('ai_prompt_global', prompt)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="border-t border-slate-200/60 px-2 py-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100/70 hover:text-slate-700"
      >
        <Sparkles className="h-3.5 w-3.5 text-brand-400" />
        <span>AI 总结提示词</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="ml-auto"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="prompt-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 space-y-2 px-1 pb-1">
              <p className="text-[10px] leading-relaxed text-slate-400">
                全局默认提示词（可被单个信息源覆盖）
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：请用中文总结，重点提炼核心观点和关键数据..."
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              />
              <button
                onClick={save}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-50 py-1.5 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
              >
                {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                {saved ? '已保存' : '保存'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------
interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 256 }}
      initial={false}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="flex h-full flex-col overflow-hidden border-r border-slate-200/60 bg-white/80 backdrop-blur-xl"
    >
      {/* Logo row */}
      <div className="flex h-[65px] shrink-0 items-center px-3">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="logo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-md shadow-brand-500/20">
                <Rss className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight">AI-RSS</h1>
                <p className="truncate text-[11px] font-medium text-slate-400">智能信息聚合</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle button */}
        <button
          onClick={onToggle}
          title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 ${
            collapsed ? 'mx-auto' : 'ml-auto'
          }`}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                } ${
                  isActive
                    ? 'text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-lg bg-brand-50"
                      transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                    />
                  )}
                  <Icon className="relative h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        key="label"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="relative truncate"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Global AI prompt (only when expanded) */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="global-prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <GlobalPromptSettings />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-200/60 p-2">
        <button
          onClick={() => {
            logout()
            navigate('/login')
          }}
          title={collapsed ? '退出登录' : undefined}
          className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 ${
            collapsed ? 'justify-center px-0' : 'gap-3 px-3'
          }`}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="logout-label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                退出登录
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
