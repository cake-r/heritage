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

// ================================================================
// 推荐流内存缓存 — 避免每次切换页面重新加载
// ================================================================
const FEED_CACHE_TTL = 5 * 60 * 1000 // 5 分钟

interface CacheEntry {
  data: RecommendationFeed
  timestamp: number
  userId: number
  page: number
  size: number
}

let _feedCache: CacheEntry | null = null

function _getUserId(): number {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.id || 0
  } catch {
    return 0
  }
}

/** 同步获取缓存的推荐数据（用于 React state 初始化，零等待） */
export function getCachedFeed(): RecommendationFeed | null {
  if (!_feedCache) return null
  const uid = _getUserId()
  if (_feedCache.userId !== uid) return null
  return _feedCache.data
}

/** 获取个性化推荐流（带内存缓存，5 分钟 TTL，支持 stale-while-revalidate） */
export async function getRecommendationFeed(
  page = 1,
  size = 8,
  options?: { forceRefresh?: boolean; onBackgroundRefresh?: (data: RecommendationFeed) => void }
): Promise<RecommendationFeed> {
  const uid = _getUserId()

  // 命中新鲜缓存 → 直接返回，零等待
  if (
    !options?.forceRefresh &&
    _feedCache &&
    _feedCache.userId === uid &&
    _feedCache.page === page &&
    _feedCache.size === size &&
    Date.now() - _feedCache.timestamp < FEED_CACHE_TTL
  ) {
    return _feedCache.data
  }

  // 有过期缓存且未强制刷新 → 返回过期数据 + 后台静默更新 (stale-while-revalidate)
  if (
    !options?.forceRefresh &&
    _feedCache &&
    _feedCache.userId === uid &&
    _feedCache.page === page &&
    _feedCache.size === size
  ) {
    // 后台静默拉取最新数据
    api.get('/api/recommendations/feed', { params: { page, size } })
      .then(({ data }) => {
        _feedCache = { data, timestamp: Date.now(), userId: uid, page, size }
        options?.onBackgroundRefresh?.(data)
      })
      .catch(() => { /* 后台刷新失败，保持旧缓存 */ })
    return _feedCache.data
  }

  // 无缓存或强制刷新 → 正常请求
  const { data } = await api.get('/api/recommendations/feed', {
    params: { page, size },
  })

  _feedCache = { data, timestamp: Date.now(), userId: uid, page, size }
  return data
}

/** 清除推荐缓存（用户执行可能影响推荐的操作后调用） */
export function invalidateRecommendationCache(): void {
  _feedCache = null
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
