/** 数字文博护照 API 服务 — Passport 2.0 */
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

// ── Passport 2.0 新增 ──

export interface TimelineMilestone {
  type: string
  title: string
  description: string
  date: string | null
  icon: string
  module: string
}

export interface RegionProgress {
  region_code: string
  region_name: string
  unlocked_at: string | null
  item_count: number
}

export interface PassportExport {
  user_name: string
  total_stamps: number
  earned_count: number
  completion_percentage: number
  stamps: EarnedStamp[]
  timeline: TimelineMilestone[]
  regions: RegionProgress[]
  exported_at: string
}

export interface StampConfig {
  type: string
  module: string
  name: string
  description: string
  icon: string
  rarity: string
}

// ── 原有 API ──

export async function getPassportStatus(): Promise<PassportStatus> {
  const res = await api.get('/api/passport/status')
  return res.data
}

export async function listEarnedStamps(): Promise<EarnedStamp[]> {
  const res = await api.get('/api/passport/stamps')
  return res.data
}

// ── Passport 2.0 新增 API ──

export async function fetchTimeline(): Promise<TimelineMilestone[]> {
  const res = await api.get('/api/passport/timeline')
  return res.data
}

export async function fetchRegions(): Promise<RegionProgress[]> {
  const res = await api.get('/api/passport/regions')
  return res.data
}

export async function exportPassport(): Promise<PassportExport> {
  const res = await api.get('/api/passport/export')
  return res.data
}

export async function fetchStampConfig(): Promise<StampConfig[]> {
  const res = await api.get('/api/passport/config')
  return res.data.stamps
}

export async function trackRegionVisit(regionCode: string): Promise<{ region_code: string; is_new: boolean }> {
  const res = await api.post(`/api/passport/regions/track?region_code=${encodeURIComponent(regionCode)}`)
  const result = res.data
  // 新地域解锁 → 推送通知
  if (result.is_new) {
    const { pushNotification } = await import('../stores/notificationStore')
    pushNotification({
      type: 'stamp',
      title: `发现新地域：${result.region_code}`,
      description: '你首次探索了这个地区，护照已记录！',
      icon: 'map-pin',
      route: '/passport',
    })
  }
  return result
}
