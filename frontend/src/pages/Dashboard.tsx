import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Rss,
  BookOpen,
  MessageSquare,
  ArrowRight,
} from 'lucide-react'
import AnimatedPage from '../components/AnimatedPage'
import { feedsApi, itemsApi } from '../api/client'
import type { Subscription } from '../types'

export default function Dashboard() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [subsRes, unreadRes] = await Promise.allSettled([
          feedsApi.listSubscriptions(),
          itemsApi.listUnread(),
        ])
        if (subsRes.status === 'fulfilled') setSubs(subsRes.value.data)
        if (unreadRes.status === 'fulfilled') setUnreadCount(unreadRes.value.data.length)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const quickActions = [
    {
      to: '/analyze',
      icon: Sparkles,
      label: 'AI 解析网站',
      description: '输入任意网址，AI 自动提取为 RSS 源',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      to: '/feeds',
      icon: Rss,
      label: '订阅源管理',
      description: `${subs.length} 个订阅 · ${unreadCount} 篇未读`,
      gradient: 'from-brand-500 to-cyan-500',
    },
    {
      to: '/filter',
      icon: BookOpen,
      label: '智能过滤',
      description: '用自然语言筛选你关心的内容',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      to: '/chat',
      icon: MessageSquare,
      label: '对话助手',
      description: '针对订阅内容提问，AI 为你解答',
      gradient: 'from-orange-500 to-amber-500',
    },
  ]

  return (
    <AnimatedPage>
      {/* Welcome */}
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-bold tracking-tight dark:text-slate-100"
        >
          你好 👋
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-2 text-slate-600 dark:text-slate-400"
        >
          {unreadCount > 0
            ? `今天有 ${unreadCount} 篇新内容等你阅读`
            : '一切已读完，去发现新的信息源吧'}
        </motion.p>
      </div>

      {/* Stats strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <StatCard label="订阅数" value={subs.length} icon={<Rss className="h-4 w-4" />} />
        <StatCard
          label="未读文章"
          value={unreadCount}
          icon={<BookOpen className="h-4 w-4" />}
        />
        <StatCard
          label="AI 源"
          value={subs.filter((s) => false).length}
          icon={<Sparkles className="h-4 w-4" />}
        />
      </motion.div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500">
          快速开始
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickActions.map((action, i) => {
            const Icon = action.icon
            return (
              <motion.div
                key={action.to}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <Link
                  to={action.to}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200/70 bg-white/80 p-5 backdrop-blur transition-all hover:border-transparent hover:shadow-lg dark:border-slate-700/70 dark:bg-slate-800/80 dark:hover:border-slate-600/50 dark:hover:shadow-black/20"
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} shadow-md`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900 group-hover:text-brand-700 dark:text-slate-100 dark:group-hover:text-brand-400">
                      {action.label}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{action.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600 dark:text-slate-600 dark:group-hover:text-brand-400" />
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </AnimatedPage>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-4 backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/80">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
        <div className="text-xs text-slate-500 dark:text-slate-500">{label}</div>
      </div>
    </div>
  )
}
