/** AI 智能伴游全局状态 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  getCompanionSuggestions, getCompanionContext,
  type CompanionSuggestion, type CompanionContext,
} from '../services/companion'

interface CompanionState {
  suggestions: CompanionSuggestion[]
  visible: boolean
  loading: boolean
  hasHighConfidence: boolean
  context: CompanionContext | null
  openDrawer: () => void
  closeDrawer: () => void
  checkForSuggestions: (page: string, contextHint?: string) => Promise<void>
}

const CompanionCtx = createContext<CompanionState>({
  suggestions: [],
  visible: false,
  loading: false,
  hasHighConfidence: false,
  context: null,
  openDrawer: () => {},
  closeDrawer: () => {},
  checkForSuggestions: async () => {},
})

const CONFIDENCE_THRESHOLD = 0.6
const COOLDOWN_MS = 180_000 // 3 minutes per page

// Cooldown tracker (per page)
const lastCheckTime: Record<string, number> = {}

export function CompanionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [suggestions, setSuggestions] = useState<CompanionSuggestion[]>([])
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [context, setContext] = useState<CompanionContext | null>(null)

  const hasHighConfidence = suggestions.some(s => s.confidence >= CONFIDENCE_THRESHOLD)

  const openDrawer = useCallback(() => setVisible(true), [])
  const closeDrawer = useCallback(() => setVisible(false), [])

  const checkForSuggestions = useCallback(async (page: string, contextHint?: string) => {
    if (!isAuthenticated) return

    // Client-side cooldown per page
    const now = Date.now()
    if (lastCheckTime[page] && (now - lastCheckTime[page]) < COOLDOWN_MS) {
      return
    }
    lastCheckTime[page] = now

    setLoading(true)
    try {
      const [sugs, ctx] = await Promise.all([
        getCompanionSuggestions(page, contextHint),
        getCompanionContext().catch(() => null),
      ])
      setSuggestions(sugs.filter(s => s.confidence >= CONFIDENCE_THRESHOLD))
      setContext(ctx)
    } catch {
      // 静默降级
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  return (
    <CompanionCtx.Provider value={{
      suggestions, visible, loading, hasHighConfidence, context,
      openDrawer, closeDrawer, checkForSuggestions,
    }}>
      {children}
    </CompanionCtx.Provider>
  )
}

export function useCompanion() {
  return useContext(CompanionCtx)
}
