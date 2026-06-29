/** 千人千面推荐引擎 API */

import api from './api'

export interface RecommendationItem {
  id: number
  item_type: 'heritage' | 'user_upload' | 'inheritor'
  title: string
  image_url: string
  category: string
  region: string | null
  reason: string
  score: number
  target_route: string
}

export interface RecommendationFeed {
  items: RecommendationItem[]
  page: number
  size: number
  profile_status: 'cold_start' | 'active'
}

export interface ModuleRecommendations {
  module: string
  items: RecommendationItem[]
}

/** 获取个性化推荐流 */
export async function getRecommendationFeed(
  page = 1,
  size = 8
): Promise<RecommendationFeed> {
  const { data } = await api.get('/api/recommendations/feed', {
    params: { page, size },
  })
  return data
}

/** 获取模块级推荐 */
export async function getModuleRecommendations(
  module: 'exhibition' | 'workshop' | 'knowledge-graph'
): Promise<ModuleRecommendations> {
  const { data } = await api.get('/api/recommendations/for-module', {
    params: { module },
  })
  return data
}

/** 更新用户兴趣画像 (fire-and-forget) */
export async function updateProfile(
  actionType: string,
  actionData: Record<string, unknown> = {}
): Promise<void> {
  api.post('/api/recommendations/update-profile', {
    action_type: actionType,
    action_data: actionData,
  }).catch(() => { /* fire-and-forget — 静默失败 */ })
}
