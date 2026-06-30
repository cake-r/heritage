import React, { useState, useEffect, useCallback } from 'react'
import {
  Card, Upload, Typography, Spin, Tag, Button,
  Row, Col, Space, message, Steps, Progress, Tabs, Descriptions, Empty, Divider,
} from 'antd'
import {
  InboxOutlined, ReloadOutlined, DownloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
  ToolOutlined, BulbOutlined, PictureOutlined, SafetyCertificateOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import type { TabsProps } from 'antd'
// RcFile is the type passed by Ant Design's beforeUpload (extends browser File)
type RcFile = File
import {
  uploadAndRestore,
  type RestorationResult,
  type PipelineStep,
} from '../../services/restoration'

const { Dragger } = Upload
const { Title, Text, Paragraph } = Typography

type PageStep = 'upload' | 'running' | 'complete' | 'error'

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
        <Tag color="var(--color-vermilion)">{result.category}</Tag>
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
      {/* 修复图 (底层) */}
      <div style={{ width: '100%', aspectRatio: '1', overflow: 'hidden', borderRadius: 8 }}>
        <img src={restored} alt="修复后" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      {/* 原图 (顶层, clip-path 控制显示区域) */}
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
      {/* 修复标签 */}
      <div style={{
        position: 'absolute', top: 8, right: 8,
        background: 'rgba(0,0,0,0.6)', color: '#fff',
        padding: '2px 8px', borderRadius: 4, fontSize: 'var(--text-xs)',
      }}>
        修复
      </div>
      {/* 拖动手柄 */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0,
        left: `${position}%`,
        width: 3, background: '#fff',
        boxShadow: '0 0 8px rgba(0,0,0,0.3)',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />
      {/* 滑块 */}
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
  <BulbOutlined key={1} />,
  <ToolOutlined key={2} />,
  <PictureOutlined key={3} />,
  <SafetyCertificateOutlined key={4} />,
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

  const handleUpload = async (file: RcFile) => {
    const rawFile = file as unknown as File

    // 前端校验
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

    // 预览
    const previewUrl = URL.createObjectURL(rawFile)
    setPreviewImage(previewUrl)
    setStep('running')
    setErrorMsg('')
    setVisibleSteps(0)

    try {
      const data = await uploadAndRestore(rawFile)
      setResult(data)
      setStep('complete')
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
            <CloseCircleOutlined /> {s.result?.error || '执行失败'}
          </div>
        )}
      </div>
    ) : undefined,
    status: i < visibleSteps
      ? (s.status === 'failed' ? 'error' as const : 'finish' as const)
      : (i === visibleSteps ? 'process' as const : 'wait' as const),
    icon: i < visibleSteps
      ? (s.status === 'failed' ? <CloseCircleOutlined /> : STEP_ICONS[i])
      : undefined,
  })) || []

  // Tabs for comparison view
  const comparisonTabs: TabsProps['items'] = [
    {
      key: 'overlay',
      label: <span><SwapOutlined /> 叠加对比</span>,
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

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>🏺 AI 文物数字修复</Title>
        {(step === 'complete' || step === 'error') && (
          <Button icon={<ReloadOutlined />} onClick={handleRetry}>重新修复</Button>
        )}
      </div>

      {/* === 上传区 === */}
      {step === 'upload' && (
        <Card style={{ borderRadius: 12 }}>
          <Dragger
            accept="image/jpeg,image/png,image/webp"
            maxCount={1}
            beforeUpload={handleUpload as any}
            showUploadList={false}
            style={{ padding: 48 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 64, color: 'var(--color-vermilion)' }} />
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
          <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
          <Title level={4} style={{ marginTop: 16 }}>修复失败</Title>
          <Text type="secondary">{errorMsg}</Text>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={handleRetry}>
              重试
            </Button>
          </div>
        </Card>
      )}

      {/* === 完成 === */}
      {step === 'complete' && result && (
        <>
          {/* 管道进度 */}
          <Card style={{ borderRadius: 12, marginBottom: 24 }} title="🔬 AI 修复管道">
            <Steps
              direction="vertical"
              current={visibleSteps}
              items={stepItems}
              style={{ maxWidth: 600 }}
            />
            {/* 展开查看每步详细结果 */}
            {result.pipeline_steps.map((s, i) =>
              i < visibleSteps && s.status === 'completed' ? (
                <div key={i} style={{ marginLeft: 38, marginBottom: 16, marginTop: -8 }}>
                  {renderStepResult(s)}
                </div>
              ) : null
            )}
          </Card>

          {/* 前后对比 */}
          <Card
            style={{ borderRadius: 12, marginBottom: 24 }}
            title="🔄 修复前后对比"
            extra={
              result.restored_image_url && (
                <Button
                  type="primary"
                  ghost
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                >
                  下载修复图
                </Button>
              )
            }
          >
            <Tabs defaultActiveKey="overlay" items={comparisonTabs} />
          </Card>
        </>
      )}
    </div>
  )
}
