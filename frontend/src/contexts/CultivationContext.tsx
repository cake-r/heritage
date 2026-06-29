/** 修习之路全局状态 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import {
  getCultivationStatus, getDailyQuests, getWeeklyChallenge,
  completeQuest as apiCompleteQuest,
  type CultivationStatus, type DailyQuest, type WeeklyChallenge,
} from '../services/cultivation'

interface CultivationState {
  status: CultivationStatus | null
  quests: DailyQuest[]
  weeklyChallenge: WeeklyChallenge | null
  xpAnimation: { show: boolean; amount: number } | null
  loading: boolean
  refreshStatus: () => Promise<void>
  refreshQuests: () => Promise<void>
  completeQuest: (questId: number) => Promise<{ xp_gained: number; new_rank: string | null }>
  triggerXpAnimation: (amount: number) => void
}

const CultivationContext = createContext<CultivationState>({
  status: null,
  quests: [],
  weeklyChallenge: null,
  xpAnimation: null,
  loading: false,
  refreshStatus: async () => {},
  refreshQuests: async () => {},
  completeQuest: async () => ({ xp_gained: 0, new_rank: null }),
  triggerXpAnimation: () => {},
})

export function CultivationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [status, setStatus] = useState<CultivationStatus | null>(null)
  const [quests, setQuests] = useState<DailyQuest[]>([])
  const [weeklyChallenge, setWeeklyChallenge] = useState<WeeklyChallenge | null>(null)
  const [xpAnimation, setXpAnimation] = useState<{ show: boolean; amount: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const s = await getCultivationStatus()
      setStatus(s)
    } catch { /* 静默降级 */ }
  }, [isAuthenticated])

  const refreshQuests = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const q = await getDailyQuests()
      setQuests(q)
      const w = await getWeeklyChallenge()
      setWeeklyChallenge(w)
    } catch { /* 静默降级 */ }
  }, [isAuthenticated])

  const handleCompleteQuest = useCallback(async (questId: number) => {
    const result = await apiCompleteQuest(questId)
    triggerXpAnimation(result.xp_gained)
    await refreshQuests()
    await refreshStatus()
    return { xp_gained: result.xp_gained, new_rank: result.new_rank }
  }, [refreshQuests, refreshStatus])

  const triggerXpAnimation = useCallback((amount: number) => {
    setXpAnimation({ show: true, amount })
    setTimeout(() => setXpAnimation(null), 1800)
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true)
      Promise.all([refreshStatus(), refreshQuests()]).finally(() => setLoading(false))
    }
  }, [isAuthenticated, refreshStatus, refreshQuests])

  return (
    <CultivationContext.Provider value={{
      status, quests, weeklyChallenge, xpAnimation, loading,
      refreshStatus, refreshQuests,
      completeQuest: handleCompleteQuest, triggerXpAnimation,
    }}>
      {children}
    </CultivationContext.Provider>
  )
}

export function useCultivation() {
  return useContext(CultivationContext)
}
