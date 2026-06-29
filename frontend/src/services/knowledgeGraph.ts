import api from './api'

// ========== Types ==========

export interface CategoryStat {
  name: string
  item_count: number
  region_count: number
  era_range: string[]
  technique_count: number
  top_image: string
}

export interface SharedTechnique {
  name: string
  desc: string
  category_count: number
  categories: string[]
  item_count: number
  earliest_era: string
}

export interface CategoryTechniqueLink {
  source: string
  target: string
  strength: number
}

export interface OverviewData {
  categories: CategoryStat[]
  shared_techniques: SharedTechnique[]
  category_technique_links: CategoryTechniqueLink[]
  all_techniques: { name: string; desc: string; category: string }[]
}

export interface ItemNode {
  id: number
  name: string
  category: string
  region: string
  era: string
  techniques: string[]
  symbolSize: number
  image: string
}

export interface ItemLink {
  source: number
  target: number
  relation: string
  shared_value: string
}

export interface ItemsData {
  nodes: ItemNode[]
  links: ItemLink[]
}

export interface RegionData {
  name: string
  value: number
  coords: number[]
  items: string[]
  categories: string[]
  top_techniques: string[]
}

export interface TimelineItem {
  era: string
  start: number
  end: number
  items: { id: number; name: string; category: string; image: string }[]
  distribution: Record<string, number>
  techniques_introduced: string[]
  category_breakdown: Record<string, number>
}

export interface TechniqueDetail {
  name: string
  desc: string
  categories: string[]
  items: { id: number; name: string; category: string; era: string; region: string }[]
  era_distribution: Record<string, number>
  related_techniques: string[]
}

export interface RelatedItems {
  item: Record<string, any>
  same_category: { id: number; name: string; category: string; region: string; era: string; image: string }[]
  same_region: { id: number; name: string; category: string; region: string; era: string; image: string }[]
  shared_techniques: { id: number; name: string; category: string; region: string; era: string; image: string }[]
}

// ========== API Functions ==========

export async function getOverview(): Promise<OverviewData> {
  const res = await api.get('/api/knowledge-graph/overview')
  return res.data
}

export async function getItems(params: {
  category?: string
  region?: string
  era?: string
  technique?: string
}): Promise<ItemsData> {
  const res = await api.get('/api/knowledge-graph/items', { params })
  return res.data
}

export async function getTechniqueDetail(name: string): Promise<TechniqueDetail> {
  const res = await api.get(`/api/knowledge-graph/technique/${encodeURIComponent(name)}`)
  return res.data
}

export async function getRelatedItems(id: number): Promise<RelatedItems> {
  const res = await api.get(`/api/knowledge-graph/items/${id}/related`)
  return res.data
}

export async function getRegions(): Promise<RegionData[]> {
  const res = await api.get('/api/knowledge-graph/regions')
  return res.data
}

export async function getTimeline(): Promise<TimelineItem[]> {
  const res = await api.get('/api/knowledge-graph/timeline')
  return res.data
}
