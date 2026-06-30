/** AI 智能伴游 API — v2 对话式 + 反馈 */

import api from './api'

export interface CompanionSuggestion {
  id: string
  title: string
  description: string
  target_route: string
  icon: string
  confidence: number
  category: 'progression' | 'discovery' | 'quest' | 'related'
}

export interface CompanionContext {
  user_summary: string
  recent_activity: string[]
  pending_quests: number
  recommended_modules: string[]
}

export interface CompanionChatResponse {
  reply: string
  suggestions: CompanionSuggestion[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 获取伴游建议 */
export async function getCompanionSuggestions(
  page: string,
  contextHint?: string
): Promise<CompanionSuggestion[]> {
  const { data } = await api.post('/api/companion/suggest', {
    page,
    context_hint: contextHint || null,
  })
  return data
}

/** 与伴游对话 */
export async function chatWithCompanion(
  message: string,
  page: string,
  history: ChatMessage[] = []
): Promise<CompanionChatResponse> {
  const { data } = await api.post('/api/companion/chat', {
    message,
    page,
    history,
  })
  return data
}

/** 记录建议反馈 */
export async function sendCompanionFeedback(
  suggestionId: string,
  action: 'clicked' | 'dismissed',
  page: string
): Promise<void> {
  await api.post('/api/companion/feedback', {
    suggestion_id: suggestionId,
    action,
    page,
  })
}

/** 获取伴游上下文摘要 */
export async function getCompanionContext(): Promise<CompanionContext> {
  const { data } = await api.get('/api/companion/context')
  return data
}
