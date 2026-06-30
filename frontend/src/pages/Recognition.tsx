import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card, Upload, Typography, Spin, Tabs, Tag, Button,
  Row, Col, Space, message, Empty, Progress,
} from 'antd'
import {
  InboxOutlined, ReloadOutlined, PictureOutlined,
  ExperimentOutlined, SoundOutlined, RightOutlined,
} from '@ant-design/icons'
// RcFile is the type passed by Ant Design's beforeUpload (extends browser File)
type RcFile = File
import ReactMarkdown from 'react-markdown'
import AudioPlayer from '../components/recognition/AudioPlayer'
import { uploadAndRecognize, getDetail, type RecognitionResult } from '../services/recognition'

const { Dragger } = Upload
const { Title, Text } = Typography

type Step = 'upload' | 'loading' | 'result'

export default function Recognition() {
  const [step, setStep] = useState<Step>('upload')
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [previewImage, setPreviewImage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // 支持 ?id=xxx 从个人中心跳转查看详情
  useEffect(() => {
    const idParam = searchParams.get('id')
    if (idParam) {
      const id = parseInt(idParam, 10)
      if (!isNaN(id)) {
        setStep('loading')
        setError('')
        getDetail(id).then(data => {
          setResult(data)
          setPreviewImage(data.image_url)
          setStep('result')
        }).catch(err => {
          setError(err.message || '加载识别记录失败')
          setStep('upload')
        })
      }
    }
  }, [searchParams])

  const handleUpload = async (file: RcFile) => {
    // beforeUpload 接收的是 RcFile (extends File), 不是 UploadFile
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
    setStep('loading')
    setError('')

    try {
      setUploadProgress(0)
      const data = await uploadAndRecognize(rawFile, (pct) => {
        setUploadProgress(pct)
      })
      setResult(data)
      setStep('result')
      // 通知伴游：完成识别操作
      window.dispatchEvent(new CustomEvent('companion:action', { detail: { action: 'just_completed_recognition' } }))
    } catch (err: any) {
      const errMsg = err.message || ''
      // 区分错误类型给出更友好的提示
      let displayMsg: string
      if (errMsg.includes('网络') || errMsg.includes('连接') || errMsg.includes('超时')) {
        displayMsg = '网络连接失败，请检查网络后重试'
      } else if (errMsg.includes('图片') || errMsg.includes('图像') || errMsg.includes('格式') || errMsg.includes('大小')) {
        displayMsg = `图片不符合要求：${errMsg}`
      } else if (errMsg.includes('非遗') || errMsg.includes('识别') || errMsg.includes('内容')) {
        displayMsg = `未能识别到非遗内容：${errMsg}`
      } else {
        displayMsg = errMsg || '识别失败，请尝试上传更清晰的非遗相关图片'
      }
      setError(displayMsg)
      setStep('upload')
      message.error(displayMsg)
    }

    return false // 阻止默认上传行为
  }

  const handleRetry = () => {
    setResult(null)
    setError('')
    setStep('upload')
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>📷 非遗智能识别与讲解</Title>
        {step === 'result' && (
          <Button icon={<ReloadOutlined />} onClick={handleRetry}>重新识别</Button>
        )}
      </div>

      {/* === 上传区 === */}
      {step === 'upload' && (
        <Card style={{ borderRadius: 12 }}>
          {error && (
            <div style={{
              marginBottom: 16,
              padding: 12,
              background: 'var(--color-bg-active, #FFF3E0)',
              borderRadius: 8,
              color: 'var(--color-error, #C5533B)',
              borderTop: '1px solid var(--color-vermilion, #B8463A)',
              borderRight: '1px solid var(--color-vermilion, #B8463A)',
              borderBottom: '1px solid var(--color-vermilion, #B8463A)',
              borderLeft: '3px solid var(--color-vermilion, #B8463A)',
            }}>
              ⚠️ {error}
            </div>
          )}
          <Dragger
            accept="image/jpeg,image/png,image/webp"
            maxCount={1}
            beforeUpload={handleUpload as any}
            showUploadList={false}
            style={{ padding: 48 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 64, color: 'var(--color-vermilion, #B8463A)' }} />
            </p>
            <p style={{ fontSize: 18, marginTop: 16 }}>点击或拖拽上传非遗手工艺品图片</p>
            <p style={{ color: '#999' }}>支持 JPG / PNG / WebP · 最大 10MB · 图片尺寸 ≥ 200px</p>
          </Dragger>
        </Card>
      )}

      {/* === 加载态 === */}
      {step === 'loading' && (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 40px' }}>
          {previewImage && (
            <img
              src={previewImage}
              alt="预览"
              style={{ maxHeight: 200, borderRadius: 8, marginBottom: 32, boxShadow: 'var(--shadow-md, 0 4px 12px rgba(30,27,24,0.08))' }}
            />
          )}
          <Spin size="large" />
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div style={{ maxWidth: 300, margin: '16px auto' }}>
              <Progress percent={uploadProgress} size="small" strokeColor="var(--color-vermilion, #B8463A)" />
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary, #6B5F52)' }}>
                上传中 {uploadProgress}%
              </div>
            </div>
          )}
          <p style={{ marginTop: 24, fontSize: 18, fontWeight: 500 }}>AI 正在深度分析中...</p>
          <div style={{ color: 'var(--color-ink-secondary, #6B5F52)', marginTop: 12 }}>
            <p style={{ margin: 4 }}>
              <ExperimentOutlined /> 分析纹样特征与技法细节
            </p>
            <p style={{ margin: 4 }}>
              <PictureOutlined /> 匹配非遗品类数据库
            </p>
            <p style={{ margin: 4 }}>
              <SoundOutlined /> 生成文化讲解与语音
            </p>
          </div>
        </Card>
      )}

      {/* === 结果展示 === */}
      {step === 'result' && result && (
        <ResultDisplay result={result} previewImage={previewImage} navigate={navigate} />
      )}
    </div>
  )
}

// ==================== 结果展示子组件 ====================

function ResultDisplay({
  result, previewImage, navigate,
}: {
  result: RecognitionResult
  previewImage: string
  navigate: (path: string) => void
}) {
  return (
    <div>
      {/* 上方: 图片区 */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Tabs
          items={[
            {
              key: 'original',
              label: '原图',
              children: (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={result.image_url || previewImage}
                    alt="上传图片"
                    style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }}
                  />
                </div>
              ),
            },
            {
              key: 'heatmap',
              label: <span><ExperimentOutlined /> 特征热力图</span>,
              children: result.heatmap_url ? (
                <HeatmapViewer
                  src={result.heatmap_url}
                  features={result.heatmap_data}
                />
              ) : (
                <Empty description="暂无热力图数据" />
              ),
            },
          ]}
        />

        {/* 识别结果摘要 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: '1px solid var(--color-border-light, #E8E4D8)' }}>
          <Tag color="var(--color-vermilion, #B8463A)" style={{ fontSize: 16, padding: '4px 16px' }}>
            🏷 {result.category}
          </Tag>
          <Tag color="blue">置信度 {(result.confidence * 100).toFixed(1)}%</Tag>
          <Space size={4}>
            {result.features.map(f => (
              <Tag key={f} color="gold">{f}</Tag>
            ))}
          </Space>
        </div>
      </Card>

      {/* 中部: AI讲解 + 语音 */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <AudioPlayer src={result.voice_url} title={`${result.category} — 语音讲解`} />

        <Tabs
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'history',
              label: '📜 历史渊源',
              children: <MarkdownContent content={result.explanation.history} />,
            },
            {
              key: 'technique',
              label: '🔧 制作工艺',
              children: <MarkdownContent content={result.explanation.technique} />,
            },
            {
              key: 'inheritor',
              label: '👤 传承人故事',
              children: <MarkdownContent content={result.explanation.inheritor} />,
            },
            {
              key: 'meaning',
              label: '🎭 文化寓意',
              children: <MarkdownContent content={result.explanation.meaning} />,
            },
          ]}
        />
      </Card>

      {/* 下部: Top3候选 + 关联推荐 */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="🏆 Top 3 候选" style={{ borderRadius: 12, marginBottom: 16 }}>
            {result.top3.map((item, i) => (
              <div
                key={item.category}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: i < result.top3.length - 1 ? '1px solid var(--color-border-light, #E8E4D8)' : 'none',
                }}
              >
                <Space>
                  <Tag color={i === 0 ? 'var(--color-vermilion, #B8463A)' as any : 'default'}>{i + 1}</Tag>
                  <Text strong={i === 0}>{item.category}</Text>
                </Space>
                <Text type="secondary">{(item.confidence * 100).toFixed(1)}%</Text>
              </div>
            ))}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="🔗 关联推荐" style={{ borderRadius: 12, marginBottom: 16 }}>
            {/* 文创推荐 */}
            <Text type="secondary" style={{ fontSize: 12 }}>相关文创</Text>
            <div style={{ marginBottom: 16 }}>
              {result.related.creations.map(c => (
                <Button
                  key={c.style}
                  type="link"
                  size="small"
                  icon={<RightOutlined />}
                  onClick={() => navigate(`/creative-studio?style=${encodeURIComponent(c.style)}`)}
                >
                  {c.label}
                </Button>
              ))}
            </div>

            {/* 展厅推荐 */}
            <Text type="secondary" style={{ fontSize: 12 }}>展厅藏品</Text>
            {result.related.exhibits.length > 0 ? (
              result.related.exhibits.map(e => (
                <Button
                  key={e.id}
                  type="link"
                  size="small"
                  icon={<RightOutlined />}
                  onClick={() => navigate(`/exhibition?id=${e.id}`)}
                >
                  {e.name}
                </Button>
              ))
            ) : (
              <Text type="secondary">暂无关联藏品</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  if (!content) return <Empty description="暂无内容" />
  return (
    <div style={{ lineHeight: 2, fontSize: 15 }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

// ==================== 热力图交互组件 ====================

interface HeatmapFeature {
  name: string
  x: number
  y: number
  label: string
}

function HeatmapViewer({ src, features }: { src: string; features: HeatmapFeature[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // 如果没有特征数据，只显示热力图
  if (!features || features.length === 0) {
    return (
      <div style={{ textAlign: 'center' }}>
        <img
          src={src}
          alt="热力图"
          style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }}
        />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', display: 'inline-block',
        maxWidth: '100%', margin: '0 auto',
      }}
    >
      <img
        src={src}
        alt="热力图"
        style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, display: 'block' }}
      />

      {/* 交互热点覆盖层 */}
      {features.map((f, i) => {
        const dotSize = 28 + (features.length - i) * 4 // 特征越靠前，标记越大
        const isHovered = hovered === f.name

        return (
          <div
            key={f.name}
            onMouseEnter={() => setHovered(f.name)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: 'absolute',
              left: `${f.x * 100}%`,
              top: `${f.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            {/* 脉冲圆点 */}
            <div style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: `rgba(255, 255, 255, ${isHovered ? 0.9 : 0.6})`,
              border: `2px solid ${isHovered ? '#C41E3A' : 'rgba(255,255,255,0.8)'}`,
              boxShadow: isHovered
                ? '0 0 16px rgba(196,30,58,0.8), 0 0 32px rgba(196,30,58,0.4)'
                : '0 0 8px rgba(255,255,255,0.5)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                color: isHovered ? '#C41E3A' : '#fff',
                fontSize: 'var(--text-xs)',
                fontWeight: 'bold',
                textShadow: isHovered ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
              }}>
                {i + 1}
              </span>
            </div>

            {/* Hover Tooltip */}
            {isHovered && (
              <div style={{
                position: 'absolute',
                left: 20,
                top: -12,
                background: 'rgba(26,26,46,0.95)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 'var(--text-sm)',
                whiteSpace: 'nowrap',
                zIndex: 20,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                border: '1px solid rgba(201,169,110,0.4)',
                pointerEvents: 'none',
              }}>
                <div style={{ fontWeight: 'bold', color: '#C9A96E', marginBottom: 2 }}>
                  🔍 {f.name}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--text-xs)', maxWidth: 220, whiteSpace: 'normal' }}>
                  {f.label}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* 图例 */}
      <div style={{
        position: 'absolute', bottom: 8, right: 12,
        background: 'rgba(0,0,0,0.7)', color: '#fff',
        padding: '6px 12px', borderRadius: 6, fontSize: 'var(--text-xs)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9A96E' }} />
        悬停编号查看特征详情
      </div>
    </div>
  )
}
