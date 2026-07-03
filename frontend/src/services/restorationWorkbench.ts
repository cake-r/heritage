import api from './api'

// ============================================================
// Types
// ============================================================

export interface DamageRegion {
  x: number
  y: number
  width: number
  height: number
  description: string
  severity: string
}

export interface DamageDetectResponse {
  category: string
  damage_types: string[]
  severity: string
  description: string
  damage_regions: DamageRegion[]
  image_url: string
}

export interface LocalInpaintRequest {
  image_path: string
  x: number
  y: number
  width: number
  height: number
  tool_type: string
  prompt_hint?: string | null
  feather_radius?: number
}

export interface LocalInpaintResponse {
  restored_image_url: string
  crop_restored_url: string
  region: DamageRegion
}

export interface ArchiveOperation {
  tool: string
  params: Record<string, any>
  before_url: string
  after_url: string
  timestamp: string
}

export interface ArchiveRequest {
  original_image_path: string
  damage_report_json?: string | null
  operations: ArchiveOperation[]
  ai_assist_ratio: number
  final_image_path: string
  verification_json?: string | null
}

export interface ArchiveResponse {
  id: number
  user_id: number
  original_image_url: string
  damage_report: Record<string, any> | null
  operations: ArchiveOperation[]
  ai_assist_ratio: number
  final_image_url: string | null
  verification: Record<string, any> | null
  export_count: number
  created_at: string
}

export interface ArchiveListItem {
  id: number
  original_image_url: string
  final_image_url: string | null
  ai_assist_ratio: number
  export_count: number
  created_at: string
}

// ============================================================
// API Functions
// ============================================================

export async function damageDetect(file: File): Promise<DamageDetectResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/api/restoration-workbench/damage-detect', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
  return res.data
}

export async function localInpaint(
  imagePath: string,
  region: { x: number; y: number; width: number; height: number },
  toolType: string = 'stain_brush',
  promptHint?: string,
): Promise<LocalInpaintResponse> {
  const body: LocalInpaintRequest = {
    image_path: imagePath,
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height,
    tool_type: toolType,
    prompt_hint: promptHint || null,
    feather_radius: 10,
  }
  const res = await api.post('/api/restoration-workbench/local-inpaint', body, {
    timeout: 300000, // 5min — AI restoration takes time
  })
  return res.data
}

export async function saveArchive(data: ArchiveRequest): Promise<ArchiveResponse> {
  const res = await api.post('/api/restoration-workbench/archive', data)
  return res.data
}

export async function getArchive(id: number): Promise<ArchiveResponse> {
  const res = await api.get(`/api/restoration-workbench/archive/${id}`)
  return res.data
}

export async function listArchives(page = 1, pageSize = 10): Promise<{
  items: ArchiveListItem[]
  total: number
  page: number
  pages: number
}> {
  const res = await api.get('/api/restoration-workbench/archives', {
    params: { page, page_size: pageSize },
  })
  return res.data
}
