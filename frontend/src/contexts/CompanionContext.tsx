/** AI 智能伴游全局状态 — v2 对话式 */

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  getCompanionSuggestions, getCompanionContext,
  chatWithCompanion, sendCompanionFeedback,
  type CompanionSuggestion, type CompanionContext, type ChatMessage,
} from '../services/companion'

export interface CompanionChatMsg {
  id: number
  role: 'user' | 'assistant'
  content: string
  suggestions?: CompanionSuggestion[]
  timestamp: number
}

interface CompanionState {
  suggestions: CompanionSuggestion[]
  chatMessages: CompanionChatMsg[]
  visible: boolean
  loading: boolean
  chatLoading: boolean
  hasHighConfidence: boolean
  context: CompanionContext | null
  openDrawer: () => void
  closeDrawer: () => void
  checkForSuggestions: (page: string, contextHint?: string) => Promise<void>
  sendMessage: (message: string, page: string) => Promise<void>
  clearChat: () => void
  recordClick: (suggestion: CompanionSuggestion, page: string) => void
  recordDismiss: (suggestionId: string, page: string) => void
  notifyAction: (page: string, action: string) => void
}

const CompanionCtx = createContext<CompanionState>({
  suggestions: [],
  chatMessages: [],
  visible: false,
  loading: false,
  chatLoading: false,
  hasHighConfidence: false,
  context: null,
  openDrawer: () => {},
  closeDrawer: () => {},
  checkForSuggestions: async () => {},
  sendMessage: async () => {},
  clearChat: () => {},
  recordClick: () => {},
  recordDismiss: () => {},
  notifyAction: () => {},
})

const CONFIDENCE_THRESHOLD = 0.6
const COOLDOWN_MS = 180_000

const lastCheckTime: Record<string, number> = {}

let _msgId = 0

export function CompanionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [suggestions, setSuggestions] = useState<CompanionSuggestion[]>([])
  const [chatMessages, setChatMessages] = useState<CompanionChatMsg[]>([])
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [context, setContext] = useState<CompanionContext | null>(null)

  const historyRef = useRef<ChatMessage[]>([])

  const hasHighConfidence = suggestions.some(s => s.confidence >= CONFIDENCE_THRESHOLD)

  const openDrawer = useCallback(() => setVisible(true), [])
  const closeDrawer = useCallback(() => setVisible(false), [])

  const checkForSuggestions = useCallback(async (page: string, contextHint?: string) => {
    if (!isAuthenticated) return

    const now = Date.now()
    if (lastCheckTime[page] && (now - lastCheckTime[page]) < COOLDOWN_MS) return
    lastCheckTime[page] = now

    setLoading(true)
    try {
      const [sugs, ctx] = await Promise.all([
        getCompanionSuggestions(page, contextHint),
        getCompanionContext().catch(() => null),
      ])
      setSuggestions(sugs.filter(s => s.confidence >= CONFIDENCE_THRESHOLD))
      setContext(ctx)
    } catch { /* 静默降级 */ }
    finally { setLoading(false) }
  }, [isAuthenticated])

  const sendMessage = useCallback(async (message: string, page: string) => {
    if (!message.trim()) return

    // 添加用户消息
    const userMsg: CompanionChatMsg = {
      id: ++_msgId,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }
    setChatMessages(prev => [...prev, userMsg])

    // 更新历史
    historyRef.current.push({ role: 'user', content: message })
    if (historyRef.current.length > 12) historyRef.current = historyRef.current.slice(-12)

    setChatLoading(true)
    try {
      const result = await chatWithCompanion(message, page, historyRef.current.slice(0, -1))

      const assistantMsg: CompanionChatMsg = {
        id: ++_msgId,
        role: 'assistant',
        content: result.reply,
        suggestions: result.suggestions,
        timestamp: Date.now(),
      }
      setChatMessages(prev => [...prev, assistantMsg])
      historyRef.current.push({ role: 'assistant', content: result.reply })

      // 同步建议到全局
      setSuggestions(result.suggestions.filter(s => s.confidence >= CONFIDENCE_THRESHOLD))
    } catch {
      const errMsg: CompanionChatMsg = {
        id: ++_msgId,
        role: 'assistant',
        content: '抱歉，我暂时无法回复。请稍后再试 ✨',
        timestamp: Date.now(),
      }
      setChatMessages(prev => [...prev, errMsg])
    } finally {
      setChatLoading(false)
    }
  }, [])

  const clearChat = useCallback(() => {
    setChatMessages([])
    historyRef.current = []
    setSuggestions([])
  }, [])

  const recordClick = useCallback((suggestion: CompanionSuggestion, page: string) => {
    sendCompanionFeedback(suggestion.id, 'clicked', page).catch(() => {})
  }, [])

  const recordDismiss = useCallback((suggestionId: string, page: string) => {
    sendCompanionFeedback(suggestionId, 'dismissed', page).catch(() => {})
  }, [])

  // 跨页面操作通知 — 高价值事件触发（冷却 45s）
  const notifyAction = useCallback((page: string, action: string) => {
    if (!isAuthenticated) return
    // 高价值事件：完成识别、完成生成、完成任务等，缩短冷却
    const now = Date.now()
    const key = page
    if (lastCheckTime[key] && (now - lastCheckTime[key]) < 45_000) return
    lastCheckTime[key] = now
    checkForSuggestions(page, action)
  }, [isAuthenticated, checkForSuggestions])

  return (
    <CompanionCtx.Provider value={{
      suggestions, chatMessages, visible, loading, chatLoading, hasHighConfidence, context,
      openDrawer, closeDrawer, checkForSuggestions, sendMessage, clearChat, recordClick, recordDismiss, notifyAction,
    }}>
      {children}
    </CompanionCtx.Provider>
  )
}

export function useCompanion() {
  return useContext(CompanionCtx)
}
