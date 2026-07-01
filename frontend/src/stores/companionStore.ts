/** AI 智能伴游全局状态 — Zustand store (替代 CompanionContext) */

import { create } from 'zustand'
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

const CONFIDENCE_THRESHOLD = 0.6
const COOLDOWN_MS = 180_000
const lastCheckTime: Record<string, number> = {}
let _msgId = 0

function _calcHighConfidence(suggestions: CompanionSuggestion[]): boolean {
  return suggestions.some((s) => s.confidence >= CONFIDENCE_THRESHOLD)
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

export const useCompanionStore = create<CompanionState>()((set, get) => ({
  suggestions: [],
  chatMessages: [],
  visible: false,
  loading: false,
  chatLoading: false,
  hasHighConfidence: false,
  context: null,

  openDrawer: () => set({ visible: true }),
  closeDrawer: () => set({ visible: false }),

  checkForSuggestions: async (page: string, contextHint?: string) => {
    const now = Date.now()
    if (lastCheckTime[page] && (now - lastCheckTime[page]) < COOLDOWN_MS) return
    lastCheckTime[page] = now

    set({ loading: true })
    try {
      const [sugs, ctx] = await Promise.all([
        getCompanionSuggestions(page, contextHint),
        getCompanionContext().catch(() => null),
      ])
      const filtered = sugs.filter((s) => s.confidence >= CONFIDENCE_THRESHOLD)
      set({
        suggestions: filtered,
        hasHighConfidence: _calcHighConfidence(filtered),
        context: ctx,
        loading: false,
      })
    } catch { set({ loading: false }) }
  },

  sendMessage: async (message: string, page: string) => {
    if (!message.trim()) return

    const userMsg: CompanionChatMsg = {
      id: ++_msgId,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }

    const history: ChatMessage[] = get().chatMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-11)
      .map((m) => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: message })

    set((s) => ({ chatMessages: [...s.chatMessages, userMsg], chatLoading: true }))

    try {
      const result = await chatWithCompanion(message, page, history.slice(0, -1))

      const assistantMsg: CompanionChatMsg = {
        id: ++_msgId,
        role: 'assistant',
        content: result.reply,
        suggestions: result.suggestions,
        timestamp: Date.now(),
      }
      const filtered = result.suggestions.filter((s) => s.confidence >= CONFIDENCE_THRESHOLD)
      set((s) => ({
        chatMessages: [...s.chatMessages, assistantMsg],
        suggestions: filtered,
        hasHighConfidence: _calcHighConfidence(filtered),
        chatLoading: false,
      }))
    } catch {
      const errMsg: CompanionChatMsg = {
        id: ++_msgId,
        role: 'assistant',
        content: '抱歉，我暂时无法回复。请稍后再试 ✨',
        timestamp: Date.now(),
      }
      set((s) => ({ chatMessages: [...s.chatMessages, errMsg], chatLoading: false }))
    }
  },

  clearChat: () => {
    set({ chatMessages: [], suggestions: [], hasHighConfidence: false })
  },

  recordClick: (suggestion: CompanionSuggestion, page: string) => {
    sendCompanionFeedback(suggestion.id, 'clicked', page).catch(() => {})
  },

  recordDismiss: (suggestionId: string, page: string) => {
    sendCompanionFeedback(suggestionId, 'dismissed', page).catch(() => {})
  },

  notifyAction: (page: string, action: string) => {
    const now = Date.now()
    const key = page
    if (lastCheckTime[key] && (now - lastCheckTime[key]) < 45_000) return
    lastCheckTime[key] = now
    get().checkForSuggestions(page, action)
  },
}))

/** @deprecated 使用 useCompanionStore 替代，保留别名以兼容现有导入 */
export const useCompanion = useCompanionStore
