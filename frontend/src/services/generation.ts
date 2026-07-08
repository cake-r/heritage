import api from './api'

export interface GenerationResult {
  id: number
  images: string[]
  params: Record<string, any>
  seed: number | null
  prompt_used: string
  created_at: string
}

export interface GenerationItem {
  id: number
  images: string[]
  base_style: string
  prompt: string
  is_public: boolean
  created_at: string
  mode: string
  user_id: number
}

export async function textToImage(params: {
  base_style: string
  elements?: string[]
  color_palette?: string
  composition?: string
  intensity?: number
  negative_prompt?: string
  count?: number
}): Promise<GenerationResult> {
  const res = await api.post('/api/generation/text-to-image', params, { timeout: 180000 })
  return res.data
}

export async function imageToImage(
  file: File,
  params: {
    base_style: string
    elements?: string[]
    color_palette?: string
    composition?: string
    intensity?: number
    negative_prompt?: string
    count?: number
  }
): Promise<GenerationResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('base_style', params.base_style)
  formData.append('elements', JSON.stringify(params.elements || []))
  formData.append('color_palette', params.color_palette || '')
  formData.append('composition', params.composition || '')
  formData.append('intensity', String(params.intensity ?? 0.7))
  formData.append('negative_prompt', params.negative_prompt || '')
  formData.append('count', String(params.count ?? 2))
  const res = await api.post('/api/generation/image-to-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 180000,
  })
  return res.data
}

export async function getHistory(page = 1, pageSize = 12) {
  const res = await api.get('/api/generation/history', { params: { page, page_size: pageSize } })
  return res.data
}

export interface GalleryParams {
  page?: number
  pageSize?: number
  style?: string
  mode?: string
  search?: string
  sort?: 'newest' | 'popular'
}

export async function getGallery(params: GalleryParams = {}) {
  const { page = 1, pageSize = 12, style, mode, search, sort } = params
  const res = await api.get('/api/generation/gallery', {
    params: {
      page,
      page_size: pageSize,
      ...(style && { style }),
      ...(mode && { mode }),
      ...(search && { search }),
      ...(sort && sort !== 'newest' && { sort }),
    },
  })
  return res.data
}

export async function getGalleryStyles(): Promise<string[]> {
  const res = await api.get('/api/generation/styles')
  return res.data
}

export async function publishWork(id: number, isPublic: boolean) {
  const res = await api.post(`/api/generation/${id}/publish`, { is_public: isPublic })
  return res.data
}

export async function getDetail(id: number): Promise<GenerationResult> {
  const res = await api.get(`/api/generation/${id}`)
  return res.data
}

export async function deleteWork(id: number) {
  const res = await api.delete(`/api/generation/${id}`)
  return res.data
}
