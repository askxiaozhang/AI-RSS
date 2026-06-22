import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Loader2, AlertCircle, Users, Rss, Link2, Trash2, Plus,
  Copy, Check, LogOut, X, ChevronDown,
} from 'lucide-react'
import AnimatedPage from '../components/AnimatedPage'
import { teamsApi, feedsApi } from '../api/client'
import type { Team, TeamMember, TeamFeed, TeamInvite, TeamRole, Feed, Subscription } from '../types'
import { RoleBadge, ROLE_META } from './Teams'

export default function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()

  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [feeds, setFeeds] = useState<TeamFeed[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const role: TeamRole | undefined = team?.role
  const isAdmin = role === 'admin'
  const canShare = role === 'admin' || role === 'member'

  useEffect(() => {
    if (teamId) load(teamId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  const load = async (id: string) => {
    setError('')
    try {
      const [t, m, f] = await Promise.all([
        teamsApi.get(id),
        teamsApi.listMembers(id),
        teamsApi.listFeeds(id),
      ])
      setTeam(t.data)
      setMembers(m.data)
      setFeeds(f.data)
      if (t.data.role === 'admin') {
        const inv = await teamsApi.listInvites(id)
        setInvites(inv.data)
      }
    } catch {
      setError('加载团队失败，你可能没有访问权限')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AnimatedPage>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      </AnimatedPage>
    )
  }

  if (error || !team || !teamId) {
    return (
      <AnimatedPage>
        <button onClick={() => navigate('/teams')} className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> 返回团队
        </button>
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error || '团队不存在'}
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage>
      <button onClick={() => navigate('/teams')} className="mb-5 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> 返回团队
      </button>

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 text-white shadow-md">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{team.name}</h1>
              {role && <RoleBadge role={role} />}
            </div>
            {team.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{team.description}</p>}
          </div>
        </div>
        <LeaveOrDelete teamId={teamId} isAdmin={isAdmin} onLeft={() => navigate('/teams')} onError={setError} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <MembersSection
          teamId={teamId}
          members={members}
          ownerId={team.owner_id}
          isAdmin={isAdmin}
          onChanged={() => load(teamId)}
        />
        <SharedFeedsSection
          teamId={teamId}
          feeds={feeds}
          canShare={canShare}
          isAdmin={isAdmin}
          onChanged={() => load(teamId)}
          onOpenFeed={(fid) => navigate(`/feeds/${fid}`)}
        />
      </div>

      {isAdmin && (
        <InvitesSection teamId={teamId} invites={invites} onChanged={() => load(teamId)} />
      )}
    </AnimatedPage>
  )
}

// ---------------------------------------------------------------------------
function LeaveOrDelete({ teamId, isAdmin, onLeft, onError }: {
  teamId: string; isAdmin: boolean; onLeft: () => void; onError: (s: string) => void
}) {
  const [busy, setBusy] = useState(false)

  const leave = async () => {
    if (!confirm('确定要退出该团队吗？')) return
    setBusy(true)
    try {
      await teamsApi.leave(teamId)
      onLeft()
    } catch {
      onError('退出失败')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('确定要解散该团队吗？此操作不可撤销（仅团队所有者可操作）。')) return
    setBusy(true)
    try {
      await teamsApi.remove(teamId)
      onLeft()
    } catch (e: any) {
      onError(e?.response?.status === 403 ? '只有团队所有者可以解散团队' : '解散失败')
      setBusy(false)
    }
  }

  return (
    <div className="flex shrink-0 gap-2">
      <button
        onClick={leave}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
      >
        <LogOut className="h-3.5 w-3.5" /> 退出
      </button>
      {isAdmin && (
        <button
          onClick={remove}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-3.5 w-3.5" /> 解散
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function MembersSection({ teamId, members, ownerId, isAdmin, onChanged }: {
  teamId: string; members: TeamMember[]; ownerId: string; isAdmin: boolean; onChanged: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const changeRole = async (userId: string, role: TeamRole) => {
    setBusyId(userId)
    try {
      await teamsApi.updateMemberRole(teamId, userId, role)
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  const kick = async (userId: string) => {
    if (!confirm('确定要将该成员移出团队吗？')) return
    setBusyId(userId)
    try {
      await teamsApi.removeMember(teamId, userId)
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
        <Users className="h-3.5 w-3.5" /> 成员 · {members.length}
      </h2>
      <div className="space-y-2">
        {members.map((m) => {
          const isOwner = m.user_id === ownerId
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5 dark:border-slate-700/70 dark:bg-slate-800/70">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                {m.email.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{m.email}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-600">{isOwner ? '所有者' : ''}</p>
              </div>
              {isAdmin && !isOwner ? (
                <div className="flex items-center gap-1">
                  <RoleSelect
                    value={m.role}
                    disabled={busyId === m.user_id}
                    onChange={(r) => changeRole(m.user_id, r)}
                  />
                  <button
                    onClick={() => kick(m.user_id)}
                    disabled={busyId === m.user_id}
                    title="移出团队"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <RoleBadge role={m.role} />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RoleSelect({ value, disabled, onChange }: {
  value: TeamRole; disabled: boolean; onChange: (r: TeamRole) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TeamRole)}
        className="appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-7 text-xs font-medium text-slate-600 outline-none focus:border-brand-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
      >
        {(Object.keys(ROLE_META) as TeamRole[]).map((r) => (
          <option key={r} value={r}>{ROLE_META[r].label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
  )
}

// ---------------------------------------------------------------------------
function SharedFeedsSection({ teamId, feeds, canShare, isAdmin, onChanged, onOpenFeed }: {
  teamId: string; feeds: TeamFeed[]; canShare: boolean; isAdmin: boolean
  onChanged: () => void; onOpenFeed: (feedId: string) => void
}) {
  const [picking, setPicking] = useState(false)
  const [available, setAvailable] = useState<{ feed: Feed; sub?: Subscription }[]>([])
  const [loadingPick, setLoadingPick] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const openPicker = async () => {
    setPicking(true)
    setLoadingPick(true)
    try {
      const [subsRes, feedsRes] = await Promise.all([feedsApi.listSubscriptions(), feedsApi.listFeeds()])
      const map: Record<string, Feed> = {}
      feedsRes.data.forEach((f) => { map[f.id] = f })
      const shared = new Set(feeds.map((f) => f.feed_id))
      const list = subsRes.data
        .filter((s) => map[s.feed_id] && !shared.has(s.feed_id))
        .map((s) => ({ feed: map[s.feed_id], sub: s }))
      setAvailable(list)
    } finally {
      setLoadingPick(false)
    }
  }

  const share = async (feedId: string) => {
    setBusyId(feedId)
    try {
      await teamsApi.shareFeed(teamId, feedId)
      setPicking(false)
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  const unshare = async (feedId: string) => {
    setBusyId(feedId)
    try {
      await teamsApi.unshareFeed(teamId, feedId)
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
          <Rss className="h-3.5 w-3.5" /> 共享订阅源 · {feeds.length}
        </h2>
        {canShare && (
          <button
            onClick={openPicker}
            className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
          >
            <Plus className="h-3 w-3" /> 分享我的订阅源
          </button>
        )}
      </div>

      <AnimatePresence>
        {picking && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 overflow-hidden rounded-xl border border-slate-200/70 bg-slate-50/60 dark:border-slate-700/70 dark:bg-slate-800/60"
          >
            <div className="p-3">
              {loadingPick ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-brand-500" /></div>
              ) : available.length === 0 ? (
                <p className="py-2 text-center text-xs text-slate-400">没有可分享的订阅源（都已分享或你还没有订阅）</p>
              ) : (
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {available.map(({ feed }) => (
                    <button
                      key={feed.id}
                      onClick={() => share(feed.id)}
                      disabled={busyId === feed.id}
                      className="flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left text-xs hover:bg-brand-50 disabled:opacity-50 dark:bg-slate-700/60 dark:hover:bg-slate-700"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-200">{feed.title}</span>
                      {busyId === feed.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {feeds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-600">
          还没有共享的订阅源
        </p>
      ) : (
        <div className="space-y-2">
          {feeds.map((f) => (
            <div key={f.id} className="group flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2.5 dark:border-slate-700/70 dark:bg-slate-800/70">
              <button onClick={() => onOpenFeed(f.feed_id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-slate-700 hover:text-brand-700 dark:text-slate-200 dark:hover:text-brand-400">{f.title || '未命名'}</p>
                <p className="truncate text-[11px] text-slate-400 dark:text-slate-600">{f.url}</p>
              </button>
              {isAdmin && (
                <button
                  onClick={() => unshare(f.feed_id)}
                  disabled={busyId === f.feed_id}
                  title="移除共享"
                  className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
function InvitesSection({ teamId, invites, onChanged }: {
  teamId: string; invites: TeamInvite[]; onChanged: () => void
}) {
  const [role, setRole] = useState<TeamRole>('member')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Prefer an explicit public base URL (set in .env.local for LAN/prod sharing),
  // otherwise fall back to whatever host the admin is currently browsing on.
  const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin
  const inviteUrl = (token: string) => `${baseUrl}/invite/${token}`

  const create = async () => {
    setCreating(true)
    try {
      await teamsApi.createInvite(teamId, { role })
      onChanged()
    } finally {
      setCreating(false)
    }
  }

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(inviteUrl(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const revoke = async (inviteId: string) => {
    await teamsApi.revokeInvite(teamId, inviteId)
    onChanged()
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200/70 bg-white/60 p-5 dark:border-slate-700/70 dark:bg-slate-800/60">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-600">
          <Link2 className="h-3.5 w-3.5" /> 邀请链接
        </h2>
        <div className="flex items-center gap-2">
          <RoleSelect value={role} disabled={creating} onChange={setRole} />
          <button
            onClick={create}
            disabled={creating}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            生成链接
          </button>
        </div>
      </div>

      {invites.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-600">还没有邀请链接。生成一个以邀请新成员加入。</p>
      ) : (
        <div className="space-y-2">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/40">
              <RoleBadge role={inv.role} />
              <code className="min-w-0 flex-1 truncate text-[11px] text-slate-500 dark:text-slate-400">{inviteUrl(inv.token)}</code>
              <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-600">已用 {inv.used_count}{inv.max_uses ? `/${inv.max_uses}` : ''}</span>
              <button
                onClick={() => copy(inv.token)}
                title="复制链接"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/30"
              >
                {copied === inv.token ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => revoke(inv.id)}
                title="吊销链接"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
