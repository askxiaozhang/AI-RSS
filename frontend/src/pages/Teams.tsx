import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Loader2, Users, AlertCircle, Crown, Shield, User as UserIcon, Eye } from 'lucide-react'
import AnimatedPage from '../components/AnimatedPage'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { teamsApi } from '../api/client'
import type { Team, TeamRole } from '../types'

export const ROLE_META: Record<TeamRole, { label: string; icon: typeof Shield; cls: string }> = {
  admin: {
    label: '管理员',
    icon: Shield,
    cls: 'bg-brand-50 text-brand-700 ring-brand-600/10 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-500/20',
  },
  member: {
    label: '普通成员',
    icon: UserIcon,
    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-500/20',
  },
  guest: {
    label: '游客',
    icon: Eye,
    cls: 'bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-500/20',
  },
}

export function RoleBadge({ role }: { role: TeamRole }) {
  const meta = ROLE_META[role]
  const Icon = meta.icon
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${meta.cls}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}

export default function Teams() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setError('')
    try {
      const { data } = await teamsApi.list()
      setTeams(data)
    } catch {
      setError('加载团队列表失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const { data } = await teamsApi.create({ name: name.trim(), description: desc.trim() || undefined })
      setName('')
      setDesc('')
      setShowAdd(false)
      navigate(`/teams/${data.id}`)
    } catch {
      setError('创建团队失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <AnimatedPage>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">团队</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            与他人协作管理订阅源，分享共享信息源
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          创建团队
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/80"
          >
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">团队名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：AI 研究小组"
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-700 dark:focus:ring-brand-900/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">描述（可选）</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="这个团队是做什么的？"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-700 dark:focus:ring-brand-900/30"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  创建
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  取消
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Users className="h-7 w-7 text-slate-400 dark:text-slate-600" />
          </div>
          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300">还没有加入任何团队</p>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-600">创建一个团队，邀请成员协作管理订阅源</p>
          </div>
        </div>
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team, i) => (
            <motion.button
              key={team.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/teams/${team.id}`)}
              className="group flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-5 text-left backdrop-blur transition-all hover:border-brand-300 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-800/80 dark:hover:border-brand-600"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 text-white shadow-sm">
                  <Users className="h-5 w-5" />
                </div>
                {team.role && <RoleBadge role={team.role} />}
              </div>
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 truncate text-base font-semibold text-slate-800 group-hover:text-brand-700 dark:text-slate-200 dark:group-hover:text-brand-400">
                  {team.name}
                  {team.role === 'admin' && team.owner_id && (
                    <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  )}
                </h3>
                {team.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-400 dark:text-slate-600">{team.description}</p>
                )}
              </div>
              <div className="flex gap-4 text-[11px] text-slate-400 dark:text-slate-600">
                <span>{team.member_count ?? 0} 名成员</span>
                <span>{team.feed_count ?? 0} 个共享源</span>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatedPage>
  )
}
