import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Card, Upload, Typography, Spin, Tag, Button,
  Row, Col, Space, message, Steps, Progress, Tabs, Empty, Divider, Tooltip,
} from 'antd'
import {
  Inbox, RefreshCw, Download,
  XCircle,
  Wrench, Lightbulb, Image, ShieldCheck,
  ArrowLeftRight, Trophy, Star, Eye,
} from 'lucide-react'
import type { TabsProps } from 'antd'
import {
  uploadAndRestore, getDetail, getHistory,
  type RestorationResult, type RestorationListItem,
  type PipelineStep,
} from '../../services/restoration'
import { normalizeImageUrl } from '../../utils/imageUrl'
import ExplainPanel from '../../components/common/ExplainPanel'
import { RestorationMuralPattern } from '../../components/decoration'

const { Dragger } = Upload
const { Title, Text, Paragraph } = Typography

type PageStep = 'upload' | 'running' | 'complete' | 'error'

// ==================== AI 修复能力说明 ====================

const AI_CAPABILITIES = [
  { icon: '🔪', type: '划痕修复', label: '划痕修复', stars: 5, desc: '纸张/布面表面划痕的智能填补与纹理还原' },
  { icon: '🎨', type: '褪色修复', label: '褪色修复', stars: 4, desc: '恢复因光照氧化而褪色的区域，还原原始色彩层次' },
  { icon: '🧩', type: '缺损补全', label: '缺损补全', stars: 3, desc: '根据周围纹样推断并补全缺失的图案与结构' },
  { icon: '💧', type: '污渍去除', label: '污渍去除', stars: 4, desc: '去除水渍、霉斑、尘垢，同时保留底层纹理' },
  { icon: '📐', type: '褶皱展平', label: '褶皱展平', stars: 3, desc: '数字化展平卷曲与折叠区域，恢复平面形态' },
  { icon: '🔍', type: '细节增强', label: '细节增强', stars: 5, desc: '提升低分辨率/模糊区域的清晰度与辨识度' },
]

// ============================================================
// Sub-components
// ============================================================

/** 损伤分析卡 */
function DamageCard({ result }: { result: Record<string, any> }) {
  const severityColor: Record<string, string> = {
    '轻度': '#52c41a',
    '中度': '#faad14',
    '重度': '#ff4d4f',
  }
  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Tag color="#B8463A">{result.category}</Tag>
        <Tag color={severityColor[result.severity] || 'default'}>{result.severity}</Tag>
        {result.damage_types?.map((t: string) => (
          <Tag key={t} color="orange">{t}</Tag>
        ))}
      </Space>
      <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 14 }}>
        {result.description}
      </Paragraph>
    </div>
  )
}

/** 修复方案卡 */
function PromptCard({ result }: { result: Record<string, any> }) {
  return (
    <div style={{
      background: 'var(--color-paper)',
      border: '1px solid var(--color-border-light)',
      borderRadius: 8,
      padding: 16,
    }}>
      <Text style={{
        fontSize: 'var(--text-sm)',
        lineHeight: 1.8,
        whiteSpace: 'pre-wrap',
        fontFamily: 'var(--font-body)',
        color: 'var(--color-ink-secondary)',
      }}>
        {result.prompt}
      </Text>
    </div>
  )
}

/** 图像修复卡 */
function ImageRestoredCard({ result }: { result: Record<string, any> }) {
  return (
    <div>
      <Row gutter={16}>
        {result.images?.map((url: string, i: number) => (
          <Col key={i} xs={24} sm={12}>
            <img
              src={url}
              alt={`修复结果 ${i + 1}`}
              style={{ width: '100%', borderRadius: 8, border: '1px solid var(--color-border-light)' }}
            />
          </Col>
        ))}
      </Row>
      {result.seed && (
        <Text type="secondary" style={{ fontSize: 'var(--text-xs)', marginTop: 8, display: 'block' }}>
          Seed: {result.seed}
        </Text>
      )}
    </div>
  )
}

/** 修复验证卡 */
function VerificationCard({ result }: { result: Record<string, any> }) {
  const score = result.overall_score || 0
  const dims = result.dimensions || {}
  const scoreColor = score >= 85 ? '#52c41a' : score >= 70 ? '#faad14' : '#ff4d4f'

  return (
    <div>
      <Row gutter={24} align="middle">
        <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
          <Progress
            type="circle"
            percent={score}
            size={120}
            strokeColor={scoreColor}
            format={(p) => <span style={{ fontSize: 28, fontWeight: 700, color: scoreColor }}>{p}</span>}
          />
          <div style={{ marginTop: 8 }}>
            <Text strong style={{ fontSize: 16 }}>综合评分</Text>
          </div>
        </Col>
        <Col xs={24} sm={16}>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>细节保真度</Text>
            <Progress percent={dims.detail_fidelity || 0} size="small" strokeColor="var(--color-vermilion)" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>风格一致性</Text>
            <Progress percent={dims.style_consistency || 0} size="small" strokeColor="var(--color-gold)" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>损伤修复完整度</Text>
            <Progress percent={dims.restoration_completeness || 0} size="small" strokeColor="#2C241A" />
          </div>
        </Col>
      </Row>
      <Divider style={{ margin: '16px 0' }} />
      <Paragraph style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)', marginBottom: 12 }}>
        {result.verdict}
      </Paragraph>
      {result.artifacts?.length > 0 && (
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>检测到的伪影:</Text>
          <div style={{ marginTop: 4 }}>
            {result.artifacts.map((a: string, i: number) => (
              <Tag key={i} color="warning" style={{ marginBottom: 4 }}>{a}</Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** 叠加滑块对比 */
function OverlaySlider({ original, restored }: { original: string; restored: string }) {
  const [position, setPosition] = useState(50)

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ width: '100%', aspectRatio: '1', overflow: 'hidden', borderRadius: 8 }}>
        <img src={restored} alt="修复后" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        clipPath: `inset(0 ${100 - position}% 0 0)`,
      }}>
        <div style={{ width: '100%', aspectRatio: '1', overflow: 'hidden', borderRadius: 8 }}>
          <img src={original} alt="原始图" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          padding: '2px 8px', borderRadius: 4, fontSize: 'var(--text-xs)',
        }}>
          原始
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 8, right: 8,
        background: 'rgba(0,0,0,0.6)', color: '#fff',
        padding: '2px 8px', borderRadius: 4, fontSize: 'var(--text-xs)',
      }}>
        修复
      </div>
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: `${position}%`,
        width: 3, background: 'var(--color-paper-white)',
        boxShadow: '0 0 8px rgba(0,0,0,0.3)',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />
      <input
        type="range"
        min={5}
        max={95}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        style={{
          position: 'absolute', bottom: -24,
          left: 0, right: 0,
          width: '100%', margin: 0,
          cursor: 'pointer',
          accentColor: 'var(--color-vermilion)',
        }}
      />
    </div>
  )
}

// ============================================================
// Main Page
// ============================================================

const STEP_ICONS = [
  <Lightbulb key={1} />,
  <Wrench key={2} />,
  <Image key={3} />,
  <ShieldCheck key={4} />,
]

const STEP_MODELS = ['qwen-vl-max', 'deepseek-chat', 'wan2.5-i2i-preview', 'qwen-vl-max']

function renderStepResult(step: PipelineStep) {
  if (!step.result || step.status !== 'completed') return null
  switch (step.step) {
    case 1: return <DamageCard result={step.result} />
    case 2: return <PromptCard result={step.result} />
    case 3: return <ImageRestoredCard result={step.result} />
    case 4: return <VerificationCard result={step.result} />
    default: return null
  }
}

export default function DigitalRestoration() {
  const [step, setStep] = useState<PageStep>('upload')
  const [result, setResult] = useState<RestorationResult | null>(null)
  const [previewImage, setPreviewImage] = useState<string>('')
  const [visibleSteps, setVisibleSteps] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // 修复案例画廊 & 排行榜
  const [galleryItems, setGalleryItems] = useState<RestorationListItem[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [leaderboard, setLeaderboard] = useState<RestorationListItem[]>([])

  // 支持 ?id=xxx 从个人中心跳转查看详情
  useEffect(() => {
    const idParam = searchParams.get('id')
    if (idParam) {
      const id = parseInt(idParam, 10)
      if (!isNaN(id)) {
        setStep('running')
        setErrorMsg('')
        setVisibleSteps(0)
        getDetail(id).then(data => {
          setResult(data)
          setPreviewImage(data.original_image_url)
          setStep('complete')
        }).catch(err => {
          setErrorMsg(err.response?.data?.detail || err.message || '加载修复记录失败')
          setStep('error')
        })
      }
    }
  }, [searchParams])

  // 获取修复历史用于画廊和排行榜
  useEffect(() => {
    if (step === 'upload') {
      setGalleryLoading(true)
      getHistory(1, 20)
        .then(data => {
          const items = data?.items || []
          // 只展示成功完成的修复
          const completed = items.filter(
            (item: RestorationListItem) => item.pipeline_status === 'completed' && item.restored_image_url
          )
          setGalleryItems(completed.slice(0, 6))

          // 排行榜：按修复评分排序
          const scored = completed
            .filter((item: RestorationListItem) => item.verification_score != null)
            .sort((a: RestorationListItem, b: RestorationListItem) => (b.verification_score || 0) - (a.verification_score || 0))
          setLeaderboard(scored.slice(0, 3))
        })
        .catch(() => {
          // 静默失败
        })
        .finally(() => setGalleryLoading(false))
    }
  }, [step])

  // Sequential step reveal animation
  useEffect(() => {
    if (step === 'complete' && result) {
      setVisibleSteps(0)
      const total = result.pipeline_steps.length
      const timers: ReturnType<typeof setTimeout>[] = []
      for (let i = 1; i <= total; i++) {
        timers.push(setTimeout(() => setVisibleSteps(i), i * 800))
      }
      return () => timers.forEach(clearTimeout)
    }
  }, [step, result])

  // 加载修复详情
  const loadDetail = async (id: number) => {
    setStep('running')
    setErrorMsg('')
    setVisibleSteps(0)
    try {
      const data = await getDetail(id)
      setResult(data)
      setPreviewImage(data.original_image_url)
      setStep('complete')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || '加载修复记录失败')
      setStep('error')
    }
  }

  const handleUpload = async (file: RcFile) => {
    const rawFile = file as unknown as File

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const fileType = rawFile.type || ''
    if (!allowedTypes.includes(fileType)) {
      message.error('请上传 JPG / PNG / WebP 格式的图片')
      return false
    }
    if ((rawFile.size || 0) > 10 * 1024 * 1024) {
      message.error('图片大小不能超过 10MB')
      return false
    }

    const previewUrl = URL.createObjectURL(rawFile)
    setPreviewImage(previewUrl)
    setStep('running')
    setErrorMsg('')
    setVisibleSteps(0)

    try {
      const data = await uploadAndRestore(rawFile)
      setResult(data)
      setStep('complete')
      window.dispatchEvent(new CustomEvent('cultivation:check'))
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || '修复失败，请重试'
      setErrorMsg(msg)
      setStep('error')
      message.error(msg)
    }

    return false
  }

  const handleRetry = () => {
    setResult(null)
    setErrorMsg('')
    setVisibleSteps(0)
    setStep('upload')
  }

  const handleDownload = useCallback(() => {
    if (result?.restored_image_url) {
      const a = document.createElement('a')
      a.href = result.restored_image_url
      a.download = 'restored_image.png'
      a.click()
    }
  }, [result])

  // Build Ant Design Steps items
  const stepItems = result?.pipeline_steps.map((s, i) => ({
    title: s.name,
    description: i < visibleSteps ? (
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          模型: {STEP_MODELS[i]}
        </Text>
        {s.status === 'failed' && (
          <div style={{ color: '#ff4d4f', marginTop: 4, fontSize: 12 }}>
            <XCircle /> {s.result?.error || '执行失败'}
          </div>
        )}
      </div>
    ) : undefined,
    status: i < visibleSteps
      ? (s.status === 'failed' ? 'error' as const : 'finish' as const)
      : (i === visibleSteps ? 'process' as const : 'wait' as const),
    icon: i < visibleSteps
      ? (s.status === 'failed' ? <XCircle /> : STEP_ICONS[i])
      : undefined,
  })) || []

  // Tabs for comparison view
  const comparisonTabs: TabsProps['items'] = [
    {
      key: 'overlay',
      label: <span><ArrowLeftRight /> 叠加对比</span>,
      children: result?.restored_image_url ? (
        <OverlaySlider original={result.original_image_url} restored={result.restored_image_url} />
      ) : (
        <Empty description="无修复图像" />
      ),
    },
    {
      key: 'side-by-side',
      label: <span>左右对比</span>,
      children: (
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Card size="small" title="原始图片" style={{ borderRadius: 8 }}>
              <img src={result?.original_image_url} alt="原始" style={{ width: '100%', borderRadius: 4 }} />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card size="small" title="修复图片" style={{ borderRadius: 8 }}>
              {result?.restored_image_url ? (
                <img src={result.restored_image_url} alt="修复" style={{ width: '100%', borderRadius: 4 }} />
              ) : (
                <Empty description="修复失败" />
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
  ]

  // 排行榜奖牌颜色
  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']
  const rankIcons = ['🥇', '🥈', '🥉']

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <RestorationMuralPattern opacity={0.28} />
      </div>
      <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>🏺 AI 文物数字修复</Title>
        {(step === 'complete' || step === 'error') && (
          <Button icon={<RefreshCw />} onClick={handleRetry}>重新修复</Button>
        )}
      </div>

      {/* 模式切换 Tabs */}
      <Tabs
        activeKey="one-click"
        style={{ marginBottom: 20 }}
        items={[
          {
            key: 'one-click',
            label: '一键修复',
          },
          {
            key: 'workbench',
            label: '协同修复',
          },
        ]}
        onChange={(key) => {
          if (key === 'workbench') {
            navigate('/restoration-workbench')
          }
        }}
      />

      {/* === 上传区 === */}
      {step === 'upload' && (
        <>
          <Card style={{ borderRadius: 12 }}>
            <Dragger
              accept="image/jpeg,image/png,image/webp"
              maxCount={1}
              beforeUpload={handleUpload as any}
              showUploadList={false}
              style={{ padding: 48 }}
            >
              <p className="ant-upload-drag-icon">
                <Inbox style={{ fontSize: 64, color: 'var(--color-vermilion)' }} />
              </p>
              <p style={{ fontSize: 18, marginTop: 16 }}>上传文物图片，AI 自动分析损伤并修复</p>
              <p style={{ color: '#999' }}>
                支持 JPG / PNG / WebP · 最大 10MB · 图片尺寸 ≥ 200px
              </p>
              <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)', marginTop: 16 }}>
                AI 将自动执行四步修复管道：损伤分析 → 修复方案生成 → AI图像修复 → 修复质量验证
              </p>
            </Dragger>
          </Card>

          {/* === 修复案例画廊 === */}
          <Card
            title={<span style={{ fontSize: 20 }}><Image style={{ marginRight: 8 }} />修复案例画廊</span>}
            style={{ borderRadius: 12, marginTop: 16 }}
          >
            {galleryLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin size="small" />
              </div>
            ) : galleryItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Image style={{ fontSize: 32, color: '#ccc', marginBottom: 8 }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 17 }}>
                    还没有修复记录，上传第一张文物图片开始体验 AI 修复
                  </Text>
                </div>
              </div>
            ) : (
              <Row gutter={[12, 12]}>
                {galleryItems.map(item => (
                  <Col key={item.id} xs={12} sm={8} md={6}>
                    <Tooltip title="点击查看修复详情">
                      <Card
                        hoverable
                        size="small"
                        style={{ borderRadius: 8 }}
                        onClick={() => loadDetail(item.id)}
                        cover={
                          <div style={{ position: 'relative', height: 100, overflow: 'hidden' }}>
                            {/* Before & After 双图并排 */}
                            <div style={{ display: 'flex', height: '100%' }}>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <img
                                  src={normalizeImageUrl(item.original_image_url)}
                                  alt="修复前"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <span style={{
                                  position: 'absolute', top: 2, left: 2,
                                  background: 'rgba(0,0,0,0.65)', color: '#fff',
                                  padding: '0 4px', borderRadius: 2, fontSize: 12,
                                }}>
                                  原图
                                </span>
                              </div>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <img
                                  src={normalizeImageUrl(item.restored_image_url!)}
                                  alt="修复后"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <span style={{
                                  position: 'absolute', top: 2, right: 2,
                                  background: 'rgba(184,70,58,0.8)', color: '#fff',
                                  padding: '0 4px', borderRadius: 2, fontSize: 12,
                                }}>
                                  修复
                                </span>
                              </div>
                            </div>
                          </div>
                        }
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Tag color="#B8463A" style={{ margin: 0, fontSize: 13 }}>
                            {item.damage_category || '未知类型'}
                          </Tag>
                          {item.verification_score != null && (
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              {item.verification_score}分
                            </Text>
                          )}
                        </div>
                      </Card>
                    </Tooltip>
                  </Col>
                ))}
              </Row>
            )}
          </Card>

          {/* === AI 修复能力 + 排行榜（并排） === */}
          <Row gutter={16} style={{ marginTop: 16 }}>
            {/* AI 修复能力说明 */}
            <Col xs={24} md={14}>
              <Card
                title={<span style={{ fontSize: 20 }}><Wrench style={{ marginRight: 8 }} />AI 修复能力</span>}
                style={{ borderRadius: 12, height: '100%' }}
              >
                <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 16 }}>
                  以下为 AI 修复管道支持的主要修复类型及效果评级（★ 越多效果越好）
                </Text>
                <Row gutter={[16, 12]}>
                  {AI_CAPABILITIES.map(cap => (
                    <Col key={cap.type} xs={12} sm={8}>
                      <div style={{
                        textAlign: 'center', padding: '12px 8px',
                        borderRadius: 8, background: 'var(--color-paper)',
                        border: '1px solid var(--color-border-light)',
                      }}>
                        <div style={{ fontSize: 28, marginBottom: 4 }}>{cap.icon}</div>
                        <Text strong style={{ fontSize: 17, display: 'block' }}>
                          {cap.label}
                        </Text>
                        <div style={{ margin: '4px 0' }}>
                          {Array.from({ length: 5 }, (_, i) => (
                            <span key={i} style={{
                              color: i < cap.stars ? '#faad14' : '#e8e4d8',
                              fontSize: 12,
                            }}>
                              {i < cap.stars ? <Star fill="#faad14" color="#faad14" size={16} /> : <Star size={16} />}
                            </span>
                          ))}
                        </div>
                        <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.5 }}>
                          {cap.desc}
                        </Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>

            {/* 修复效果排行榜 */}
            <Col xs={24} md={10}>
              <Card
                title={<span style={{ fontSize: 20 }}><Trophy style={{ marginRight: 8 }} />修复排行</span>}
                style={{ borderRadius: 12, height: '100%' }}
              >
                {leaderboard.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32 }}>
                    <Trophy style={{ fontSize: 32, color: '#ccc', marginBottom: 8 }} />
                    <div>
                      <Text type="secondary" style={{ fontSize: 17 }}>
                        完成修复后将出现在排行中
                      </Text>
                    </div>
                  </div>
                ) : (
                  <div>
                    {leaderboard.map((item, i) => (
                      <div
                        key={item.id}
                        onClick={() => loadDetail(item.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 8px', cursor: 'pointer',
                          borderRadius: 8,
                          transition: 'background 0.2s',
                          borderBottom: i < leaderboard.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-active, #FFF3E0)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* 排名 */}
                        <span style={{ fontSize: 22, width: 32, textAlign: 'center', flexShrink: 0 }}>
                          {rankIcons[i]}
                        </span>

                        {/* 缩略图 */}
                        <img
                          src={normalizeImageUrl(item.restored_image_url || item.original_image_url)}
                          alt=""
                          style={{
                            width: 44, height: 44, borderRadius: 6,
                            objectFit: 'cover', flexShrink: 0,
                            border: `2px solid ${rankColors[i]}`,
                          }}
                        />

                        {/* 信息 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text strong style={{ fontSize: 17, display: 'block' }}>
                            {item.damage_category || '未知类型'}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {new Date(item.created_at).toLocaleDateString('zh-CN')}
                          </Text>
                        </div>

                        {/* 评分 */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <Text strong style={{
                            fontSize: 20,
                            color: item.verification_score && item.verification_score >= 85
                              ? '#52c41a'
                              : item.verification_score && item.verification_score >= 70
                                ? '#faad14'
                                : 'var(--color-ink)',
                          }}>
                            {item.verification_score || '—'}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>分</Text>
                        </div>
                      </div>
                    ))}

                    {leaderboard.length > 0 && (
                      <div style={{ textAlign: 'center', marginTop: 12 }}>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => {
                            const win = window.open('/user-center/restoration', '_blank')
                            if (win) win.focus()
                          }}
                        >
                          <Eye /> 查看全部修复记录 →
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* 底部留白 */}
          <div style={{ height: 24 }} />
        </>
      )}

      {/* === 执行中 === */}
      {step === 'running' && (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <Title level={4} style={{ marginTop: 24 }}>AI 修复管道执行中...</Title>
          <div style={{ marginTop: 16, color: 'var(--color-ink-secondary)' }}>
            {previewImage && (
              <img
                src={previewImage}
                alt="预览"
                style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, marginBottom: 16, border: '1px solid var(--color-border-light)' }}
              />
            )}
            <div style={{ fontSize: 'var(--text-sm)', lineHeight: 2 }}>
              <div>🔍 步骤 1: 分析损伤类型与程度...</div>
              <div>💡 步骤 2: 生成修复方案...</div>
              <div>🎨 步骤 3: AI 执行图像修复...</div>
              <div>✅ 步骤 4: 验证修复质量...</div>
            </div>
          </div>
        </Card>
      )}

      {/* === 错误 === */}
      {step === 'error' && (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
          <XCircle style={{ fontSize: 48, color: '#ff4d4f' }} />
          <Title level={4} style={{ marginTop: 16 }}>修复失败</Title>
          <Text type="secondary">{errorMsg}</Text>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" icon={<RefreshCw />} onClick={handleRetry}>
              重试
            </Button>
          </div>
        </Card>
      )}

      {/* === 完成 === */}
      {step === 'complete' && result && (
        <>
          <Card style={{ borderRadius: 12, marginBottom: 24 }} title="🔬 AI 修复管道">
            <Steps
              direction="vertical"
              current={visibleSteps}
              items={stepItems}
              style={{ maxWidth: 600 }}
            />
            {result.pipeline_steps.map((s, i) =>
              i < visibleSteps && s.status === 'completed' ? (
                <div key={i} style={{ marginLeft: 38, marginBottom: 16, marginTop: -8 }}>
                  {renderStepResult(s)}
                </div>
              ) : null
            )}
          </Card>

          <Card
            style={{ borderRadius: 12, marginBottom: 24 }}
            title="🔄 修复前后对比"
            extra={
              result.restored_image_url && (
                <Button
                  type="primary"
                  ghost
                  icon={<Download />}
                  onClick={handleDownload}
                >
                  下载修复图
                </Button>
              )
            }
          >
            <Tabs defaultActiveKey="overlay" items={comparisonTabs} />
          </Card>

          {/* Phase C: XAI 推理路径可视化 */}
          <ExplainPanel module="restoration" recordId={result.id} compact />
        </>
      )}
    </div>
    </>
  )
}
