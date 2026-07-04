import api from './api'

export interface HeritageItem {
  id: number
  name: string
  category: string
  region: string | null
  era: string | null
  description: string | null
  techniques: { name: string; desc: string }[]
  inheritors: { name: string; title: string; desc?: string }[]
  images: string[]
  cultural_meaning: string | null
  is_favorited: boolean
  item_type: 'heritage' | 'user_upload'
  created_at: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pages: number
}

export interface UserUploadResponse {
  id: number
  title: string
  description: string | null
  images: string[]
  category: string | null
  region: string | null
  era: string | null
  techniques: { name: string; desc: string }[]
  inheritors: { name: string; title: string; desc?: string }[]
  cultural_meaning: string | null
  user_id: number
  created_at: string
}

export async function getItems(params: {
  category?: string
  region?: string
  era?: string
  search?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<HeritageItem>> {
  const res = await api.get('/api/exhibition/items', { params })
  return res.data
}

export async function getItemDetail(id: number, type?: string): Promise<HeritageItem> {
  const params = type ? { type } : {}
  const res = await api.get(`/api/exhibition/items/${id}`, { params })
  return res.data
}

export async function getCategories(): Promise<string[]> {
  const res = await api.get('/api/exhibition/categories')
  return res.data
}

export async function getRegions(): Promise<string[]> {
  const res = await api.get('/api/exhibition/regions')
  return res.data
}

export async function getEras(): Promise<string[]> {
  const res = await api.get('/api/exhibition/eras')
  return res.data
}

export async function uploadWork(
  images: File[],
  title: string,
  description: string,
  category: string,
  region: string,
  era: string,
  techniques: { name: string; desc: string }[],
  inheritors: { name: string; title: string; desc?: string }[],
  cultural_meaning: string,
): Promise<UserUploadResponse> {
  const formData = new FormData()
  images.forEach(f => formData.append('images', f))
  formData.append('title', title)
  formData.append('description', description)
  formData.append('category', category)
  formData.append('region', region)
  formData.append('era', era)
  formData.append('techniques', JSON.stringify(techniques))
  formData.append('inheritors', JSON.stringify(inheritors))
  formData.append('cultural_meaning', cultural_meaning)
  const res = await api.post('/api/exhibition/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// === 知识库扩充 ===

export interface ExpansionQueueItem {
  id: number
  status: 'pending' | 'approved' | 'rejected'
  name: string
  category: string
  region: string | null
  era: string | null
  description: string | null
  techniques: { name: string; desc: string }[]
  inheritors: { name: string; title: string; desc?: string }[]
  images: string[]
  cultural_meaning: string | null
  search_keyword: string | null
  source_urls: string[]
  created_at: string | null
}

export interface TaskStatus {
  task_id: string
  status: string
  total: number
  completed: number
  items_found: number
  error?: string | null
}

export interface ExpansionPreferences {
  categories?: string[]
  regions?: string[]
  eras?: string[]
  keywords?: string[]
}

export async function startExpansion(
  count: number,
  preferences?: ExpansionPreferences
): Promise<{ task_id: string; message: string }> {
  const res = await api.post('/api/expansion/expand', {
    count,
    categories: preferences?.categories,
    regions: preferences?.regions,
    eras: preferences?.eras,
    keywords: preferences?.keywords,
  })
  return res.data
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const res = await api.get(`/api/expansion/status/${taskId}`)
  return res.data
}

export async function getExpansionQueue(params: {
  status?: string
  page?: number
  page_size?: number
}): Promise<PaginatedResponse<ExpansionQueueItem>> {
  const res = await api.get('/api/expansion/queue', { params })
  return res.data
}

export async function getExpansionQueueItem(id: number): Promise<ExpansionQueueItem> {
  const res = await api.get(`/api/expansion/queue/${id}`)
  return res.data
}

export async function updateExpansionItem(id: number, data: Partial<ExpansionQueueItem>): Promise<ExpansionQueueItem> {
  const res = await api.put(`/api/expansion/queue/${id}`, data)
  return res.data
}

export async function approveExpansionItem(id: number): Promise<{ message: string; heritage_id: number }> {
  const res = await api.post(`/api/expansion/queue/${id}/approve`)
  return res.data
}

export async function rejectExpansionItem(id: number): Promise<{ message: string }> {
  const res = await api.post(`/api/expansion/queue/${id}/reject`)
  return res.data
}

export async function uploadQueueImages(id: number, images: File[]): Promise<{ images: string[]; message: string }> {
  const formData = new FormData()
  images.forEach(f => formData.append('images', f))
  const res = await api.post(`/api/expansion/queue/${id}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

// === 管理员编辑功能 ===

export async function verifyAdminPassword(password: string): Promise<{ token: string; message: string }> {
  const res = await api.post('/api/exhibition/admin-verify', { password })
  return res.data
}

export async function updateHeritageItem(
  id: number,
  data: Partial<HeritageItem> & { techniques?: { name: string; desc: string }[]; inheritors?: { name: string; title: string; desc?: string }[] },
  adminToken: string,
): Promise<HeritageItem> {
  const res = await api.put(`/api/exhibition/items/${id}`, data, {
    headers: { 'X-Admin-Token': adminToken },
  })
  return res.data
}

export async function uploadHeritageImages(
  id: number,
  images: File[],
  adminToken: string,
): Promise<{ images: string[]; message: string }> {
  const formData = new FormData()
  images.forEach(f => formData.append('images', f))
  const res = await api.post(`/api/exhibition/items/${id}/images`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'X-Admin-Token': adminToken,
    },
  })
  return res.data
}
