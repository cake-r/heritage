/** Story Mode — 沉浸式探索页面（增强版：每步结果实时可视化） */
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Progress, Card, Tag, Typography, Result, Spin, message, Collapse } from 'antd'
import {
  Play,
  Pause,
  RefreshCw,
  Home,
  Trophy,
  Image,
  FlaskConical,
  Zap,
  GitBranch,
  Target,
  Medal,
  Ruler,
  ClipboardList,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import AgentTimeline from '../../components/common/AgentTimeline'
import {
  startStoryMode,
  type DemoStepEvent,
  type DemoFinishEvent,
  type DemoErrorEvent,
} from '../../services/storyMode'
import { normalizeImageUrl } from '../../utils/imageUrl'
import { MountainMistPattern } from '../../components/decoration'
import { Icon } from '../../config/icons'
import { useTheme } from '../../contexts/ThemeContext'

const { Title, Paragraph, Text } = Typography

// 主题色（亮/暗双模式通用）
const GOLD = '#C4A265'
const VERMILION = '#B8463A'

/** 主题感知颜色 hook —— 各组件内调用，返回亮/暗双模式色值 */
function useStoryColors() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return {
    isDark,
    /** 页面背景色: 暗 #1a1a2e / 亮 #F7F4ED */
    bg: isDark ? '#1a1a2e' : '#F7F4ED',
    /** 卡片背景色: 暗 #16213e / 亮 #FFFDF9 */
    cardBg: isDark ? '#16213e' : '#FFFDF9',
    /** 正文色: 暗 #e0d5c1 / 亮 #2C241A */
    text: isDark ? '#e0d5c1' : '#2C241A',
    /** 背景渐变中点: 暗 #0f3460 / 亮 #d4c9b5 */
    gradientMid: isDark ? '#0f3460' : '#d4c9b5',
    /** 半透明叠加层：暗为白色半透 / 亮为黑色半透 */
    overlay: (alpha: number) => isDark ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`,
    /** 辅助文字色: 暗 #999 / 亮 #777 */
    secondaryText: isDark ? '#999' : '#777',
  }
}

// 步骤图标
const STEP_ICONS: Record<string, string> = {
  load_sample: 'image',
  recognize: 'search',
  damage_analysis: 'microscope',
  restoration: 'gem',
  pattern_analysis: 'git-branch',
  generation: 'palette',
  passport_update: 'medal',
  report: 'clipboard-list',
}

interface StepState {
  step_id: string
  title: string
  icon: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  progress: number
  output_data?: any
  error?: string
}

export default function StoryModePage() {
  const [phase, setPhase] = useState<'idle' | 'running' | 'finished'>('idle')
  const [steps, setSteps] = useState<StepState[]>([])
  const [currentStepId, setCurrentStepId] = useState<string>('')
  const [overallProgress, setOverallProgress] = useState(0)
  const [report, setReport] = useState<DemoFinishEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const navigate = useNavigate()
  const { bg, cardBg, text, gradientMid, overlay } = useStoryColors()

  const updateStep = useCallback((stepId: string, update: Partial<StepState>) => {
    setSteps(prev => prev.map(s =>
      s.step_id === stepId ? { ...s, ...update } : s
    ))
  }, [])

  const addStep = useCallback((event: DemoStepEvent) => {
    setSteps(prev => {
      if (prev.find(s => s.step_id === event.step_id)) return prev
      return [...prev, {
        step_id: event.step_id,
        title: event.title,
        icon: event.icon,
        status: 'pending' as const,
        progress: 0,
      }]
    })
  }, [])

  const handleStart = () => {
    setPhase('running')
    setSteps([])
    setOverallProgress(0)
    setReport(null)
    setError(null)

    const controller = startStoryMode({
      onStep: (event) => {
        addStep(event)
        setCurrentStepId(event.step_id)
        updateStep(event.step_id, { status: 'running', progress: 0 })
      },
      onProgress: (stepId, progress, _message) => {
        updateStep(stepId, { progress })
      },
      onStepResult: (event) => {
        updateStep(event.step_id, {
          status: event.status === 'completed' ? 'completed' : 'failed',
          progress: 100,
          output_data: event.output_data,
          error: event.error,
        })
        setSteps(prev => {
          const completed = prev.filter(s => s.status === 'completed').length + 1
          const total = prev.length || 8
          setOverallProgress(Math.round((completed / total) * 100))
          return prev
        })
      },
      onError: (event: DemoErrorEvent) => {
        updateStep(event.step_id, { status: 'skipped', error: event.error })
        message.warning(`${STEP_ICONS[event.step_id] || ''} ${event.step_id} 已跳过`)
      },
      onFinish: (event) => {
        setPhase('finished')
        setReport(event)
        setOverallProgress(100)
        message.success('探索之旅完成！')
      },
      onFatal: (err) => {
        setPhase('idle')
        setError(err)
        message.error(`演示中断: ${err}`)
      },
    })
    controllerRef.current = controller
  }

  const handleStop = () => {
    controllerRef.current?.abort()
    setPhase('idle')
    message.info('演示已停止')
  }

  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
    }
  }, [])

  // 找到当前进行中或最新完成的步骤
  const activeStep = steps.find(s => s.step_id === currentStepId || s.status === 'running')
    || [...steps].reverse().find(s => s.status === 'completed')

  // 构建 AgentTimeline 所需的步骤数据
  const agentSteps = steps.map(s => ({
    execution_id: 'story-mode',
    step_id: s.step_id,
    title: s.title,
    description: '',
    status: (s.status === 'skipped' ? 'failed' : s.status) as 'pending' | 'running' | 'completed' | 'failed',
    progress: s.progress,
    icon: s.icon || STEP_ICONS[s.step_id] || '',
    start_time: null,
    end_time: null,
    detail: null,
    error: s.error || null,
  }))

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${bg} 0%, ${gradientMid} 50%, ${bg} 100%)`,
      padding: '24px 24px 40px',
      color: text,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <MountainMistPattern opacity={0.16} />
      <div style={{ maxWidth: 1100, width: '100%' }}>
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 24 }}
        >
          <Title level={1} style={{
            color: GOLD,
            fontFamily: 'var(--font-display)',
            fontSize: '4.2rem',
            letterSpacing: 8,
            marginBottom: 8,
            marginTop: -120,
          }}>
            非遗探索之旅
          </Title>
          <Paragraph style={{ color: text, fontSize: '1.4rem', opacity: 0.7, marginBottom: 0 }}>
            跟随 AI 向导，沉浸式体验文物识别、修复、纹样解析与文创生成的全流程
          </Paragraph>
        </motion.div>

        {/* Idle 状态 */}
        {phase === 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            style={{ textAlign: 'center' }}
          >
            {error && (
              <Card style={{
                background: 'rgba(184,70,58,0.15)',
                border: `1px solid ${VERMILION}`,
                marginBottom: 24,
              }}>
                <Text style={{ color: VERMILION }}>{error}</Text>
              </Card>
            )}
            <Button
              type="primary"
              size="large"
              icon={<Play size={34} />}
              onClick={handleStart}
              style={{
                height: 72,
                paddingInline: 64,
                fontSize: '1.6rem',
                borderRadius: 32,
                background: `linear-gradient(135deg, ${GOLD}, ${VERMILION})`,
                border: 'none',
                boxShadow: `0 4px 24px rgba(196,162,101,0.4)`,
              }}
            >
              开始探索
            </Button>
            <div style={{ marginTop: 16 }}>
              <Button
                type="link"
                icon={<Home size={26} />}
                onClick={() => navigate('/')}
                style={{ color: text, opacity: 0.6, fontSize: 20 }}
              >
                返回首页
              </Button>
            </div>
          </motion.div>
        )}

        {/* Running 状态：双栏布局 */}
        {phase === 'running' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* 进度条 */}
            <Card style={{
              background: cardBg,
              border: `1px solid ${GOLD}40`,
              marginBottom: 20,
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ color: GOLD, fontSize: '1.4rem' }}>
                  {currentStepId
                    ? <><Icon name={STEP_ICONS[currentStepId] || 'pin'} size={18} style={{ marginRight: 6 }} />{steps.find(s => s.step_id === currentStepId)?.title || ''}</>
                    : '准备中...'}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Tag color="processing">{overallProgress}%</Tag>
                  <Button danger size="small" icon={<Pause />} onClick={handleStop} ghost>
                    停止
                  </Button>
                </div>
              </div>
              <Progress
                percent={overallProgress}
                strokeColor={{ '0%': GOLD, '100%': VERMILION }}
                trailColor={overlay(0.1)}
                showInfo={false}
              />
            </Card>

            {/* 双栏：左侧可视化预览 + 右侧步骤时间线 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
              {/* 左侧 —— 当前步骤可视化输出 */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep?.step_id || 'empty'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                >
                  <StepVisualPreview step={activeStep} />
                </motion.div>
              </AnimatePresence>

              {/* 右侧 —— AgentTimeline */}
              <Card style={{
                background: cardBg,
                border: `1px solid ${GOLD}30`,
                borderRadius: 12,
                maxHeight: 'calc(100vh - 220px)',
                overflow: 'auto',
              }}>
                <AgentTimeline steps={agentSteps} compact />
              </Card>
            </div>
          </motion.div>
        )}

        {/* Finished 状态 */}
        {phase === 'finished' && report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Result
              status="success"
              title={<span style={{ color: GOLD }}>探索之旅完成！</span>}
              subTitle={
                <span style={{ color: text }}>
                  共 {report.report.total_steps} 个步骤，
                  成功 {report.report.completed_steps} 个，
                  耗时 {report.report.total_duration_s} 秒
                </span>
              }
            />

            {/* 报告摘要 */}
            <Card style={{
              background: cardBg,
              border: `1px solid ${GOLD}40`,
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <Title level={4} style={{ color: GOLD, marginBottom: 16 }}>
                <ClipboardList size={20} style={{ marginRight: 8 }} />
                探索报告
              </Title>
              <Paragraph style={{ color: text, fontSize: '1.4rem' }}>
                {report.summary}
              </Paragraph>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {report.report.highlights.map((h, i) => (
                  <Tag key={i} color={(h as string).includes('完成') ? 'success' : 'warning'}>{(h as string).replace(/^[✅]\s*/, '').trim()}</Tag>
                ))}
              </div>
            </Card>

            {/* 步骤明细（含输出数据） */}
            <Card style={{
              background: cardBg,
              border: `1px solid ${GOLD}30`,
              borderRadius: 12,
              marginBottom: 24,
            }}>
              <Title level={5} style={{ color: text, marginBottom: 16 }}>步骤明细</Title>
              {steps.map((s) => (
                <div key={s.step_id} style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 0',
                  }}>
                    <Icon name={s.icon || STEP_ICONS[s.step_id] || 'pin'} size={32} />
                    <span style={{ flex: 1, color: text }}>{s.title}</span>
                    <Tag color={
                      s.status === 'completed' ? 'success' :
                      s.status === 'skipped' ? 'warning' : 'error'
                    }>
                      {s.status === 'completed' ? '完成' :
                       s.status === 'skipped' ? '跳过' : '失败'}
                    </Tag>
                  </div>
                  {s.output_data && s.status === 'completed' && (
                    <div style={{ marginLeft: 32 }}>
                      <Collapse
                        size="small"
                        ghost
                        items={[{
                          key: s.step_id + '-detail',
                          label: <Text style={{ color: GOLD, fontSize: 17 }}>查看输出数据</Text>,
                          children: <StepOutputRenderer stepId={s.step_id} data={s.output_data} />,
                        }]}
                      />
                    </div>
                  )}
                </div>
              ))}
            </Card>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button icon={<RefreshCw size={24} />} onClick={handleStart} style={{ borderColor: GOLD, color: GOLD, fontSize: 19, height: 48 }}>
                再来一次
              </Button>
              <Button icon={<Trophy size={24} />} onClick={() => navigate('/passport')} style={{ borderColor: GOLD, color: GOLD, fontSize: 19, height: 48 }}>
                查看护照
              </Button>
              <Button icon={<Home size={24} />} onClick={() => navigate('/')} style={{ color: text, fontSize: 19 }} type="link">
                返回首页
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ==================== 可视化组件 ====================

/** 当前步骤的实时预览面板 */
function StepVisualPreview({ step }: { step?: StepState }) {
  const { cardBg, text, overlay } = useStoryColors()
  if (!step) {
    return (
      <Card style={{
        background: cardBg,
        border: `1px solid ${GOLD}20`,
        borderRadius: 12,
        minHeight: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', opacity: 0.6 }}>
          <Zap size={64} color={GOLD} />
          <Paragraph style={{ color: text, marginTop: 16, fontSize: '1.3rem' }}>等待 AI 执行...</Paragraph>
        </div>
      </Card>
    )
  }

  if (step.status === 'running' && !step.output_data) {
    return (
      <Card style={{
        background: cardBg,
        border: `1px solid ${GOLD}20`,
        borderRadius: 12,
        minHeight: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <Paragraph style={{ color: text, marginTop: 16, fontSize: '1.3rem' }}>
            <Icon name={step.icon} size={16} style={{ marginRight: 6 }} />{step.title}
          </Paragraph>
          {step.progress > 0 && (
            <Progress percent={step.progress} size="small" strokeColor={GOLD} trailColor={overlay(0.1)} />
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card
      title={
        <span style={{ color: GOLD }}>
          <Icon name={step.icon} size={16} style={{ marginRight: 6 }} />{step.title}
          <Tag color={step.status === 'completed' ? 'success' : 'error'} style={{ marginLeft: 8 }}>
            {step.status === 'completed' ? '已完成' : '失败'}
          </Tag>
        </span>
      }
      style={{
        background: cardBg,
        border: `1px solid ${GOLD}30`,
        borderRadius: 12,
      }}
    >
      <StepOutputRenderer stepId={step.step_id} data={step.output_data} />
    </Card>
  )
}

/** 根据步骤类型渲染不同的可视化输出 */
function StepOutputRenderer({ stepId, data }: { stepId: string; data: any }) {
  const { text } = useStoryColors()
  if (!data) return <Text type="secondary" style={{ color: text }}>无输出数据</Text>

  switch (stepId) {
    case 'recognize':
      return <RecognitionOutput data={data} />
    case 'damage_analysis':
      return <DamageOutput data={data} />
    case 'restoration':
      return <RestorationOutput data={data} />
    case 'pattern_analysis':
      return <PatternOutput data={data} />
    case 'generation':
      return <GenerationOutput data={data} />
    case 'passport_update':
      return <PassportOutput data={data} />
    case 'report':
      return <ReportOutput data={data} />
    default:
      return <JsonDebug data={data} />
  }
}

function RecognitionOutput({ data }: { data: any }) {
  const { text, overlay } = useStoryColors()
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Tag color="#B8463A" style={{ fontSize: 18, padding: '4px 16px' }}>
          {data.category || '未知'}
        </Tag>
        {data.confidence != null && (
          <Tag color="blue">置信度 {(data.confidence * 100).toFixed(1)}%</Tag>
        )}
      </div>
      {data.features?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ color: GOLD, display: 'block', marginBottom: 6 }}>特征识别</Text>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.features.map((f: string) => (
              <Tag key={f} color="gold">{f}</Tag>
            ))}
          </div>
        </div>
      )}
      {data.pattern_names?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ color: GOLD, display: 'block', marginBottom: 6 }}>纹样基因</Text>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.pattern_names.map((p: string) => (
              <Tag key={p} color="purple">{p}</Tag>
            ))}
          </div>
        </div>
      )}
      {data.raw_description && (
        <div style={{
          background: overlay(0.05),
          borderRadius: 8,
          padding: 12,
          borderLeft: `3px solid ${GOLD}`,
        }}>
          <Text style={{ color: text, fontSize: 17, lineHeight: 1.8 }}>
            {data.raw_description}
          </Text>
        </div>
      )}
    </div>
  )
}

function DamageOutput({ data }: { data: any }) {
  const { text } = useStoryColors()
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text strong style={{ color: GOLD }}>损伤程度：</Text>
        <Tag color={data.severity === '重度' ? 'red' : data.severity === '中度' ? 'orange' : 'gold'}>
          {data.severity || '未知'}
        </Tag>
      </div>
      {data.damage_types?.length > 0 && (
        <div>
          <Text strong style={{ color: GOLD, display: 'block', marginBottom: 8 }}>损伤类型</Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {data.damage_types.map((d: string) => (
              <Card key={d} size="small" style={{
                background: 'rgba(184,70,58,0.15)',
                border: `1px solid ${VERMILION}40`,
                borderRadius: 8,
              }}>
                <Text style={{ color: VERMILION }}>{d}</Text>
              </Card>
            ))}
          </div>
        </div>
      )}
      {data.regions?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ color: GOLD, display: 'block', marginBottom: 6 }}>受损区域</Text>
          <Text style={{ color: text, fontSize: 17 }}>
            {data.regions.length} 处损伤区域已标记
          </Text>
        </div>
      )}
    </div>
  )
}

function RestorationOutput({ data }: { data: any }) {
  const { text, overlay, secondaryText } = useStoryColors()
  const steps = data.pipeline_steps || []
  return (
    <div>
      {steps.map((s: any, i: number) => (
        <div key={i} style={{
          marginBottom: 12,
          padding: 12,
          background: overlay(0.04),
          borderRadius: 8,
          border: `1px solid ${overlay(0.06)}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Tag color={s.status === 'completed' ? 'success' : 'default'}>
              步骤 {s.step || i + 1}
            </Tag>
            <Text strong style={{ color: text }}>{s.name}</Text>
            <Tag>{s.status === 'completed' ? '已完成' : '进行中'}</Tag>
          </div>
          {/* 修复验证分数 */}
          {s.result?.scores && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {Object.entries(s.result.scores as Record<string, number>).map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <Text style={{ color: secondaryText, fontSize: 15, display: 'block' }}>
                    {k === 'detail_fidelity' ? '细节保真' :
                     k === 'style_consistency' ? '风格一致' :
                     k === 'restoration_completeness' ? '修复完整' :
                     k === 'pattern_similarity' ? '纹样相似' :
                     k === 'texture_naturalness' ? '纹理自然' : k}
                  </Text>
                  <Text strong style={{
                    color: v >= 80 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f',
                    fontSize: 18,
                  }}>
                    {v}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PatternOutput({ data }: { data: any }) {
  const { text, overlay } = useStoryColors()
  const analysis = data.analysis || {}
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {analysis.motif_type && (
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <GitBranch size={42} color={GOLD} />
            <Text style={{ color: GOLD, fontSize: 16 }}>纹样类型</Text>
            <div><Text strong style={{ color: text }}>{analysis.motif_type}</Text></div>
          </div>
        )}
        {analysis.symmetry && (
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <Ruler size={36} color={GOLD} />
            <Text style={{ color: GOLD, fontSize: 14 }}>构图形式</Text>
            <div><Text strong style={{ color: text }}>{analysis.symmetry}</Text></div>
          </div>
        )}
        {analysis.composition && (
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <Target size={36} color={GOLD} />
            <Text style={{ color: GOLD, fontSize: 14 }}>布局结构</Text>
            <div><Text strong style={{ color: text }}>{analysis.composition}</Text></div>
          </div>
        )}
      </div>
      {data.commentary && (
        <div style={{
          background: overlay(0.05),
          borderRadius: 8,
          padding: 12,
          borderLeft: `3px solid ${GOLD}`,
        }}>
          <Text strong style={{ color: GOLD, display: 'block', marginBottom: 6 }}>🎤 AI 文化解读</Text>
          <Text style={{ color: text, fontSize: 17, lineHeight: 1.8 }}>
            {data.commentary}
          </Text>
        </div>
      )}
    </div>
  )
}

function GenerationOutput({ data }: { data: any }) {
  const { text, overlay } = useStoryColors()
  const images: string[] = data.images || []
  return (
    <div style={{ textAlign: 'center' }}>
      {images.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {images.map((img: string, i: number) => (
            <Card key={i} size="small" style={{
              background: overlay(0.03),
              border: `1px solid ${GOLD}30`,
              borderRadius: 8,
            }}>
              <img
                src={normalizeImageUrl(img)}
                alt={`文创生成 ${i + 1}`}
                style={{
                  width: '100%',
                  borderRadius: 6,
                  maxHeight: 250,
                  objectFit: 'cover',
                }}
              />
            </Card>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Image style={{ fontSize: 48, color: GOLD, opacity: 0.5 }} />
          <Paragraph style={{ color: text, marginTop: 12 }}>
            AI 文创作品生成中...
          </Paragraph>
          <Tag color={GOLD}>种子: {data.seed || 'N/A'}</Tag>
        </div>
      )}
    </div>
  )
}

function PassportOutput({ data }: { data: any }) {
  const { text } = useStoryColors()
  return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <Medal size={96} color={GOLD} style={{ marginBottom: 12 }} />
      </motion.div>
      <Title level={4} style={{ color: GOLD }}>成就印章已颁发</Title>
      <Paragraph style={{ color: text }}>
        探索成就已记录至你的数字护照
      </Paragraph>
      {data.message && (
        <Tag color="success">{data.message}</Tag>
      )}
    </div>
  )
}

function ReportOutput({ data }: { data: any }) {
  return (
    <div style={{
      background: 'rgba(74,144,226,0.1)',
      borderRadius: 8,
      padding: 16,
      border: '1px solid rgba(74,144,226,0.3)',
    }}>
      <Text style={{ color: '#1890ff', fontSize: 18, lineHeight: 1.8 }}>
        {data.message || data.summary || '探索报告已生成'}
      </Text>
    </div>
  )
}

function JsonDebug({ data }: { data: any }) {
  const { overlay, secondaryText } = useStoryColors()
  return (
    <pre style={{
      color: secondaryText,
      fontSize: 16,
      maxHeight: 300,
      overflow: 'auto',
      background: overlay(0.03),
      padding: 12,
      borderRadius: 6,
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
