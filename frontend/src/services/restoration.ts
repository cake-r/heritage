import api from './api'

// ============================================================
// Types
// ============================================================

export interface DamageAnalysis {
  category: string
  damage_types: string[]
  severity: string
  description: string
}

export interface RestorationPromptResult {
  prompt: string
}

export interface ImageRestorationResult {
  images: string[]
  seed: number
}

export interface VerificationDimensions {
  detail_fidelity: number
  style_consistency: number
  restoration_completeness: number
}

export interface VerificationReport {
  overall_score: number
  dimensions: VerificationDimensions
  verdict: string
  artifacts: string[]
}

export interface PipelineStep {
  step: number
  name: string
  model: string
  status: string // 'completed' | 'failed'
  result: Record<string, any> | null
}

export interface RestorationResult {
  id: number
  original_image_url: string
  restored_image_url: string | null
  pipeline_steps: PipelineStep[]
  created_at: string
}

export interface RestorationListItem {
  id: number
  original_image_url: string
  restored_image_url: string | null
  damage_category: string | null
  verification_score: number | null
  pipeline_status: string
  created_at: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pages: number
}

// ============================================================
// API Functions
// ============================================================

export async function uploadAndRestore(file: File): Promise<RestorationResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/api/restoration/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000, // 5min — pipeline takes time
  })
  return res.data
}

export async function getHistory(page = 1, pageSize = 10): Promise<PaginatedResponse<RestorationListItem>> {
  const res = await api.get('/api/restoration/history', {
    params: { page, page_size: pageSize },
  })
  return res.data
}

export async function getDetail(id: number): Promise<RestorationResult> {
  const res = await api.get(`/api/restoration/${id}`)
  return res.data
}

export async function deleteRestoration(id: number) {
  const res = await api.delete(`/api/restoration/${id}`)
  return res.data
}
