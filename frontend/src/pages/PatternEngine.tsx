import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Typography, Upload, Spin, Button, Row, Col, message, Empty, Steps, Tooltip, Card,
} from 'antd'
import {
  Inbox, RefreshCw, FlaskConical,
  ChevronLeft, ChevronRight, Image,
  Zap,
} from 'lucide-react'
import type { RcFile } from 'antd/es/upload'
import { uploadAndRecognize, getDetail, type RecognitionResult } from '../services/recognition'
import { matchPatterns, type PatternGene } from '../services/patternEngine'
import { normalizeImageUrl } from '../utils/imageUrl'
import GeneCard from '../components/pattern/GeneCard'
import CarrierTemplateSelector, { CARRIER_TEMPLATES } from '../components/pattern/CarrierTemplate'
import PatternWorkbench from '../components/pattern/PatternWorkbench'
import { BrocadePattern } from '../components/decoration'

const { Dragger } = Upload
const { Title, Text } = Typography

type Step = 'upload' | 'analyzing' | 'genes' | 'workbench'

// 快速体验样本
const SAMPLE_IMAGES = [
  { url: '/static/knowledge/剪纸_1.jpg', label: '剪纸', icon: '✂️' },
  { url: '/static/knowledge/苏绣_1.jpg', label: '苏绣', icon: '🧵' },
  { url: '/static/knowledge/景德镇手工制瓷_1.jpg', label: '瓷器', icon: '🏺' },
]

export default function PatternEngine() {
  const [step, setStep] = useState<Step>('upload')
  const [previewImage, setPreviewImage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null)
  const [matchedGenes, setMatchedGenes] = useState<PatternGene[]>([])
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([])
  const [allGenes, setAllGenes] = useState<PatternGene[]>([])
  const [carrierKey, setCarrierKey] = useState('scarf')
  const [uploadProgress, setUploadProgress] = useState(0)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // 从识别结果跳转
  useEffect(() => {
    const recId = searchParams.get('recognition_id')
    if (recId) {
      const id = parseInt(recId, 10)
      if (!isNaN(id)) {
        setStep('analyzing')
        getDetail(id)
          .then(data => {
            setRecognitionResult(data)
            setPreviewImage(data.image_url)
            doMatch(data.pattern_names || [])
          })
          .catch(err => {
            setError(err.message || '加载识别记录失败')
            setStep('upload')
          })
      }
    }
  }, [searchParams])

  // 纹样匹配
  const doMatch = useCallback(async (patternNames: string[]) => {
    if (patternNames.length === 0) {
      message.warning('未检测到传统纹样，显示全部基因库供手动选择')
      setStep('genes')
      return
    }
    try {
      const result = await matchPatterns(patternNames)
      setMatchedGenes(result.matched)
      setUnmatchedNames(result.unmatched)
      setStep('genes')
    } catch (err: any) {
      message.error('纹样匹配失败: ' + (err.message || '未知错误'))
      setStep('genes')
    }
  }, [])

  // 上传新图片
  const handleUpload = async (file: RcFile) => {
    const rawFile = file as unknown as File
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(rawFile.type || '')) {
      message.error('请上传 JPG / PNG / WebP 格式的图片')
      return false
    }
    if ((rawFile.size || 0) > 10 * 1024 * 1024) {
      message.error('图片大小不能超过 10MB')
      return false
    }

    setPreviewImage(URL.createObjectURL(rawFile))
    setStep('analyzing')
    setError('')
    setUploadProgress(0)

    try {
      const data = await uploadAndRecognize(rawFile, (pct) => setUploadProgress(pct))
      setRecognitionResult(data)
      doMatch(data.pattern_names || [])
    } catch (err: any) {
      setError(err.message || '识别失败，请重试')
      setStep('upload')
      message.error(err.message || '识别失败')
    }
    return false
  }

  // 快速体验
  const handleSample = async (sample: typeof SAMPLE_IMAGES[number]) => {
    setPreviewImage(sample.url)
    setStep('analyzing')
    setError('')
    setUploadProgress(0)
    try {
      const response = await fetch(sample.url)
      if (!response.ok) throw new Error('加载失败')
      const blob = await response.blob()
      const file = new File([blob], `sample_${sample.label}.jpg`, { type: blob.type || 'image/jpeg' })
      const data = await uploadAndRecognize(file, (pct) => setUploadProgress(pct))
      setRecognitionResult(data)
      doMatch(data.pattern_names || [])
    } catch (err: any) {
      setError(err.message || '识别失败')
      setStep('upload')
    }
  }

  // 加载全部基因库（手动选择模式）
  const loadAllGenes = async () => {
    try {
      const { listGenes } = await import('../services/patternEngine')
      const result = await listGenes({ page_size: 100 })
      setAllGenes(result.items)
    } catch (err) {
      message.error('加载基因库失败')
    }
  }

  // 进入工作台
  const genesForWorkbench = matchedGenes.length > 0 ? matchedGenes : allGenes

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
      <BrocadePattern opacity={0.18} />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, fontSize: 22 }}>
          <FlaskConical style={{ marginRight: 10, color: 'var(--color-vermilion, #B8463A)', fontSize: 24 }} />
          纹样基因重组引擎
        </Title>
        {step === 'workbench' && (
          <Button icon={<ChevronLeft />} onClick={() => { setStep('genes'); setSelectedGenes([]) }}>
            返回基因选择
          </Button>
        )}
      </div>

      {/* Steps indicator */}
      <Steps
        current={step === 'upload' ? 0 : step === 'analyzing' ? 0 : step === 'genes' ? 1 : 2}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: '上传图片', icon: <Image /> },
          { title: '纹样识别', icon: <Zap /> },
          { title: '自由创作', icon: <FlaskConical /> },
        ]}
      />

      <AnimatePresence mode="wait">
        {/* === Step: Upload === */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ maxWidth: 640, margin: '0 auto' }}
          >
          <Card style={{ borderRadius: 12 }}>
            <Dragger
              accept=".jpg,.jpeg,.png,.webp"
              showUploadList={false}
              beforeUpload={handleUpload as any}
              style={{ padding: '48px 20px' }}
            >
              <p className="ant-upload-drag-icon">
                <Inbox style={{ fontSize: 52, color: 'var(--color-vermilion, #B8463A)' }} />
              </p>
              <p className="ant-upload-text" style={{ fontSize: 17 }}>
                点击或拖拽上传非遗图片
              </p>
              <p className="ant-upload-hint" style={{ fontSize: 14 }}>
                支持 JPG / PNG / WebP，最大 10MB
              </p>
            </Dragger>

            {/* 快速体验 */}
            <div style={{ marginTop: 24 }}>
              <Text style={{ display: 'block', marginBottom: 12, textAlign: 'center', fontSize: 14, color: '#888' }}>
                或选择快速体验样本
              </Text>
              <Row gutter={12} justify="center">
                {SAMPLE_IMAGES.map(s => (
                  <Col key={s.label}>
                    <Card
                      hoverable size="small"
                      onClick={() => handleSample(s)}
                      style={{ borderRadius: 10, textAlign: 'center', width: 150 }}
                      bodyStyle={{ padding: '14px 18px' }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 6 }}>{s.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{s.label}</div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>

            {/* 从识别结果页跳转提示 */}
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                也可以从「识物品鉴」结果页点击「纹样基因重组」跳转至此
              </Text>
            </div>
          </Card>
          </motion.div>
        )}

        {/* === Step: Analyzing === */}
        {step === 'analyzing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', padding: '60px 0' }}
          >
          {previewImage && (
            <img
              src={normalizeImageUrl(previewImage)}
              alt="预览"
              style={{ maxWidth: 320, maxHeight: 320, borderRadius: 12, marginBottom: 24, objectFit: 'cover' }}
            />
          )}
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 15 }}>
              AI 正在识别图片中的传统纹样...
            </Text>
          </div>
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                上传进度: {uploadProgress}%
              </Text>
            </div>
          )}
          </motion.div>
        )}

        {/* === Step: Genes === */}
        {step === 'genes' && (
          <motion.div
            key="genes"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <GenesStep
          matchedGenes={matchedGenes}
          unmatchedNames={unmatchedNames}
          recognitionResult={recognitionResult}
          previewImage={previewImage}
          carrierKey={carrierKey}
          onCarrierChange={setCarrierKey}
          onStartWorkbench={() => {
            if (matchedGenes.length === 0 && allGenes.length === 0) {
              loadAllGenes().then(() => setStep('workbench'))
            } else {
              setStep('workbench')
            }
          }}
          onLoadAll={() => {
            loadAllGenes().then(() => setStep('workbench'))
          }}
          onRetry={() => setStep('upload')}
        />
          </motion.div>
        )}

        {/* === Step: Workbench === */}
        {step === 'workbench' && (
          <motion.div
            key="workbench"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="paper-texture"
          >
            <PatternWorkbench
          genes={genesForWorkbench}
          carrierKey={carrierKey}
        />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== Genes Step Sub-component ====================

function GenesStep({
  matchedGenes, unmatchedNames, recognitionResult, previewImage,
  carrierKey, onCarrierChange, onStartWorkbench, onLoadAll, onRetry,
}: {
  matchedGenes: PatternGene[]
  unmatchedNames: string[]
  recognitionResult: RecognitionResult | null
  previewImage: string
  carrierKey: string
  onCarrierChange: (key: string) => void
  onStartWorkbench: () => void
  onLoadAll: () => void
  onRetry: () => void
}) {
  return (
    <Row gutter={24}>
      {/* Left: Preview + Result */}
      <Col xs={24} md={8}>
        {previewImage && (
          <img
            src={normalizeImageUrl(previewImage)}
            alt="原图"
            style={{ width: '100%', borderRadius: 12, marginBottom: 16, objectFit: 'cover', maxHeight: 240 }}
          />
        )}
        {recognitionResult && (
          <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              识别结果
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>
              品类: {recognitionResult.category} ({(recognitionResult.confidence * 100).toFixed(0)}%)
            </div>
            {recognitionResult.features.length > 0 && (
              <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                工艺: {recognitionResult.features.join('、')}
              </div>
            )}
          </Card>
        )}

        {/* Carrier template selector */}
        <CarrierTemplateSelector selected={carrierKey} onSelect={onCarrierChange} />

        {/* Actions */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button type="primary" size="large" block icon={<ChevronRight />}
            onClick={onStartWorkbench}>
            进入工作台创作
          </Button>
          <Button block icon={<RefreshCw />} onClick={onRetry}>
            重新上传图片
          </Button>
        </div>
      </Col>

      {/* Right: Gene Cards */}
      <Col xs={24} md={16}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>
          识别到的纹样基因
          {matchedGenes.length > 0 && (
            <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
              ({matchedGenes.length} 个匹配)
            </Text>
          )}
        </div>

        {matchedGenes.length > 0 ? (
          <Row gutter={[14, 14]}>
            {matchedGenes.map(gene => (
              <Col key={gene.gene_id}>
                <GeneCard gene={gene} />
              </Col>
            ))}
          </Row>
        ) : (
          <Empty
            description={
              unmatchedNames.length > 0
                ? `未匹配到纹样: ${unmatchedNames.join('、')}`
                : '未检测到传统纹样，请尝试其他图片或手动加载基因库'
            }
            style={{ padding: '48px 0' }}
          />
        )}

        {unmatchedNames.length > 0 && (
          <div style={{ marginTop: 16, padding: 14, background: 'var(--color-bg-active)', borderRadius: 10, border: '1px solid #FFE58F' }}>
            <Text style={{ fontSize: 13, color: '#AD6800' }}>
              AI 返回但未匹配到的纹样: {unmatchedNames.join('、')}
            </Text>
          </div>
        )}

        {matchedGenes.length === 0 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button type="link" onClick={onLoadAll} style={{ fontSize: 14 }}>
              加载全部纹样基因库 ({unmatchedNames.length > 0 ? '含' + unmatchedNames.length + '个未匹配的供参考' : '浏览所有纹样'})
            </Button>
          </div>
        )}
      </Col>
    </Row>
  )
}
