import axios from 'axios'
import type {
  Token,
  User,
  Feed,
  FeedItem,
  Subscription,
  ChatConversation,
  ChatMessage,
  AgentTestResult,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request when present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 → auto-logout
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)

/* ---------- Auth ---------- */
export const authApi = {
  register: (email: string, password: string, lang = 'zh') =>
    api.post<User>('/auth/register', { email, password, preferred_language: lang }),
  login: (email: string, password: string) =>
    api.post<Token>(
      '/auth/token',
      `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    ),
}

/* ---------- Feeds ---------- */
export const feedsApi = {
  listSubscriptions: () => api.get<Subscription[]>('/feeds/subscriptions'),
  create: (data: {
    title: string
    url: string
    feed_type?: string
    crawl_instructions?: string
    refresh_interval?: number
  }) => api.post<Feed>('/feeds/', data),
  subscribe: (data: {
    feed_id: string
    folder_name?: string
    ai_filter_rules?: string
    is_active?: boolean
  }) => api.post<Subscription>('/feeds/subscribe', data),
  updateSubscription: (id: string, data: Partial<Subscription>) =>
    api.put<Subscription>(`/feeds/subscriptions/${id}`, data),
}

/* ---------- Items ---------- */
export const itemsApi = {
  listUnread: (folder?: string) =>
    api.get<FeedItem[]>('/items/unread', { params: folder ? { folder_name: folder } : {} }),
  markRead: (id: string, read = true) =>
    api.post(`/items/${id}/read`, null, { params: { read } }),
  markStarred: (id: string, starred = true) =>
    api.post(`/items/${id}/star`, null, { params: { starred } }),
}

/* ---------- Agents (URL → RSS) ---------- */
export const agentsApi = {
  testCrawl: (url: string, instructions: string) =>
    api.post<AgentTestResult>('/agents/test-crawl', { url, instructions }),
}

/* ---------- Chat ---------- */
export const chatApi = {
  listConversations: () => api.get<ChatConversation[]>('/chat/conversations'),
  createConversation: (title: string) =>
    api.post<ChatConversation>('/chat/conversations', null, { params: { title } }),
  sendMessage: (convId: string, content: string) =>
    api.post<ChatMessage>(`/chat/conversations/${convId}/messages`, { content }),
}

export default api
