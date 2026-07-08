/** 全局搜索 API */

import api from './api'

export interface SearchResult {
  id: number
  type: 'heritage' | 'inheritor' | 'upload'
  title: string
  subtitle: string
  image_url: string
  route: string
  category: string
  region: string
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
}

export async function globalSearch(q: string, scope = 'all', limit = 10): Promise<SearchResponse> {
  const { data } = await api.get('/api/search', { params: { q, scope, limit } })
  return data
}
