/** AI 智能伴游 API */

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

/** 获取伴游上下文摘要 */
export async function getCompanionContext(): Promise<CompanionContext> {
  const { data } = await api.get('/api/companion/context')
  return data
}
