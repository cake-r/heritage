/** Agent 执行追踪 SSE 订阅服务
 *
 * 复用 chat.ts 的 fetch+reader SSE 解析模式。
 */

export interface AgentStepEvent {
  execution_id: string
  step_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  title: string
  icon: string
  progress: number
  start_time: string | null
  end_time: string | null
  detail: Record<string, unknown> | null
  error: string | null
}

export interface AgentProgressEvent {
  execution_id: string
  step_id: string
  progress: number
}

export interface AgentFinishEvent {
  execution_id: string
  module: string
  status: 'completed' | 'failed'
  steps: AgentStepEvent[]
  started_at: string
  finished_at: string | null
  summary: string
}

export interface AgentCallbacks {
  onStep: (data: AgentStepEvent) => void
  onProgress: (data: AgentProgressEvent) => void
  onFinish: (data: AgentFinishEvent) => void
  onError: (error: string) => void
}

export function subscribeExecution(
  executionId: string,
  callbacks: AgentCallbacks,
): AbortController {
  const controller = new AbortController()
  const token = localStorage.getItem('token')

  fetch(`/api/agent/execution/${executionId}/stream`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: '订阅失败' }))
        callbacks.onError(err.detail || '订阅失败')
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        callbacks.onError('无法读取SSE流')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            try {
              const data = JSON.parse(dataStr)
              switch (currentEvent) {
                case 'agent_step':
                  callbacks.onStep(data)
                  break
                case 'agent_progress':
                  callbacks.onProgress(data)
                  break
                case 'agent_finish':
                  callbacks.onFinish(data)
                  break
                case 'error':
                  callbacks.onError(data.error || '执行异常')
                  break
              }
            } catch {
              // 跳过解析失败的行
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError(err.message || '连接失败')
      }
    })

  return controller
}
