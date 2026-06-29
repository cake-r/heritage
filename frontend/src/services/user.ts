import api from './api'

export interface UserProfile {
  id: number
  username: string
  nickname: string
  avatar_url: string
  voice_speed: number
  theme: string
  created_at: string
}

export interface FavoriteItem {
  id: number
  item_type: string
  item_id: number
  title: string
  image_url: string
  category: string
  creator: string
  created_at: string | null
}

export interface UserStatistics {
  recognition_count: number
  generation_count: number
  chat_count: number
  favorite_count: number
  upload_count: number
  passport_stamp_count: number
  restoration_count: number
}

// === 个人资料 ===

export async function getProfile(): Promise<UserProfile> {
  const res = await api.get('/api/user/profile')
  return res.data
}

export async function updateProfile(data: { nickname?: string; avatar_url?: string }): Promise<UserProfile> {
  const res = await api.put('/api/user/profile', data)
  return res.data
}

// === 收藏 ===

export async function addFavorite(itemType: string, itemId: number) {
  const res = await api.post('/api/user/favorites', { item_type: itemType, item_id: itemId })
  return res.data
}

export async function listFavorites(): Promise<FavoriteItem[]> {
  const res = await api.get('/api/user/favorites')
  return res.data
}

export async function deleteFavorite(favoriteId: number) {
  const res = await api.delete(`/api/user/favorites/${favoriteId}`)
  return res.data
}

// === 统计 ===

export async function getStatistics(): Promise<UserStatistics> {
  const res = await api.get('/api/user/statistics')
  return res.data
}
