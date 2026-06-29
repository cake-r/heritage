/** 数字文博护照 API 服务 */
import api from './api'

export interface EarnedStamp {
  type: string
  module: string
  name: string
  description: string
  icon: string
  rarity: 'common' | 'rare' | 'epic'
  earned_at: string
  progress: number
}

export interface PassportStatus {
  total_stamps: number
  earned_count: number
  common_count: number
  rare_count: number
  epic_count: number
  completion_percentage: number
  last_earned: EarnedStamp[]
}

export async function getPassportStatus(): Promise<PassportStatus> {
  const res = await api.get('/api/passport/status')
  return res.data
}

export async function listEarnedStamps(): Promise<EarnedStamp[]> {
  const res = await api.get('/api/passport/stamps')
  return res.data
}
