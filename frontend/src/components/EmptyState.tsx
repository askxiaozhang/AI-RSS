import { motion } from 'framer-motion'
import { Wand2 } from 'lucide-react'

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 px-8 py-16 text-center dark:border-slate-700 dark:bg-slate-800/60"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-purple-100">
        <Wand2 className="h-7 w-7 text-brand-600" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}
