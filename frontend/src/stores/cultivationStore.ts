/** 非遗修习之路全局状态 — Zustand store (替代 CultivationContext) */

import { create } from 'zustand'
import {
  getCultivationStatus, getDailyQuests, getWeeklyChallenge, getStreak,
  completeQuest as apiCompleteQuest, checkQuests as apiCheckQuests,
  type CultivationStatus, type DailyQuest, type WeeklyChallenge,
  type StreakInfo, type QuestCompletedItem,
} from '../services/cultivation'

interface CultivationState {
  status: CultivationStatus | null
  quests: DailyQuest[]
  weeklyChallenge: WeeklyChallenge | null
  streak: StreakInfo | null
  xpAnimation: { show: boolean; amount: number; skillTree?: string } | null
  notifications: QuestCompletedItem[]
  rankUpCelebration: { oldRank: string; newRank: string; newRankIndex: number } | null
  loading: boolean
  lastCheckTime: number

  refreshStatus: () => Promise<void>
  refreshQuests: () => Promise<void>
  completeQuest: (questId: number) => Promise<{ xp_gained: number; new_rank: string | null }>
  checkForAutoCompletions: () => Promise<void>
  triggerXpAnimation: (amount: number, skillTree?: string) => void
  dismissNotification: (questId: number) => void
  dismissRankUp: () => void
}

export const useCultivationStore = create<CultivationState>()((set, get) => ({
  status: null,
  quests: [],
  weeklyChallenge: null,
  streak: null,
  xpAnimation: null,
  notifications: [],
  rankUpCelebration: null,
  loading: false,
  lastCheckTime: 0,

  refreshStatus: async () => {
    try {
      const s = await getCultivationStatus()
      set({ status: s })
    } catch { /* 静默降级 */ }
  },

  refreshQuests: async () => {
    try {
      const q = await getDailyQuests()
      const w = await getWeeklyChallenge()
      const s = await getStreak()
      set({ quests: q, weeklyChallenge: w, streak: s })
    } catch { /* 静默降级 */ }
  },

  completeQuest: async (questId: number) => {
    const result = await apiCompleteQuest(questId)
    const state = get()
    state.triggerXpAnimation(result.xp_gained)
    await state.refreshQuests()
    await state.refreshStatus()

    if (result.new_rank) {
      const oldRank = state.status?.rank || '初窥门径'
      set({
        rankUpCelebration: {
          oldRank,
          newRank: result.new_rank,
          newRankIndex: result.new_rank_index || 0,
        },
      })
    }
    return { xp_gained: result.xp_gained, new_rank: result.new_rank }
  },

  checkForAutoCompletions: async () => {
    // 防抖：3秒内不重复调用
    const now = Date.now()
    if (now - get().lastCheckTime < 3000) return
    set({ lastCheckTime: now })

    try {
      const result = await apiCheckQuests()

      if (result.quests_completed.length > 0) {
        const state = get()
        // 显示通知
        set({
          notifications: [...state.notifications, ...result.quests_completed].slice(-5),
        })

        // XP 动画
        state.triggerXpAnimation(result.total_xp_gained)

        // 自动移除通知
        for (const item of result.quests_completed) {
          setTimeout(() => {
            set((s) => ({
              notifications: s.notifications.filter((n) => n.quest_id !== item.quest_id),
            }))
          }, 5000)
        }

        // 检查晋升
        if (result.new_rank) {
          const oldRank = state.status?.rank || '初窥门径'
          set({
            rankUpCelebration: {
              oldRank,
              newRank: result.new_rank,
              newRankIndex: 0,
            },
          })
        }

        // 刷新状态
        await state.refreshQuests()
        await state.refreshStatus()
      }

      // 更新进度（即使未完成）
      if (result.quests_updated.length > 0) {
        set((s) => ({
          quests: s.quests.map((q) => {
            const update = result.quests_updated.find((u) => u.id === q.id)
            if (update) {
              return { ...q, condition_progress: update.condition_progress }
            }
            return q
          }),
        }))
      }
    } catch {
      // 静默失败
    }
  },

  triggerXpAnimation: (amount: number, skillTree?: string) => {
    set({ xpAnimation: { show: true, amount, skillTree } })
    setTimeout(() => set({ xpAnimation: null }), 2000)
  },

  dismissNotification: (questId: number) => {
    set((s) => ({
      notifications: s.notifications.filter((n) => n.quest_id !== questId),
    }))
  },

  dismissRankUp: () => {
    set({ rankUpCelebration: null })
  },
}))

/** @deprecated 使用 useCultivationStore 替代，保留别名以兼容现有导入 */
export const useCultivation = useCultivationStore
