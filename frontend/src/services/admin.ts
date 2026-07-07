/** Admin API 服务 */

import api from './api'

export interface UserItem {
  id: number
  username: string
  nickname?: string
  role: string
  is_banned: boolean
  created_at?: string
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

// === 用户管理 ===

export async function fetchUsers(params: {
  page?: number; page_size?: number; search?: string; role?: string; is_banned?: boolean
} = {}) {
  const { data } = await api.get<PaginatedResponse<UserItem>>('/api/admin/users', { params })
  return data
}

export async function fetchUserDetail(userId: number) {
  const { data } = await api.get(`/api/admin/users/${userId}`)
  return data
}

export async function updateUserRole(userId: number, role: string) {
  const { data } = await api.put(`/api/admin/users/${userId}/role`, { role })
  return data
}

export async function banUser(userId: number, reason?: string) {
  const { data } = await api.post(`/api/admin/users/${userId}/ban`, { reason })
  return data
}

export async function unbanUser(userId: number) {
  const { data } = await api.post(`/api/admin/users/${userId}/unban`)
  return data
}

// === 任务监控 ===

export async function fetchTaskQueueStatus() {
  const { data } = await api.get('/api/admin/tasks/status')
  return data
}

export async function fetchAllTasks(params: {
  page?: number; page_size?: number; status?: string; task_type?: string; user_id?: number
} = {}) {
  const { data } = await api.get('/api/admin/tasks', { params })
  return data
}

export async function adminRetryTask(taskId: string) {
  const { data } = await api.post(`/api/admin/tasks/${taskId}/retry`)
  return data
}

export async function adminCancelTask(taskId: string) {
  const { data } = await api.post(`/api/admin/tasks/${taskId}/cancel`)
  return data
}

// === AI 成本 ===

export async function fetchCostSummary(days: number = 30) {
  const { data } = await api.get('/api/admin/costs/summary', { params: { days } })
  return data
}

export async function fetchCostLogs(params: {
  page?: number; page_size?: number; user_id?: number; model?: string; status?: string
} = {}) {
  const { data } = await api.get('/api/admin/costs/logs', { params })
  return data
}

// === 系统配置 ===

export async function fetchConfig() {
  const { data } = await api.get('/api/admin/config')
  return data.config
}

export async function updateConfig(updates: Record<string, any>) {
  const { data } = await api.put('/api/admin/config', { updates })
  return data
}

// ── Admin Dashboard 2.0: 数据驾驶舱 ──

export interface DashboardOverview {
  total_users: number
  total_recognitions: number
  total_restorations: number
  total_generations: number
  total_chat_sessions: number
  total_stamps_earned: number
  active_users_today: number
  ai_cost_today: number
  ai_cost_month: number
  task_pending: number
  task_running: number
  knowledge_base_size: number
  pattern_genes_count: number
}

export interface DailyTrend {
  date: string
  active_users: number
  recognitions: number
  restorations: number
  generations: number
  cost: number
  new_users: number
}

export interface LeaderboardEntry {
  name: string
  value: number
}

export interface DashboardLeaderboard {
  top_categories: LeaderboardEntry[]
  top_regions: LeaderboardEntry[]
  top_eras: LeaderboardEntry[]
  top_users: LeaderboardEntry[]
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const { data } = await api.get('/api/admin/dashboard/overview')
  return data
}

export async function fetchDashboardTrends(days: number = 7): Promise<{ days: number; trends: DailyTrend[] }> {
  const { data } = await api.get('/api/admin/dashboard/trends', { params: { days } })
  return data
}

export async function fetchDashboardLeaderboard(limit: number = 10): Promise<DashboardLeaderboard> {
  const { data } = await api.get('/api/admin/dashboard/leaderboard', { params: { limit } })
  return data
}
