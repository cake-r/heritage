/** Story Mode 沉浸式探索 — SSE 订阅服务 */
import api from './api'

export interface DemoStepEvent {
  step_id: string
  title: string
  icon: string
  status: 'running' | 'completed' | 'failed' | 'skipped'
  progress: number
  message: string
  output_data?: Record<string, any>
  error?: string
}

export interface DemoErrorEvent {
  step_id: string
  error: string
  action: string
}

export interface DemoFinishEvent {
  summary: string
  report: {
    total_steps: number
    completed_steps: number
    failed_steps: number
    skipped_steps: number
    total_duration_s: number
    highlights: string[]
  }
  results: Array<{
    step_id: string
    status: string
    output_data?: Record<string, any>
  }>
}

export interface StoryModeCallbacks {
  onStep: (event: DemoStepEvent) => void
  onProgress: (stepId: string, progress: number, message: string) => void
  onStepResult: (event: DemoStepEvent) => void
  onError: (event: DemoErrorEvent) => void
  onFinish: (event: DemoFinishEvent) => void
  onFatal: (error: string) => void
}

export function startStoryMode(
  callbacks: StoryModeCallbacks,
  demoId?: string
): AbortController {
  const controller = new AbortController()
  const token = localStorage.getItem('token') || ''

  const url = '/api/story-mode/start'
  const body = demoId ? JSON.stringify({ demo_id: demoId }) : '{}'

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body,
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      callbacks.onFatal(`HTTP ${response.status}: ${response.statusText}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      callbacks.onFatal('无法读取响应流')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            try {
              const data = JSON.parse(dataStr)
              switch (eventType) {
                case 'demo_step':
                  callbacks.onStep(data as DemoStepEvent)
                  break
                case 'demo_progress':
                  callbacks.onProgress(data.step_id, data.progress, data.message)
                  break
                case 'demo_step_result':
                  callbacks.onStepResult(data as DemoStepEvent)
                  break
                case 'demo_error':
                  callbacks.onError(data as DemoErrorEvent)
                  break
                case 'demo_finish':
                  callbacks.onFinish(data as DemoFinishEvent)
                  break
              }
            } catch {
              // skip parse errors
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        callbacks.onFatal(err.message || '连接中断')
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') {
      callbacks.onFatal(err.message || '网络错误')
    }
  })

  return controller
}
