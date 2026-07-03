/** AI 智能伴游全局状态 — Zustand store (替代 CompanionContext)
 *
 * Phase 2 新增：expression / lipSync 状态，驱动 Live2D 模型表情联动
 * Phase 3 新增：dismissStreak 计数，触发 angry 表情
 */

import { create } from 'zustand'
import {
  getCompanionSuggestions, getCompanionContext,
  chatWithCompanion, sendCompanionFeedback,
  type CompanionSuggestion, type CompanionContext, type ChatMessage,
} from '../services/companion'

export type Live2DExpression = 'idle' | 'star' | 'sing' | 'angry' | 'dizzy'

export interface CompanionChatMsg {
  id: number
  role: 'user' | 'assistant'
  content: string
  suggestions?: CompanionSuggestion[]
  timestamp: number
}

const CONFIDENCE_THRESHOLD = 0.6
const STAR_CONFIDENCE_THRESHOLD = 0.85  // 星星眼需要更高置信度
const COOLDOWN_MS = 180_000
const lastCheckTime: Record<string, number> = {}
let _msgId = 0

function _calcHighConfidence(suggestions: CompanionSuggestion[]): boolean {
  return suggestions.some((s) => s.confidence >= CONFIDENCE_THRESHOLD)
}

function _calcStarConfidence(suggestions: CompanionSuggestion[]): boolean {
  return suggestions.some((s) => s.confidence >= STAR_CONFIDENCE_THRESHOLD)
}

interface CompanionState {
  suggestions: CompanionSuggestion[]
  chatMessages: CompanionChatMsg[]
  visible: boolean
  loading: boolean
  chatLoading: boolean
  hasHighConfidence: boolean
  context: CompanionContext | null

  // Phase 2: Live2D 表情联动
  expression: Live2DExpression
  lipSync: number
  // Phase 3: 累计 dismiss 计数（触发 angry）
  dismissStreak: number

  openDrawer: () => void
  closeDrawer: () => void
  checkForSuggestions: (page: string, contextHint?: string) => Promise<void>
  sendMessage: (message: string, page: string) => Promise<void>
  clearChat: () => void
  recordClick: (suggestion: CompanionSuggestion, page: string) => void
  recordDismiss: (suggestionId: string, page: string) => void
  notifyAction: (page: string, action: string) => void
  // Phase 2: 手动控制表情
  setExpression: (expr: Live2DExpression) => void
  setLipSync: (value: number) => void
}

export const useCompanionStore = create<CompanionState>()((set, get) => ({
  suggestions: [],
  chatMessages: [],
  visible: false,
  loading: false,
  chatLoading: false,
  hasHighConfidence: false,
  context: null,

  // Phase 2 初始状态
  expression: 'idle',
  lipSync: 0,
  // Phase 3
  dismissStreak: 0,

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
      const hasStar = _calcStarConfidence(filtered)

      set({
        suggestions: filtered,
        hasHighConfidence: _calcHighConfidence(filtered),
        context: ctx,
        loading: false,
        // 高置信度建议 → 星星眼短暂闪烁
        ...(hasStar ? { expression: 'star' as Live2DExpression } : {}),
      })

      // 星星眼 3 秒后恢复 idle
      if (hasStar) {
        setTimeout(() => {
          const cur = get()
          if (cur.expression === 'star') {
            set({ expression: 'idle' })
          }
        }, 3000)
      }
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

    // Phase 2: 发送消息 → 思考中 (dizzy)
    set((s) => ({
      chatMessages: [...s.chatMessages, userMsg],
      chatLoading: true,
      expression: 'dizzy',
      lipSync: 0,
    }))

    // 模拟口型波动（等待 API 响应期间的微妙动画）
    const lipSyncInterval = setInterval(() => {
      const cur = get()
      if (cur.chatLoading && cur.expression === 'dizzy') {
        set({ lipSync: 0.05 + Math.random() * 0.08 })
      }
    }, 300)

    try {
      const result = await chatWithCompanion(message, page, history.slice(0, -1))

      clearInterval(lipSyncInterval)

      const assistantMsg: CompanionChatMsg = {
        id: ++_msgId,
        role: 'assistant',
        content: result.reply,
        suggestions: result.suggestions,
        timestamp: Date.now(),
      }
      const filtered = result.suggestions.filter((s) => s.confidence >= CONFIDENCE_THRESHOLD)

      // Phase 2: 收到回复 → 说话中 (sing) + lipSync
      set((s) => ({
        chatMessages: [...s.chatMessages, assistantMsg],
        suggestions: filtered,
        hasHighConfidence: _calcHighConfidence(filtered),
        chatLoading: false,
        expression: 'sing',
        lipSync: 0.3,  // 初始口型
      }))

      // 口型波动（模拟说话）
      const talkLipSyncInterval = setInterval(() => {
        const cur = get()
        if (cur.expression === 'sing') {
          set({ lipSync: 0.2 + Math.random() * 0.6 })
        }
      }, 120)

      // 2.5 秒后恢复 idle（模拟说完）
      setTimeout(() => {
        clearInterval(talkLipSyncInterval)
        const cur = get()
        if (cur.expression === 'sing') {
          set({ expression: 'idle', lipSync: 0 })
        }
      }, 2500)

    } catch {
      clearInterval(lipSyncInterval)
      const errMsg: CompanionChatMsg = {
        id: ++_msgId,
        role: 'assistant',
        content: '抱歉，我暂时无法回复。请稍后再试 ✨',
        timestamp: Date.now(),
      }
      set((s) => ({
        chatMessages: [...s.chatMessages, errMsg],
        chatLoading: false,
        expression: 'idle',
        lipSync: 0,
      }))
    }
  },

  clearChat: () => {
    set({
      chatMessages: [],
      suggestions: [],
      hasHighConfidence: false,
      expression: 'idle',
      lipSync: 0,
      dismissStreak: 0,
    })
  },

  recordClick: (suggestion: CompanionSuggestion, page: string) => {
    sendCompanionFeedback(suggestion.id, 'clicked', page).catch(() => {})
    // 点击建议 → 重置 dismiss 计数
    set({ dismissStreak: 0 })
  },

  recordDismiss: (suggestionId: string, page: string) => {
    sendCompanionFeedback(suggestionId, 'dismissed', page).catch(() => {})
    // Phase 3: 累计 dismiss → 3 次触发 angry
    const newStreak = get().dismissStreak + 1
    if (newStreak >= 3) {
      set({ dismissStreak: newStreak, expression: 'angry' })
      // 2 秒后恢复
      setTimeout(() => {
        const cur = get()
        if (cur.expression === 'angry') {
          set({ expression: 'idle' })
        }
      }, 2000)
    } else {
      set({ dismissStreak: newStreak })
    }
  },

  notifyAction: (page: string, action: string) => {
    const now = Date.now()
    const key = page
    if (lastCheckTime[key] && (now - lastCheckTime[key]) < 45_000) return
    lastCheckTime[key] = now
    get().checkForSuggestions(page, action)
  },

  // Phase 2: 手动控制
  setExpression: (expr: Live2DExpression) => set({ expression: expr }),
  setLipSync: (value: number) => set({ lipSync: value }),
}))

/** @deprecated 使用 useCompanionStore 替代，保留别名以兼容现有导入 */
export const useCompanion = useCompanionStore
