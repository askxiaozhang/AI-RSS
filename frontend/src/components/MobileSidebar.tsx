import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard,
  Sparkles,
  Rss,
  Filter,
  MessageSquare,
  Users,
  LogOut,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘', end: true },
  { to: '/analyze', icon: Sparkles, label: 'AI 解析', end: false },
  { to: '/feeds', icon: Rss, label: '订阅源', end: false },
  { to: '/filter', icon: Filter, label: '智能过滤', end: false },
  { to: '/teams', icon: Users, label: '团队', end: false },
  { to: '/chat', icon: MessageSquare, label: '对话助手', end: false },
]

export default function MobileSidebar({ onClose }: { onClose: () => void }) {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm dark:bg-black/60 lg:hidden"
      />
      {/* Panel */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        exit={{ x: -280 }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-2xl dark:bg-slate-900 dark:shadow-black/40 lg:hidden"
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600">
              <Rss className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-base font-bold dark:text-slate-100">AI-RSS</h1>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-slate-200/60 p-3 dark:border-slate-800/60">
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400"
          >
            <LogOut className="h-[18px] w-[18px]" />
            退出登录
          </button>
        </div>
      </motion.aside>
    </>
  )
}
