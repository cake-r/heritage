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
