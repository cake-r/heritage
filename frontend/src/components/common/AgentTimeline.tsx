/** AgentTimeline — Agent 执行步骤可视化组件
 *
 * 基于 Framer Motion 的动画垂直时间线，订阅 SSE 实时展示 AI 执行步骤。
 *
 * Props:
 *   executionId  — 执行 ID，null 时不启动订阅
 *   onComplete   — 执行完成回调
 *   compact      — true=紧凑内联模式, false=完整侧边栏模式
 *   maxHeight    — 可滚动最大高度
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Typography, Progress, Tag, Collapse } from 'antd'
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronRight,
} from 'lucide-react'
import { subscribeExecution, type AgentStepEvent, type AgentFinishEvent } from '../../services/agent'

const { Text } = Typography

// ── 工具函数 ──

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle style={{ color: '#52c41a' }} />
    case 'failed':
      return <XCircle style={{ color: '#ff4d4f' }} />
    case 'running':
      return <Loader2 style={{ color: '#1890ff' }} className="animate-spin" />
    default:
      return <Clock style={{ color: '#d9d9d9' }} />
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return '#52c41a'
    case 'failed': return '#ff4d4f'
    case 'running': return '#1890ff'
    default: return '#d9d9d9'
  }
}

// ── 组件 Props ──

interface AgentTimelineProps {
  /** 静态步骤数据（从 API 响应的 agent_steps 字段传入），渲染所有步骤的最终状态 */
  steps?: AgentStepEvent[] | null
  /** SSE 订阅的执行 ID，传入后会自动订阅实时更新 */
  executionId?: string | null
  /** 实时模式的完成回调 */
  onComplete?: (success: boolean) => void
  compact?: boolean
  maxHeight?: number
}

// ── StepItem 子组件 ──

interface StepItemProps {
  step: AgentStepEvent
  isLast: boolean
  compact?: boolean
}

function StepItem({ step, isLast, compact }: StepItemProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = step.detail && Object.keys(step.detail).length > 0

  const elapsed = step.end_time && step.start_time
    ? new Date(step.end_time).getTime() - new Date(step.start_time).getTime()
    : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        display: 'flex',
        gap: 12,
        paddingBottom: isLast ? 0 : (compact ? 12 : 20),
        position: 'relative',
      }}
    >
      {/* 时间线节点 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <motion.div
          animate={
            step.status === 'running'
              ? { scale: [1, 1.15, 1] }
              : { scale: 1 }
          }
          transition={step.status === 'running' ? { repeat: Infinity, duration: 1.2 } : {}}
          style={{
            width: compact ? 28 : 32,
            height: compact ? 28 : 32,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: step.status === 'running' ? '#e6f4ff' : 'transparent',
            border: `2px solid ${getStatusColor(step.status)}`,
            fontSize: compact ? 12 : 14,
          }}
        >
          {getStatusIcon(step.status)}
        </motion.div>
        {!isLast && (
          <div
            style={{
              width: 2,
              flex: 1,
              minHeight: compact ? 16 : 24,
              background: step.status === 'completed'
                ? '#52c41a'
                : step.status === 'failed'
                  ? '#ffd8d8'
                  : '#f0f0f0',
            }}
          />
        )}
      </div>

      {/* 步骤内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text
            strong
            style={{
              fontSize: compact ? 13 : 14,
              color: step.status === 'failed' ? '#ff4d4f' : undefined,
            }}
          >
            {step.icon && <span style={{ marginRight: 4 }}>{step.icon}</span>}
            {step.title}
          </Text>
          {step.status === 'running' && step.progress > 0 && (
            <Progress
              percent={step.progress}
              size="small"
              style={{ width: 80, marginBottom: 0 }}
              showInfo={false}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 2, alignItems: 'center' }}>
          <Tag
            color={step.status === 'completed' ? 'success' : step.status === 'failed' ? 'error' : step.status === 'running' ? 'processing' : 'default'}
            style={{ fontSize: 11, lineHeight: '18px' }}
          >
            {step.status === 'pending' ? '等待中' : step.status === 'running' ? '执行中' : step.status === 'completed' ? '已完成' : '失败'}
          </Tag>
          {elapsed !== null && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatDuration(elapsed)}
            </Text>
          )}
        </div>

        {/* 失败信息 */}
        {step.error && step.status === 'failed' && (
          <Text
            type="danger"
            style={{ fontSize: 12, display: 'block', marginTop: 4 }}
            ellipsis={{ tooltip: step.error }}
          >
            {step.error}
          </Text>
        )}

        {/* 可展开详情 */}
        {hasDetail && step.status === 'completed' && (
          <div style={{ marginTop: 6 }}>
            <Text
              type="secondary"
              style={{ fontSize: 11, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronRight
                rotate={expanded ? 90 : 0}
                style={{ marginRight: 4, transition: 'transform 0.2s' }}
              />
              {expanded ? '收起详情' : '查看详情'}
            </Text>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden' }}
                >
                  <pre
                    style={{
                      marginTop: 6,
                      padding: 8,
                      background: '#fafafa',
                      borderRadius: 6,
                      fontSize: 11,
                      maxHeight: 120,
                      overflow: 'auto',
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    {JSON.stringify(step.detail, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── AgentTimeline 主组件 ──

export default function AgentTimeline({
  steps: staticSteps,
  executionId,
  onComplete,
  compact = false,
  maxHeight = 400,
}: AgentTimelineProps) {
  const [liveSteps, setLiveSteps] = useState<AgentStepEvent[]>([])
  const [summary, setSummary] = useState('')
  const [finished, setFinished] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  // 静态模式：直接使用传入的 steps
  const steps = staticSteps && staticSteps.length > 0 ? staticSteps : liveSteps
  const isStatic = staticSteps && staticSteps.length > 0

  // 实时模式：订阅 SSE
  useEffect(() => {
    if (!executionId || isStatic) return

    setLiveSteps([])
    setSummary('')
    setFinished(false)

    const ctrl = subscribeExecution(executionId, {
      onStep: (data) => {
        setLiveSteps((prev) => {
          const idx = prev.findIndex((s) => s.step_id === data.step_id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = data
            return updated
          }
          return [...prev, data]
        })
      },
      onProgress: (data) => {
        setLiveSteps((prev) =>
          prev.map((s) =>
            s.step_id === data.step_id ? { ...s, progress: data.progress } : s,
          ),
        )
      },
      onFinish: (data: AgentFinishEvent) => {
        setLiveSteps(data.steps || [])
        setSummary(data.summary)
        setFinished(true)
        onComplete?.(data.status === 'completed')
      },
      onError: (_error) => {
        setFinished(true)
        onComplete?.(false)
      },
    })

    controllerRef.current = ctrl

    return () => {
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId, isStatic])

  if (!executionId && (!staticSteps || staticSteps.length === 0)) return null

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        padding: compact ? 12 : 16,
        maxHeight,
        overflowY: 'auto',
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: compact ? 10 : 16,
        }}
      >
        <Text strong style={{ fontSize: compact ? 13 : 15 }}>
          🧠 Agent 执行追踪
        </Text>
        {finished && (
          <Tag color={summary.includes('失败') ? 'error' : 'success'} style={{ fontSize: 11 }}>
            {summary}
          </Tag>
        )}
      </div>

      {/* 步骤列表 */}
      {steps.length === 0 && !finished && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Loader2 style={{ fontSize: 18, color: '#1890ff' }} className="animate-spin" />
          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
            等待 Agent 执行...
          </Text>
        </div>
      )}

      {steps.map((step, i) => (
        <StepItem
          key={(step as any).id || step.step_id || i}
          step={step}
          isLast={i === steps.length - 1 && (isStatic || finished)}
          compact={compact}
        />
      ))}

      {/* 底部总结 */}
      {finished && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid #f0f0f0',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            总耗时:{' '}
            {steps.length > 0 && steps[0].start_time && steps[steps.length - 1].end_time
              ? formatDuration(
                  new Date(steps[steps.length - 1].end_time!).getTime() -
                    new Date(steps[0].start_time!).getTime(),
                )
              : '—'}
          </Text>
        </motion.div>
      )}
    </div>
  )
}
