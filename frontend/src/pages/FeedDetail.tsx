import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import AnimatedPage from '../components/AnimatedPage'
import ItemCard from '../components/ItemCard'
import LoadingSkeleton from '../components/LoadingSkeleton'
import EmptyState from '../components/EmptyState'
import { itemsApi } from '../api/client'
import type { FeedItem } from '../types'

export default function FeedDetail() {
  const { feedId } = useParams()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      try {
        const { data } = await itemsApi.listUnread()
        setItems(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [feedId])

  const handleRead = async (id: string) => {
    await itemsApi.markRead(id, true)
    setReadIds((prev) => new Set(prev).add(id))
  }

  const handleStar = async (id: string, starred: boolean) => {
    await itemsApi.markStarred(id, starred)
    setStarredIds((prev) => {
      const next = new Set(prev)
      if (starred) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <AnimatedPage>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">订阅内容</h1>
        <p className="mt-1 text-sm text-slate-500">
          {items.length} 篇未读文章
        </p>
      </div>

      {loading ? (
        <LoadingSkeleton count={5} />
      ) : items.length === 0 ? (
        <EmptyState
          title="暂无未读内容"
          description="所有文章都已读完，稍后再来看看吧"
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              read={readIds.has(item.id)}
              starred={starredIds.has(item.id)}
              onRead={handleRead}
              onStar={handleStar}
            />
          ))}
        </div>
      )}
    </AnimatedPage>
  )
}
