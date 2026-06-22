import { Menu, Search, Sun, Moon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useThemeStore } from '../store/themeStore'

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [query, setQuery] = useState('')
  const { theme, toggle } = useThemeStore()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/80 lg:px-8">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="搜索订阅、文章、关键词…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-800 dark:focus:ring-brand-900/30"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggle}
          title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </motion.button>

        {/* Avatar */}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-purple-500 text-sm font-semibold text-white shadow-sm">
          U
        </div>
      </div>
    </header>
  )
}
