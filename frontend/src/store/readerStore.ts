import { create } from 'zustand'
import type { FeedItem } from '../types'

type TimeFilter = 'all' | '24h' | '3d' | '1w' | '1m'
type StatusFilter = 'all' | 'unread' | 'starred'

interface ReaderState {
  // 数据
  items: FeedItem[]
  loading: boolean

  // 筛选条件
  timeFilter: TimeFilter
  statusFilter: StatusFilter
  selectedFeedId: string | null
  selectedTags: string[]
  searchQuery: string

  // 展开状态
  expandedItemId: string | null

  // Actions
  setItems: (items: FeedItem[]) => void
  setLoading: (loading: boolean) => void
  setTimeFilter: (filter: TimeFilter) => void
  setStatusFilter: (filter: StatusFilter) => void
  setSelectedFeedId: (feedId: string | null) => void
  setSelectedTags: (tags: string[]) => void
  setSearchQuery: (query: string) => void
  setExpandedItemId: (itemId: string | null) => void
  toggleTag: (tag: string) => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  // 初始状态
  items: [],
  loading: true,
  timeFilter: 'all',
  statusFilter: 'unread',
  selectedFeedId: null,
  selectedTags: [],
  searchQuery: '',
  expandedItemId: null,

  // Actions
  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),
  setTimeFilter: (timeFilter) => set({ timeFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSelectedFeedId: (selectedFeedId) => set({ selectedFeedId }),
  setSelectedTags: (selectedTags) => set({ selectedTags }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setExpandedItemId: (expandedItemId) => set({ expandedItemId }),
  toggleTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((t) => t !== tag)
        : [...state.selectedTags, tag],
    })),
}))
