export interface User {
  id: string
  email: string
  preferred_language: string
  created_at: string
}

export interface Token {
  access_token: string
  token_type: string
}

export interface Feed {
  id: string
  title: string
  url: string
  feed_type: 'standard' | 'agent_crawled'
  crawl_instructions?: string
  refresh_interval: number
  last_fetched_at?: string
  created_at: string
}

export interface FeedItem {
  id: string
  feed_id: string
  title: string
  link: string
  raw_content?: string
  author?: string
  published_at?: string
  created_at: string
  ai_tldr?: string
  ai_summary?: string
  ai_translation?: string
  read_status?: boolean
  starred_status?: boolean
}

export interface Subscription {
  id: string
  user_id: string
  feed_id: string
  folder_name: string
  ai_filter_rules?: string
  is_active: boolean
  created_at: string
}

export interface ChatConversation {
  id: string
  user_id: string
  title: string
  created_at: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface AgentTestResult {
  items_count: number
  items: Array<Record<string, any>>
}

export interface SummarizeResult {
  tldr: string
  highlights: string[]
  summary: string
}
