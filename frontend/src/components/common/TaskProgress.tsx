/** 统一任务进度组件 — WebSocket 实时推送 + HTTP 轮询降级 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { Progress, Typography, Spin, Result, Button, theme } from 'antd'
import { Loader2, CheckCircle, Wifi } from 'lucide-react'
import api from '../../services/api'
import { connectTaskWS } from '../../services/websocket'

const { Text } = Typography

interface TaskProgressProps {
  taskId: string
  title?: string
  pollIntervalMs?: number        // HTTP 轮询间隔 (WebSocket 故障时)
  onComplete?: (result: any) => void
  onError?: (error: string) => void
}

interface TaskState {
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
  progress: number
  error_msg?: string
  result_json?: any
}

export default function TaskProgress({
  taskId,
  title = '任务处理中',
  pollIntervalMs = 2000,
  onComplete,
  onError,
}: TaskProgressProps) {
  const { token } = theme.useToken()
  const [task, setTask] = useState<TaskState | null>(null)
  const [loading, setLoading] = useState(true)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)
  onCompleteRef.current = onComplete
  onErrorRef.current = onError

  const handleUpdate = useCallback((data: any) => {
    if (completedRef.current) return
    setTask((prev) => {
      const next = { ...prev, ...data, status: data.status || prev?.status || 'running' }
      return next as TaskState
    })
    setLoading(false)

    if (data.status === 'success') {
      completedRef.current = true
      onCompleteRef.current?.(data.result)
    }
    if (data.status === 'failed') {
      completedRef.current = true
      onErrorRef.current?.(data.error || '任务执行失败')
    }
  }, [])

  useEffect(() => {
    if (!taskId) return

    let disconnectWS: (() => void) | undefined
    let pollTimer: ReturnType<typeof setInterval> | undefined
    let cancelled = false

    // 尝试 WebSocket 连接
    disconnectWS = connectTaskWS(
      taskId,
      (data) => {
        if (cancelled) return
        handleUpdate(data)
      },
      (status) => {
        if (cancelled) return
        setWsStatus(status)
      },
    )

    // HTTP 轮询降级 (WebSocket 失败或未连接时)
    const startPolling = () => {
      const poll = async () => {
        if (cancelled || completedRef.current) return
        try {
          const { data } = await api.get(`/api/tasks/${taskId}`)
          if (cancelled || completedRef.current) return
          handleUpdate(data)
        } catch {
          // 轮询失败静默处理
        }
      }
      poll()
      pollTimer = setInterval(() => {
        if (completedRef.current) {
          if (pollTimer) clearInterval(pollTimer)
          return
        }
        poll()
      }, pollIntervalMs)
    }

    // WebSocket 2 秒内未连接则启动轮询
    const fallbackTimer = setTimeout(() => {
      if (!completedRef.current && wsStatus !== 'connected') {
        startPolling()
      }
    }, 2000)

    return () => {
      cancelled = true
      clearTimeout(fallbackTimer)
      if (pollTimer) clearInterval(pollTimer)
      disconnectWS?.()
    }
  }, [taskId, pollIntervalMs, handleUpdate])

  if (loading && !task) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin indicator={<Loader2 style={{ fontSize: 32 }} className="animate-spin" />} />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">正在创建任务...</Text>
        </div>
      </div>
    )
  }

  if (!task) return null

  if (task.status === 'failed') {
    return (
      <Result
        status="error"
        title="任务执行失败"
        subTitle={task.error_msg || '请稍后重试'}
        extra={<Button onClick={() => window.location.reload()}>重试</Button>}
      />
    )
  }

  if (task.status === 'cancelled') {
    return (
      <Result
        status="info"
        title="任务已取消"
        subTitle="您可以重新发起任务"
      />
    )
  }

  if (task.status === 'success') {
    return (
      <Result
        status="success"
        title={`${title}完成`}
        icon={<CheckCircle style={{ color: token.colorSuccess }} />}
      />
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <Progress
        type="circle"
        percent={task.progress || 0}
        status="active"
        size={100}
      />
      <div style={{ marginTop: 20 }}>
        <Text strong>{title}</Text>
        <br />
        <Text type="secondary">
          {task.status === 'pending' ? '排队中...' : `处理中 ${task.progress || 0}%`}
        </Text>
        {wsStatus === 'connected' && (
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            <Wifi style={{ marginRight: 4, color: token.colorSuccess }} />
            实时连接
          </Text>
        )}
      </div>
    </div>
  )
}
