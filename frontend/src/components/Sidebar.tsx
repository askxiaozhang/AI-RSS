import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Sparkles,
  Rss,
  Filter,
  MessageSquare,
  BookOpen,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘', end: true },
  { to: '/analyze', icon: Sparkles, label: 'AI 解析', end: false },
  { to: '/feeds', icon: Rss, label: '订阅源', end: false },
  { to: '/reader', icon: BookOpen, label: '阅读', end: false },
  { to: '/filter', icon: Filter, label: '智能过滤', end: false },
  { to: '/chat', icon: MessageSquare, label: '对话助手', end: false },
]

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-200/60 bg-white/80 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 shadow-md shadow-brand-500/20">
          <Rss className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">AI-RSS</h1>
          <p className="text-[11px] font-medium text-slate-400">智能信息聚合</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
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
                  <Icon className="relative h-[18px] w-[18px]" strokeWidth={2} />
                  <span className="relative">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200/60 p-3">
        <button
          onClick={() => {
            logout()
            navigate('/login')
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          退出登录
        </button>
      </div>
    </aside>
  )
}
