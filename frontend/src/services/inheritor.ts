import api from './api'

// === 类型定义 ===

export interface CategoryInfo {
  id: string
  name: string
  icon: string
  description: string
}

export interface ToolCapabilityPreview {
  tool_id: string
  tool_name: string
  description: string
  sample_output: string
}

export interface GeneratePersonaRequest {
  name: string
  category: string
  personality: string
  bio: string
  selected_tools: string[]
  expertise: string[]
}

export interface GeneratePersonaResponse {
  persona: string
  greeting: string
  quick_questions: string[]
  style: string
  suggested_avatar_prompt: string
}

export interface CustomInheritorCreate {
  name: string
  category: string
  persona: string
  greeting: string
  tools: string[]
  domain_prompts: Record<string, string>
  style: string
  expertise: string[]
}

export interface CustomInheritorUpdate {
  name?: string
  persona?: string
  greeting?: string
  tools?: string[]
  domain_prompts?: Record<string, string>
  style?: string
  expertise?: string[]
  is_public?: boolean
}

export interface CustomInheritor {
  id: number
  user_id: number
  name: string
  category: string
  avatar_url: string
  persona: string
  greeting: string
  tools: string[]
  domain_prompts: Record<string, string>
  style: string
  expertise: string[]
  is_public: boolean
  created_at: string
}

export interface InheritorStats {
  total: number
  limit: number
  remaining: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pages: number
}

export interface InheritorContext {
  id: string
  name: string
  avatar: string
  system_prompt: string
  style: string
  expertise: string[]
  greeting: string
  tools: string[]
  domain_prompts: Record<string, string>
  quick_questions: string[]
  is_custom: boolean
}

// === API 函数 ===

export async function getCatalog(): Promise<CategoryInfo[]> {
  const res = await api.get('/api/inheritors/catalog')
  return res.data
}

export async function generatePersona(req: GeneratePersonaRequest): Promise<GeneratePersonaResponse> {
  const res = await api.post('/api/inheritors/generate-persona', req, { timeout: 60000 })
  return res.data
}

export async function createInheritor(data: CustomInheritorCreate): Promise<CustomInheritor> {
  const res = await api.post('/api/inheritors', data)
  return res.data
}

export async function listMyInheritors(): Promise<CustomInheritor[]> {
  const res = await api.get('/api/inheritors')
  return res.data
}

export async function getInheritorStats(): Promise<InheritorStats> {
  const res = await api.get('/api/inheritors/stats')
  return res.data
}

export async function listPublicInheritors(page: number = 1, pageSize: number = 12): Promise<PaginatedResponse<CustomInheritor>> {
  const res = await api.get('/api/inheritors/public', { params: { page, page_size: pageSize } })
  return res.data
}

export async function getInheritorDetail(id: number): Promise<CustomInheritor> {
  const res = await api.get(`/api/inheritors/${id}`)
  return res.data
}

export async function updateInheritor(id: number, data: CustomInheritorUpdate): Promise<CustomInheritor> {
  const res = await api.put(`/api/inheritors/${id}`, data)
  return res.data
}

export async function deleteInheritor(id: number): Promise<{ message: string }> {
  const res = await api.delete(`/api/inheritors/${id}`)
  return res.data
}

export async function generateAvatar(id: number): Promise<{ avatar_url: string }> {
  const res = await api.post(`/api/inheritors/${id}/avatar`, {}, { timeout: 120000 })
  return res.data
}

export async function getInheritorContext(personaId: string): Promise<InheritorContext> {
  const res = await api.get(`/api/chat/inheritor/${personaId}`)
  return res.data
}
