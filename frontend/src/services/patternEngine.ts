import api from './api'

export interface PatternGene {
  id: number
  gene_id: string
  name: string
  shape_category: string
  meaning: string
  era: string
  region: string
  description: string
  svg_viewbox: string
  svg_content: string
  default_color: string
  tags: string[]
}

export interface PatternMatchResponse {
  matched: PatternGene[]
  unmatched: string[]
}

export interface GeneCultureResponse {
  gene: PatternGene
  cultural_meaning: string
}

/** 提交纹样名称列表 → 匹配基因库 */
export async function matchPatterns(pattern_names: string[]): Promise<PatternMatchResponse> {
  const res = await api.post('/api/pattern-engine/match', { pattern_names })
  return res.data
}

/** 分页列出基因库 */
export async function listGenes(
  params?: { category?: string; meaning?: string; page?: number; page_size?: number }
): Promise<{ items: PatternGene[]; total: number }> {
  const res = await api.get('/api/pattern-engine/genes', { params })
  return res.data
}

/** 获取基因库分类列表 */
export async function listCategories(): Promise<{ categories: string[] }> {
  const res = await api.get('/api/pattern-engine/genes/categories')
  return res.data
}

/** 获取单个基因详情 + 文化解读 */
export async function getGeneDetail(gene_id: string): Promise<GeneCultureResponse> {
  const res = await api.get(`/api/pattern-engine/genes/${gene_id}`)
  return res.data
}
