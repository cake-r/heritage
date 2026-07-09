/** AgentTimeline — Agent 执行步骤可视化组件（国风版）
 *
 * 基于 Framer Motion 的动画垂直时间线，订阅 SSE 实时展示 AI 执行步骤。
 * 结构化展示步骤输出数据，拒绝裸 JSON。
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Typography, Progress, Tag } from 'antd'
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  FlaskConical,
} from 'lucide-react'
import { Icon } from '../../config/icons'
import { subscribeExecution, type AgentStepEvent, type AgentFinishEvent } from '../../services/agent'

const { Text } = Typography

// ── 工具函数 ──

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

// ── 项目色系 ──
const GOLD = '#C4A265'
const VERMILION = '#B8463A'
const INK = '#2C241A'
const INK_SEC = '#6B5F52'
const SUCCESS = '#4A8C5C'
const ERROR = '#C5533B'
const BG = 'var(--color-paper-white, #FFFDF9)'

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return SUCCESS
    case 'failed': return ERROR
    case 'running': return VERMILION
    default: return INK_SEC
  }
}

// ── 组件 Props ──

interface AgentTimelineProps {
  steps?: AgentStepEvent[] | null
  executionId?: string | null
  onComplete?: (success: boolean) => void
  compact?: boolean
  maxHeight?: number
}

// ── DetailView：结构化展示步骤输出 ──

function DetailView({ detail }: { detail: Record<string, any> }) {
  const entries = useMemo(() => {
    if (!detail) return []
    // 过滤掉复杂嵌套对象和数组，只展示简单值
    return Object.entries(detail).filter(([, v]) => {
      if (v === null || v === undefined || v === '') return false
      if (typeof v === 'object') return false
      return true
    })
  }, [detail])

  if (entries.length === 0) return null

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6,
      padding: '8px 10px', borderRadius: 8,
      background: 'rgba(196,162,101,0.06)',
      border: '1px solid rgba(196,162,101,0.15)',
    }}>
      {entries.map(([k, v]) => {
        const label = k.replace(/_/g, ' ')
        const displayVal = typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : String(v)
        return (
          <Tag key={k} color="gold" style={{ fontSize: 12, margin: 0 }}>
            {label}: <strong>{displayVal}</strong>
          </Tag>
        )
      })}
    </div>
  )
}

// ── StepItem 子组件 ──

interface StepItemProps {
  step: AgentStepEvent
  index: number
  isLast: boolean
  compact?: boolean
}

function StepItem({ step, index, isLast, compact }: StepItemProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = step.detail && Object.keys(step.detail).length > 0
  const isCompleted = step.status === 'completed'
  const isRunning = step.status === 'running'
  const isFailed = step.status === 'failed'

  const elapsed = step.end_time && step.start_time
    ? new Date(step.end_time).getTime() - new Date(step.start_time).getTime()
    : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        display: 'flex', gap: 12,
        paddingBottom: isLast ? 0 : (compact ? 10 : 16),
        position: 'relative',
      }}
    >
      {/* 时间线节点 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: compact ? 24 : 28 }}>
        <motion.div
          animate={isRunning ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={isRunning ? { repeat: Infinity, duration: 1.2 } : {}}
          style={{
            width: compact ? 24 : 28,
            height: compact ? 24 : 28,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isRunning
              ? 'rgba(184,70,58,0.1)'
              : isCompleted ? 'rgba(74,140,92,0.08)' : 'transparent',
            border: `2px solid ${getStatusColor(step.status)}`,
          }}
        >
          {isCompleted && <CheckCircle size={compact ? 13 : 15} color={SUCCESS} />}
          {isFailed && <XCircle size={compact ? 13 : 15} color={ERROR} />}
          {isRunning && <Loader2 size={compact ? 13 : 15} color={VERMILION} className="animate-spin" />}
          {(step.status === 'pending' || !step.status) && <Clock size={compact ? 13 : 15} color={INK_SEC} />}
        </motion.div>
        {!isLast && (
          <div style={{
            width: 2, flex: 1,
            minHeight: compact ? 14 : 20,
            background: isCompleted
              ? `linear-gradient(180deg, ${SUCCESS}, rgba(74,140,92,0.2))`
              : isFailed
                ? `linear-gradient(180deg, ${ERROR}, rgba(197,83,59,0.15))`
                : `var(--color-border-light, #E8E4D8)`,
          }} />
        )}
      </div>

      {/* 步骤内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 标题行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text strong style={{
            fontSize: compact ? 13 : 15,
            color: isFailed ? ERROR : INK,
          }}>
            {step.icon && <Icon name={step.icon} size={compact ? 14 : 16} style={{ marginRight: 4, verticalAlign: -3 }} />}
            第{index + 1}步 · {step.title}
          </Text>

          {isRunning && step.progress > 0 && (
            <Progress percent={step.progress} size="small" style={{ width: 72, marginBottom: 0 }}
              strokeColor={VERMILION} showInfo={false} />
          )}
        </div>

        {/* 状态 + 耗时 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 2, alignItems: 'center' }}>
          <Tag color={
            isCompleted ? 'success' : isFailed ? 'error' : isRunning ? 'processing' : 'default'
          } style={{ fontSize: 11, lineHeight: '18px' }}>
            {step.status === 'pending' ? '等待中' : isRunning ? '执行中' : isCompleted ? '已完成' : '失败'}
          </Tag>
          {elapsed !== null && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {formatDuration(elapsed)}
            </Text>
          )}
        </div>

        {/* 失败信息 */}
        {step.error && isFailed && (
          <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}
            ellipsis={{ tooltip: step.error }}>
            {step.error}
          </Text>
        )}

        {/* 结构化详情 */}
        {hasDetail && isCompleted && (
          <div style={{ marginTop: 4 }}>
            <Text
              type="secondary"
              style={{ fontSize: 12, cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown size={14}
                style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              {expanded ? '收起输出数据' : '查看输出数据'}
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
                  <DetailView detail={step.detail} />
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

  const steps = staticSteps && staticSteps.length > 0 ? staticSteps : liveSteps
  const isStatic = staticSteps && staticSteps.length > 0

  // 实时模式：SSE 订阅
  useEffect(() => {
    if (!executionId || isStatic) return
    setLiveSteps([]); setSummary(''); setFinished(false)

    const ctrl = subscribeExecution(executionId, {
      onStep: (data) => {
        setLiveSteps((prev) => {
          const idx = prev.findIndex((s) => s.step_id === data.step_id)
          if (idx >= 0) {
            const updated = [...prev]; updated[idx] = data; return updated
          }
          return [...prev, data]
        })
      },
      onProgress: (data) => {
        setLiveSteps((prev) => prev.map((s) =>
          s.step_id === data.step_id ? { ...s, progress: data.progress } : s))
      },
      onFinish: (data: AgentFinishEvent) => {
        setLiveSteps(data.steps || [])
        setSummary(data.summary)
        setFinished(true)
        onComplete?.(data.status === 'completed')
      },
      onError: () => { setFinished(true); onComplete?.(false) },
    })
    controllerRef.current = ctrl
    return () => { ctrl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId, isStatic])

  if (!executionId && (!staticSteps || staticSteps.length === 0)) return null

  return (
    <div style={{
      background: BG,
      borderRadius: 10,
      border: '1px solid var(--color-border-light, #E8E4D8)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      padding: compact ? 12 : 20,
      maxHeight,
      overflowY: 'auto',
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: compact ? 10 : 16,
        paddingBottom: compact ? 8 : 12,
        borderBottom: `1px solid rgba(196,162,101,0.2)`,
      }}>
        <Text strong style={{
          fontSize: compact ? 14 : 16,
          color: INK,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <FlaskConical size={compact ? 16 : 18} color={GOLD} />
          AI 分析过程
        </Text>
        {finished && (
          <Tag color={summary.includes('失败') ? 'error' : 'success'} style={{ fontSize: 12 }}>
            {summary || (steps.length > 0 ? `共 ${steps.length} 步` : '')}
          </Tag>
        )}
      </div>

      {/* 步骤列表 */}
      {steps.length === 0 && !finished && (
        <div style={{ textAlign: 'center', padding: compact ? 16 : 24 }}>
          <Loader2 size={20} color={GOLD} className="animate-spin" />
          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
            等待 Agent 执行...
          </Text>
        </div>
      )}

      {steps.map((step, i) => (
        <StepItem key={(step as any).id || step.step_id || i} step={step} index={i}
          isLast={i === steps.length - 1 && (isStatic || finished)} compact={compact} />
      ))}

      {/* 底部耗时 */}
      {finished && steps.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          style={{
            marginTop: 12, paddingTop: 10,
            borderTop: `1px solid rgba(196,162,101,0.15)`,
            textAlign: 'right',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            总耗时{' '}
            {steps[0].start_time && steps[steps.length - 1].end_time
              ? formatDuration(
                  new Date(steps[steps.length - 1].end_time!).getTime() -
                  new Date(steps[0].start_time!).getTime())
              : '—'}
          </Text>
        </motion.div>
      )}
    </div>
  )
}
