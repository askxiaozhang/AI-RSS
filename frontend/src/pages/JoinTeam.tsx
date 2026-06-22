import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, Users, AlertCircle, Check } from 'lucide-react'
import { teamsApi } from '../api/client'
import { useAuthStore } from '../store/authStore'
import type { TeamInvitePreview } from '../types'
import { RoleBadge } from './Teams'

export default function JoinTeam() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const authToken = useAuthStore((s) => s.token)

  const [preview, setPreview] = useState<TeamInvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    // Not logged in → bounce to login, remembering where to return.
    if (!authToken) {
      navigate(`/login?next=${encodeURIComponent(`/invite/${token}`)}`, { replace: true })
      return
    }
    if (token) loadPreview(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authToken])

  const loadPreview = async (t: string) => {
    try {
      const { data } = await teamsApi.previewInvite(t)
      setPreview(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || '邀请链接无效')
    } finally {
      setLoading(false)
    }
  }

  const join = async () => {
    if (!token) return
    setJoining(true)
    try {
      const { data } = await teamsApi.acceptInvite(token)
      navigate(`/teams/${data.id}`, { replace: true })
    } catch (e: any) {
      setError(e?.response?.data?.detail || '加入失败')
      setJoining(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-2xl border border-slate-200/70 bg-white p-8 text-center shadow-xl dark:border-slate-700/70 dark:bg-slate-900"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 text-white shadow-md">
          <Users className="h-7 w-7" />
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
        ) : error ? (
          <>
            <div className="mb-4 flex items-center justify-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
            <button onClick={() => navigate('/teams')} className="text-sm font-medium text-brand-600 hover:underline">
              返回我的团队
            </button>
          </>
        ) : preview ? (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">你被邀请加入团队</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{preview.team_name}</h1>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="text-xs text-slate-400">加入后角色：</span>
              <RoleBadge role={preview.role} />
            </div>

            {preview.valid ? (
              <button
                onClick={join}
                disabled={joining}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-700 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
              >
                {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                加入团队
              </button>
            ) : (
              <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {preview.reason || '邀请链接已失效'}
              </div>
            )}
            <button onClick={() => navigate('/teams')} className="mt-4 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              取消
            </button>
          </>
        ) : null}
      </motion.div>
    </div>
  )
}
