/** 非遗修习之路 API */

import api from './api'

export interface SkillTreeProgress {
  tree_name: string
  label: string
  icon: string
  level: number
  current: number
  threshold: number
  percentage: number
}

export interface CultivationStatus {
  xp: number
  rank: string
  rank_index: number
  xp_to_next: number
  skill_trees: SkillTreeProgress[]
  streak_days: number
  longest_streak: number
  last_active_date: string | null
  streak_bonus_active: boolean
}

export interface DailyQuest {
  id: number
  quest_template_id: string
  title: string
  description: string
  module: string
  skill_tree: string
  xp_reward: number
  status: 'pending' | 'completed' | 'claimed'
  icon: string
  condition_type: string
  condition_threshold: number
  condition_progress: number
}

export interface WeeklyChallenge {
  week_label: string
  theme: string
  description: string
  tasks_completed: number
  tasks_total: number
  reward_stamp_name: string
  reward_stamp_icon: string
  expires_at: string
}

export interface QuestCompleteResponse {
  xp_gained: number
  total_xp: number
  new_rank: string | null
  new_rank_index: number | null
  stamp_earned: Record<string, unknown> | null
}

export interface StreakInfo {
  streak_days: number
  longest_streak: number
  last_active_date: string | null
  streak_bonus_active: boolean
}

export interface QuestCompletedItem {
  quest_id: number
  title: string
  xp_gained: number
  skill_tree: string
  icon: string
}

export interface QuestProgressUpdate {
  id: number
  condition_progress: number
  condition_threshold: number
  status: string
}

export interface QuestCheckResponse {
  quests_completed: QuestCompletedItem[]
  total_xp_gained: number
  new_rank: string | null
  quests_updated: QuestProgressUpdate[]
}

/** 获取修习状态 */
export async function getCultivationStatus(): Promise<CultivationStatus> {
  const { data } = await api.get('/api/cultivation/status')
  return data
}

/** 获取今日任务 */
export async function getDailyQuests(): Promise<DailyQuest[]> {
  const { data } = await api.get('/api/cultivation/quests')
  return data
}

/** 手动完成任务（仅不可追踪任务） */
export async function completeQuest(questId: number): Promise<QuestCompleteResponse> {
  const { data } = await api.post(`/api/cultivation/quests/${questId}/complete`)
  return data
}

/** 触发任务自动结算 */
export async function checkQuests(): Promise<QuestCheckResponse> {
  const { data } = await api.post('/api/cultivation/quests/check')
  return data
}

/** 获取每周挑战 */
export async function getWeeklyChallenge(): Promise<WeeklyChallenge> {
  const { data } = await api.get('/api/cultivation/weekly-challenge')
  return data
}

/** 获取连胜状态 */
export async function getStreak(): Promise<StreakInfo> {
  const { data } = await api.get('/api/cultivation/streak')
  return data
}
