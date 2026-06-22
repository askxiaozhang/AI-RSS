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
  SummarizeResult,
  Team,
  TeamMember,
  TeamFeed,
  TeamInvite,
  TeamInvitePreview,
  TeamRole,
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
  // 后门登录 - 开发/测试用
  backdoor: () => api.post<Token>('/auth/backdoor'),
}

/* ---------- Feeds ---------- */
export const feedsApi = {
  listSubscriptions: () => api.get<Subscription[]>('/feeds/subscriptions'),
  listFeeds: () => api.get<Feed[]>('/feeds/'),
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
  updateFeed: (id: string, data: { refresh_interval?: number; title?: string }) =>
    api.patch<Feed>(`/feeds/${id}`, data),
  updateSubscription: (id: string, data: Partial<Subscription>) =>
    api.put<Subscription>(`/feeds/subscriptions/${id}`, data),
}

/* ---------- Items ---------- */
export const itemsApi = {
  listAll: (params?: { days?: number; feed_id?: string }) =>
    api.get<FeedItem[]>('/items/', { params }),
  listUnread: (folder?: string) =>
    api.get<FeedItem[]>('/items/unread', { params: folder ? { folder_name: folder } : {} }),
  markRead: (id: string, read = true) =>
    api.post(`/items/${id}/read`, null, { params: { read } }),
  markStarred: (id: string, starred = true) =>
    api.post(`/items/${id}/star`, null, { params: { starred } }),
  summarize: (id: string, customPrompt?: string) =>
    api.post<SummarizeResult>(`/items/${id}/summarize`, { custom_prompt: customPrompt || null }),
}

export interface BrowserRenderResult {
  title: string
  screenshot: string   // base64 JPEG
  width: number
  height: number
  current_url: string
}

export interface BrowserClickResult {
  selector: string
  match_count: number
  highlights: { x: number; y: number; width: number; height: number }[]
  sample_text: string
  tag: string
}

/* ---------- Agents (URL → RSS) ---------- */
export const agentsApi = {
  testCrawl: (url: string, instructions: string) =>
    api.post<AgentTestResult>('/agents/test-crawl', { url, instructions }),
  fetchPreview: (url: string) =>
    api.post<{ title: string; html: string; requires_js: boolean }>('/agents/fetch-preview', { url }),
  previewSelector: (url: string, selector: string) =>
    api.post<{ count: number; items: { title: string; link: string; description: string }[] }>(
      '/agents/preview-selector',
      { url, selector },
    ),
  // Browser-based (Playwright) — works for JS SPAs
  browserRender: (url: string, sessionId: string) =>
    api.post<BrowserRenderResult>('/agents/browser/render', { url, session_id: sessionId }),
  browserClick: (sessionId: string, x: number, y: number) =>
    api.post<BrowserClickResult>('/agents/browser/click', { session_id: sessionId, x, y }),
  browserNavigate: (sessionId: string, url: string) =>
    api.post<BrowserRenderResult>('/agents/browser/navigate', { session_id: sessionId, url }),
  browserScroll: (sessionId: string, deltaY: number) =>
    api.post<BrowserRenderResult>('/agents/browser/scroll', { session_id: sessionId, delta_y: deltaY }),
  browserPreviewSelector: (sessionId: string, selector: string) =>
    api.post<{ count: number; items: { title: string; link: string; description: string }[] }>(
      '/agents/browser/preview-selector',
      { session_id: sessionId, selector },
    ),
}

/* ---------- Chat ---------- */
export const chatApi = {
  listConversations: () => api.get<ChatConversation[]>('/chat/conversations'),
  createConversation: (title: string) =>
    api.post<ChatConversation>('/chat/conversations', null, { params: { title } }),
  sendMessage: (convId: string, content: string) =>
    api.post<ChatMessage>(`/chat/conversations/${convId}/messages`, { content }),
}

/* ---------- Teams ---------- */
export const teamsApi = {
  list: () => api.get<Team[]>('/teams/'),
  create: (data: { name: string; description?: string }) => api.post<Team>('/teams/', data),
  get: (id: string) => api.get<Team>(`/teams/${id}`),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch<Team>(`/teams/${id}`, data),
  remove: (id: string) => api.delete(`/teams/${id}`),

  // members
  listMembers: (id: string) => api.get<TeamMember[]>(`/teams/${id}/members`),
  updateMemberRole: (id: string, userId: string, role: TeamRole) =>
    api.patch<TeamMember>(`/teams/${id}/members/${userId}`, { role }),
  removeMember: (id: string, userId: string) => api.delete(`/teams/${id}/members/${userId}`),
  leave: (id: string) => api.delete(`/teams/${id}/leave`),

  // shared feeds
  listFeeds: (id: string) => api.get<TeamFeed[]>(`/teams/${id}/feeds`),
  shareFeed: (id: string, feedId: string) =>
    api.post<TeamFeed>(`/teams/${id}/feeds`, { feed_id: feedId }),
  unshareFeed: (id: string, feedId: string) => api.delete(`/teams/${id}/feeds/${feedId}`),

  // invites
  listInvites: (id: string) => api.get<TeamInvite[]>(`/teams/${id}/invites`),
  createInvite: (
    id: string,
    data: { role?: TeamRole; expires_in_hours?: number | null; max_uses?: number | null },
  ) => api.post<TeamInvite>(`/teams/${id}/invites`, data),
  revokeInvite: (id: string, inviteId: string) => api.delete(`/teams/${id}/invites/${inviteId}`),
  previewInvite: (token: string) => api.get<TeamInvitePreview>(`/teams/invites/${token}`),
  acceptInvite: (token: string) => api.post<Team>(`/teams/invites/${token}/accept`),
}

export default api
