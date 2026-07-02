import api from './api'

export interface RecognitionResult {
  id: number
  image_url: string
  category: string
  confidence: number
  top3: { category: string; confidence: number }[]
  features: string[]
  pattern_names: string[]
  explanation: {
    history: string
    technique: string
    inheritor: string
    meaning: string
  }
  heatmap_url: string | null
  heatmap_data: { name: string; x: number; y: number; label: string }[]
  voice_url: string | null
  related: {
    creations: { style: string; label: string }[]
    exhibits: { id: number; name: string }[]
  }
  created_at: string
}

export interface RecognitionListItem {
  id: number
  image_url: string
  category: string
  confidence: number
  created_at: string
}

export async function uploadAndRecognize(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<RecognitionResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/api/recognition/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(percent)
      }
    },
  })
  return res.data
}

export async function getHistory(page = 1, pageSize = 10) {
  const res = await api.get('/api/recognition/history', {
    params: { page, page_size: pageSize },
  })
  return res.data
}

export async function getDetail(id: number): Promise<RecognitionResult> {
  const res = await api.get(`/api/recognition/${id}`)
  return res.data
}
