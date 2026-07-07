/** Prompt 管理 API 客户端 — Phase C Step 8 */

import api from './api'

// ── 类型定义 ──

export interface PromptItem {
  id: number
  module: string
  version: number
  content: string
  is_active: boolean
  description: string
  created_at?: string
  updated_at?: string
}

export interface PromptModule {
  module: string
  prompts: PromptItem[]
  active_id: number | null
}

export interface PromptListResponse {
  modules: PromptModule[]
}

export interface PromptUpdateRequest {
  content?: string
  is_active?: boolean
  description?: string
}

// ── API 函数 ──

export async function fetchPrompts(): Promise<PromptListResponse> {
  const { data } = await api.get<PromptListResponse>('/api/admin/prompts')
  return data
}

export async function updatePrompt(
  promptId: number,
  body: PromptUpdateRequest,
): Promise<PromptItem> {
  const { data } = await api.put<PromptItem>(`/api/admin/prompts/${promptId}`, body)
  return data
}

export async function fetchPromptHistory(promptId: number): Promise<PromptItem[]> {
  const { data } = await api.get<PromptItem[]>(`/api/admin/prompts/${promptId}/history`)
  return data
}

// ── 模块元信息 ──

export const PROMPT_MODULE_LABELS: Record<string, string> = {
  recognition: '文物识别',
  companion: '智能伴游',
  generation: '文创生成',
  story: '故事演绎',
  recommendation: '个性化推荐',
}

export const PROMPT_MODULE_ICONS: Record<string, string> = {
  recognition: '🔍',
  companion: '🧭',
  generation: '🎨',
  story: '📖',
  recommendation: '⭐',
}

export const PROMPT_MODULE_COLORS: Record<string, string> = {
  recognition: '#1890ff',
  companion: '#52c41a',
  generation: '#fa8c16',
  story: '#722ed1',
  recommendation: '#eb2f96',
}
