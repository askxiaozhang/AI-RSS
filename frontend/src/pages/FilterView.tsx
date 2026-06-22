import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Filter, Sparkles, Send, Wand2 } from 'lucide-react'
import AnimatedPage from '../components/AnimatedPage'

interface Rule {
  id: string
  prompt: string
  active: boolean
}

export default function FilterView() {
  const [rules, setRules] = useState<Rule[]>([
    {
      id: '1',
      prompt: '只保留关于大语言模型和向量数据库的文章，过滤掉创业融资新闻',
      active: true,
    },
    {
      id: '2',
      prompt: '保留技术深度文章，过滤掉纯新闻和公告类内容',
      active: false,
    },
  ])
  const [newPrompt, setNewPrompt] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!newPrompt.trim()) return
    setRules([
      ...rules,
      {
        id: String(Date.now()),
        prompt: newPrompt.trim(),
        active: true,
      },
    ])
    setNewPrompt('')
  }

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)))
  }

  const removeRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id))
  }

  return (
    <AnimatedPage>
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          <Sparkles className="h-3.5 w-3.5" />
          即将上线
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
          智能<span className="text-gradient">过滤</span>
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          用自然语言描述你想看什么、不想看什么，AI 会为你精准筛选每一条订阅内容。
        </p>
      </div>

      {/* Beta notice */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
      >
        <Wand2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <h3 className="font-semibold text-amber-900">功能预览</h3>
          <p className="mt-0.5 text-sm text-amber-800">
            这是智能过滤的占位页面。你可以在这里定义过滤规则，功能正式上线后将自动应用到你的订阅内容。
          </p>
        </div>
      </motion.div>

      {/* Add new rule */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-5 backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/80"
      >
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          添加过滤规则
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            placeholder="例如：只要关于 TypeScript 的文章…"
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-700 dark:focus:ring-brand-900/30"
          />
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
          >
            <Send className="h-4 w-4" />
            添加
          </button>
        </div>

        {/* Quick examples */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            '过滤掉所有广告',
            '只要原创深度内容',
            '保留最近 24 小时的文章',
          ].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setNewPrompt(ex)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:border-brand-600 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
            >
              {ex}
            </button>
          ))}
        </div>
      </motion.form>

      {/* Rules list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          我的过滤规则
        </h2>
        {rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white/50 p-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-600">
            还没有过滤规则，添加一个试试
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, i) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-all ${
                  rule.active
                    ? 'border-slate-200/70 bg-white/80 dark:border-slate-700/70 dark:bg-slate-800/80'
                    : 'border-slate-100 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-800/30'
                }`}
              >
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors ${
                    rule.active ? 'bg-brand-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <motion.span
                    layout
                    className="h-4 w-4 rounded-full bg-white shadow"
                    animate={{ x: rule.active ? 16 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600" />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      规则 {i + 1}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{rule.prompt}</p>
                </div>
                <button
                  onClick={() => removeRule(rule.id)}
                  className="shrink-0 text-xs text-slate-400 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400"
                >
                  移除
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}
