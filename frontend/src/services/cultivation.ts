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

/** 完成任务 */
export async function completeQuest(questId: number): Promise<QuestCompleteResponse> {
  const { data } = await api.post(`/api/cultivation/quests/${questId}/complete`)
  return data
}

/** 获取每周挑战 */
export async function getWeeklyChallenge(): Promise<WeeklyChallenge> {
  const { data } = await api.get('/api/cultivation/weekly-challenge')
  return data
}
