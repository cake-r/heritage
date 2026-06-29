import api from './api'

export interface Character {
  id: string
  name: string
  avatar: string
  expertise: string[]
  greeting: string
  tools: string[]
  quick_questions: string[]
}

export interface ChatSessionItem {
  id: number
  persona: string
  title: string
  updated_at: string
  created_at: string
  preview: string
  available_tools: string[]
  inheritor_name: string
  inheritor_avatar: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  image_url: string | null
  voice_url: string | null
  created_at: string
}

export interface SessionDetail {
  id: number
  persona: string
  title: string
  messages: ChatMessage[]
  created_at: string
  updated_at: string
  available_tools: string[]
  quick_questions: string[]
}

export interface SSEDoneData {
  message_id: number
  quick_questions: string[]
  voice_url: string | null
  tool_used?: string
}

// === 工具事件类型 ===

export interface ToolStartEvent {
  tool: string
  message: string
}

export interface ToolResultEvent {
  tool: string
  recognition?: Record<string, unknown>
  commentary?: string
  related_items?: Array<{
    id: number
    name: string
    category: string
    region: string
    era: string
    description: string
    image: string
  }>
  summary?: string
}

export interface ImageBatchEvent {
  tool: string
  images: string[]
  prompt_used: string
}

export interface CurriculumSectionEvent {
  action: 'start' | 'end'
  section_id: string
  title?: string
  description?: string
}

// === API ===

export async function getCharacters(): Promise<Character[]> {
  const res = await api.get('/api/chat/characters')
  return res.data
}

export async function createSession(persona: string): Promise<ChatSessionItem> {
  const res = await api.post('/api/chat/sessions', { persona })
  return res.data
}

export async function listSessions(): Promise<ChatSessionItem[]> {
  const res = await api.get('/api/chat/sessions')
  return res.data
}

export async function getSessionDetail(id: number): Promise<SessionDetail> {
  const res = await api.get(`/api/chat/sessions/${id}`)
  return res.data
}

export async function deleteSession(id: number) {
  const res = await api.delete(`/api/chat/sessions/${id}`)
  return res.data
}

// === SSE Hook ===

export interface SSECallbacks {
  onToken: (token: string) => void
  onDone: (data: SSEDoneData) => void
  onError: (error: string) => void
  onToolStart?: (data: ToolStartEvent) => void
  onToolProgress?: (data: { tool: string; step: string }) => void
  onToolResult?: (data: ToolResultEvent) => void
  onImageBatch?: (data: ImageBatchEvent) => void
  onCurriculumSection?: (data: CurriculumSectionEvent) => void
}

export function sendMessageSSE(
  sessionId: number,
  content: string,
  image?: File | null,
  callbacks?: SSECallbacks,
): AbortController {
  const controller = new AbortController()
  const formData = new FormData()
  formData.append('content', content)
  if (image) formData.append('image', image)

  const token = localStorage.getItem('token')
  fetch(`/api/chat/sessions/${sessionId}/send`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '请求失败' }))
      callbacks?.onError(err.detail || '请求失败')
      return
    }

    const reader = response.body?.getReader()
    if (!reader) { callbacks?.onError('无法读取流'); return }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // 解析SSE事件
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''  // 最后一个不完整行留下次处理

      let currentEvent = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const dataStr = line.slice(6)
          try {
            const data = JSON.parse(dataStr)
            switch (currentEvent) {
              case 'message':
                callbacks?.onToken(data.token)
                break
              case 'done':
                callbacks?.onDone(data)
                break
              case 'error':
                callbacks?.onError(data.error)
                break
              case 'tool_start':
                callbacks?.onToolStart?.(data)
                break
              case 'tool_progress':
                callbacks?.onToolProgress?.(data)
                break
              case 'tool_result':
                callbacks?.onToolResult?.(data)
                break
              case 'image_batch':
                callbacks?.onImageBatch?.(data)
                break
              case 'curriculum_section':
                callbacks?.onCurriculumSection?.(data)
                break
            }
          } catch {
            // 跳过解析失败的行
          }
          currentEvent = ''
        }
      }
    }
  }).catch(err => {
    if (err.name !== 'AbortError') {
      callbacks?.onError(err.message || '网络连接失败')
    }
  })

  return controller
}
