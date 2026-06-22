import { useEffect, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Plus,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
} from 'lucide-react'
import AnimatedPage from '../components/AnimatedPage'
import { chatApi } from '../api/client'
import type { ChatConversation, ChatMessage } from '../types'

export default function Chat() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConv, setActiveConv] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    if (activeConv) {
      loadMessages()
    }
  }, [activeConv])

  const loadConversations = async () => {
    try {
      const { data } = await chatApi.listConversations()
      setConversations(data)
      if (data.length > 0) setActiveConv(data[0])
    } catch (err) {
      console.error(err)
    }
  }

  const loadMessages = async () => {
    if (!activeConv) return
    setLoading(true)
    try {
      // We'd need a GET messages endpoint, but for now just show an empty state
      setMessages([])
    } finally {
      setLoading(false)
    }
  }

  const handleNewConversation = async () => {
    const title = `对话 ${conversations.length + 1}`
    try {
      const { data } = await chatApi.createConversation(title)
      setConversations([data, ...conversations])
      setActiveConv(data)
      setMessages([])
    } catch (err) {
      console.error(err)
    }
  }

  const handleSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !activeConv || sending) return
    const content = input.trim()
    setInput('')

    // Optimistic UI
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConv.id,
      sender: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    try {
      const { data } = await chatApi.sendMessage(activeConv.id, content)
      setMessages((prev) => [...prev, data])
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        conversation_id: activeConv.id,
        sender: 'assistant',
        content: '抱歉，AI 暂时无法回复，请稍后再试。',
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatedPage className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            对话助手
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            基于你的订阅内容提问，AI 为你找到答案
          </p>
        </div>
        <button
          onClick={handleNewConversation}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-md"
        >
          <Plus className="h-4 w-4" />
          新对话
        </button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Conversation list */}
        <div className="hidden w-64 shrink-0 overflow-y-auto rounded-2xl border border-slate-200/70 bg-white/80 p-3 backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/80 md:block">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-600">
              还没有对话
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeConv?.id === conv.id
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-700/70 dark:bg-slate-800/80">
          {!activeConv ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-purple-100">
                  <Sparkles className="h-7 w-7 text-brand-600" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">开始一段新对话</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  点击「新对话」向 AI 提问关于你的订阅内容
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {messages.length === 0 && !loading && (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <Bot className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                      <p className="text-sm text-slate-500">
                        试着问：「上周 AI 领域有什么重大发布？」
                      </p>
                    </div>
                  </div>
                )}
                <AnimatePresence>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${
                        msg.sender === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          msg.sender === 'user'
                            ? 'bg-brand-100 text-brand-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {msg.sender === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.sender === 'user'
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {sending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-700">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400 dark:text-slate-500" />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                className="border-t border-slate-100 p-4 dark:border-slate-700"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="问 AI 关于你的订阅内容…"
                    disabled={sending}
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm outline-none transition-all focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-500 dark:focus:bg-slate-700 dark:focus:ring-brand-900/30"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </AnimatedPage>
  )
}
