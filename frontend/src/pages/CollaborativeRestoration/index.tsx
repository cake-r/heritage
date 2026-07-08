import React, { useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Typography, Upload, Spin, Button, Card, message, Steps, Row, Col, Empty,
} from 'antd'
import {
  Inbox, ChevronLeft, ChevronRight,
  Image, Wrench, ShieldCheck,
  Download, FlaskConical,
} from 'lucide-react'
import type { RcFile } from 'antd/es/upload'
import {
  damageDetect, localInpaint, saveArchive,
  type DamageDetectResponse, type DamageRegion, type ArchiveOperation,
} from '../../services/restorationWorkbench'
import { normalizeImageUrl } from '../../utils/imageUrl'
import ToolPanel, { type ToolType } from '../../components/restoration/ToolPanel'
import DamageReportComponent from '../../components/restoration/DamageReport'
import RepairCanvas, { type RepairCanvasHandle } from '../../components/restoration/RepairCanvas'
import ArchiveExport from '../../components/restoration/ArchiveExport'
import { IceCracklePattern } from '../../components/decoration'

const { Dragger } = Upload
const { Title, Text } = Typography

type WorkbenchStep = 'upload' | 'analyzing' | 'damage-report' | 'repairing' | 'complete'

export default function CollaborativeRestoration() {
  const navigate = useNavigate()

  // Step state
  const [step, setStep] = useState<WorkbenchStep>('upload')
  const [errorMsg, setErrorMsg] = useState('')

  // Data
  const [damageData, setDamageData] = useState<DamageDetectResponse | null>(null)
  const [previewImage, setPreviewImage] = useState<string>('')
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('')

  // Workbench state
  const [activeTool, setActiveTool] = useState<ToolType>('region_select')
  const [selectedRegion, setSelectedRegion] = useState<DamageRegion | null>(null)
  const [operations, setOperations] = useState<ArchiveOperation[]>([])
  const repairCanvasRef = useRef<RepairCanvasHandle>(null)

  // ==================== Upload ====================

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
    setErrorMsg('')

    try {
      const data = await damageDetect(rawFile)
      setDamageData(data)
      setCurrentImageUrl(data.image_url)
      setStep('damage-report')
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || '损伤检测失败')
      setStep('upload')
      message.error(err.response?.data?.detail || '损伤检测失败')
    }

    return false
  }

  // ==================== Region handling ====================

  const handleRegionSelected = useCallback((region: { x: number; y: number; width: number; height: number }) => {
    // Convert to DamageRegion-like format for reference
    setSelectedRegion({
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      description: '手动框选区域',
      severity: '中度',
    })
  }, [])

  const handleRepairRegion = useCallback(async () => {
    if (!selectedRegion || !currentImageUrl) {
      message.warning('请先用选区工具框选需要修复的区域')
      return
    }

    const hideLoading = message.loading('AI 局部修复中，预计需要 30-60 秒...', 0)

    try {
      const result = await localInpaint(
        currentImageUrl,
        selectedRegion,
        activeTool === 'stain_brush' ? 'stain_brush' : 'region_select',
      )
      setCurrentImageUrl(result.restored_image_url)
      setSelectedRegion(null)

      // Record operation
      const newOp: ArchiveOperation = {
        tool: activeTool === 'stain_brush' ? 'stain_brush' : 'region_select',
        params: {
          x: selectedRegion.x,
          y: selectedRegion.y,
          width: selectedRegion.width,
          height: selectedRegion.height,
        },
        before_url: currentImageUrl,
        after_url: result.restored_image_url,
        timestamp: new Date().toISOString(),
      }
      setOperations(prev => [...prev, newOp])

      message.success('局部修复完成！结果已自然融合')
    } catch (err: any) {
      message.error(err.response?.data?.detail || '修复失败，请重试')
    } finally {
      hideLoading()
    }
  }, [selectedRegion, currentImageUrl, activeTool])

  // ==================== Pattern Library ====================

  const handlePatternApplied = useCallback((dataUrl: string) => {
    repairCanvasRef.current?.addPatternImage(dataUrl)

    const newOp: ArchiveOperation = {
      tool: 'pattern_library',
      params: { applied_pattern: true },
      before_url: currentImageUrl,
      after_url: '', // will be updated
      timestamp: new Date().toISOString(),
    }
    setOperations(prev => [...prev, newOp])
    message.success('纹样已添加到画布')
  }, [currentImageUrl])

  // ==================== Export / Save ====================

  const handleExport = useCallback(() => {
    const imageUrl = repairCanvasRef.current?.getCanvasImageUrl()
    if (!imageUrl) {
      message.warning('画布上没有可导出的内容')
      return
    }

    const link = document.createElement('a')
    link.download = `collaborative-restoration-${Date.now()}.png`
    link.href = imageUrl
    link.click()
    message.success('导出成功')
  }, [])

  const handleSave = useCallback(async (): Promise<number | null> => {
    if (!damageData) return null

    const finalImageUrl = repairCanvasRef.current?.getCanvasImageUrl() || currentImageUrl

    const archiveResp = await saveArchive({
      original_image_path: currentImageUrl,
      damage_report_json: JSON.stringify(damageData),
      operations,
      ai_assist_ratio: calculateAiRatio(operations),
      final_image_path: finalImageUrl,
      verification_json: null,
    })

    return archiveResp.id
  }, [damageData, currentImageUrl, operations])

  // ==================== Render Steps ====================

  const stepItems = [
    { title: '损伤检测', icon: <Image /> },
    { title: '损伤报告', icon: <ShieldCheck /> },
    { title: '协同修复', icon: <Wrench /> },
    { title: '导出成果', icon: <Download /> },
  ]

  const currentStepIndex =
    step === 'upload' || step === 'analyzing' ? 0 :
    step === 'damage-report' ? 1 :
    step === 'repairing' ? 2 : 3

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
      <IceCracklePattern opacity={0.16} />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, fontSize: 22 }}>
          <FlaskConical style={{ marginRight: 10, color: 'var(--color-vermilion, #B8463A)', fontSize: 24 }} />
          协同修复工作台
        </Title>
        <Button icon={<ChevronLeft />} onClick={() => navigate('/restoration')}>
          一键修复模式
        </Button>
      </div>

      <Steps
        current={currentStepIndex}
        size="small"
        style={{ marginBottom: 24 }}
        items={stepItems}
      />

      {/* === Step: Upload === */}
      {(step === 'upload' || step === 'analyzing') && (
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ maxWidth: 640, margin: '0 auto' }}
        >
          {step === 'upload' ? (
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
                  上传文物图片，AI 先检测损伤区域
                </p>
                <p className="ant-upload-hint" style={{ fontSize: 14 }}>
                  支持 JPG / PNG / WebP，最大 10MB
                </p>
                <p className="ant-upload-hint" style={{ fontSize: 13, marginTop: 12, color: 'var(--color-ink-secondary)' }}>
                  AI 将分析损伤类型与位置，然后你可选择工具进行协同修复
                </p>
              </Dragger>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  也可以使用「<a onClick={() => navigate('/restoration')}>一键修复</a>」全自动完成修复
                </Text>
              </div>
            </Card>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              {previewImage && (
                <img
                  src={previewImage}
                  alt="预览"
                  style={{ maxWidth: 320, maxHeight: 320, borderRadius: 12, marginBottom: 24, objectFit: 'cover' }}
                />
              )}
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 15 }}>
                  AI 正在分析损伤类型和位置...
                </Text>
              </div>
            </div>
          )}

          {errorMsg && (
            <Card style={{ borderRadius: 12, textAlign: 'center', marginTop: 16 }}>
              <Text type="danger">{errorMsg}</Text>
            </Card>
          )}
        </motion.div>
      )}

      {/* === Step: Damage Report === */}
      {step === 'damage-report' && damageData && (
        <motion.div
          key="damage-report"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <DamageReportComponent
            data={damageData}
            onRegionClick={(region) => {
              setSelectedRegion(region)
              setActiveTool('region_select')
              setStep('repairing')
            }}
          />

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button
              type="primary"
              size="large"
              icon={<ChevronRight />}
              onClick={() => setStep('repairing')}
            >
              进入修复工作台
            </Button>
          </div>
        </motion.div>
      )}

      {/* === Step: Repairing (Workbench) === */}
      {step === 'repairing' && (
        <motion.div
          key="repairing"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}
        >
          {/* Left: Tool Panel */}
          <div style={{ flexShrink: 0 }}>
            <ToolPanel selectedTool={activeTool} onSelect={setActiveTool} />

            {/* Repair action button */}
            {(activeTool === 'region_select' || activeTool === 'stain_brush') && (
              <div style={{ marginTop: 12 }}>
                <Button
                  type="primary"
                  block
                  icon={<Wrench />}
                  onClick={handleRepairRegion}
                  disabled={!selectedRegion && activeTool === 'region_select'}
                  style={{ borderRadius: 8 }}
                >
                  {activeTool === 'stain_brush' ? 'AI 清除污渍' : 'AI 修复选区'}
                </Button>
                {!selectedRegion && activeTool === 'region_select' && (
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, textAlign: 'center' }}>
                    请先在画布上框选区域
                  </Text>
                )}
              </div>
            )}

            {/* Pattern library action */}
            {activeTool === 'pattern_library' && (
              <div style={{ marginTop: 12 }}>
                <Button
                  block
                  icon={<ChevronRight />}
                  onClick={() => {
                    // Open pattern engine in new tab OR navigate
                    const geneWin = window.open('/pattern-engine', '_blank')
                    geneWin?.focus()
                  }}
                  style={{ borderRadius: 8 }}
                >
                  打开纹样基因库
                </Button>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, textAlign: 'center' }}>
                  在新窗口中排列纹样后导出，再粘贴到修复画布
                </Text>
              </div>
            )}

            {/* Step actions */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                icon={<ChevronLeft />}
                onClick={() => setStep('damage-report')}
                size="small"
              >
                返回报告
              </Button>
              <Button
                type="primary"
                icon={<ChevronRight />}
                onClick={() => setStep('complete')}
                size="small"
              >
                完成修复
              </Button>
            </div>
          </div>

          {/* Center: Canvas */}
          <div style={{
            flex: 1, minWidth: 400,
            border: '2px solid var(--color-deep)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-paper-white)',
            overflow: 'hidden',
          }}>
            <RepairCanvas
              ref={repairCanvasRef}
              imageUrl={currentImageUrl}
              activeTool={activeTool}
              onRegionSelected={handleRegionSelected}
            />
          </div>
        </motion.div>
      )}

      {/* === Step: Complete (Export) === */}
      {step === 'complete' && (
        <motion.div
          key="complete"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <ArchiveExport
            archiveData={{
              originalImageUrl: damageData?.image_url || currentImageUrl,
              operations,
              aiAssistRatio: calculateAiRatio(operations),
              finalImageUrl: currentImageUrl,
              verification: null,
            }}
            onExport={handleExport}
            onSave={handleSave}
          />

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button
              icon={<ChevronLeft />}
              onClick={() => setStep('repairing')}
            >
              返回工作台继续修复
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ==================== Utility ====================

function calculateAiRatio(operations: ArchiveOperation[]): number {
  if (operations.length === 0) return 0.0

  let aiWeight = 0
  for (const op of operations) {
    switch (op.tool) {
      case 'pattern_library':
        aiWeight += 0.1  // Mostly human (drag-and-drop)
        break
      case 'stain_brush':
      case 'region_select':
        aiWeight += 0.9  // Heavy AI (full regeneration)
        break
      case 'color_palette':
        aiWeight += 0.7
        break
      case 'line_pen':
        aiWeight += 0.5
        break
      default:
        aiWeight += 0.5
    }
  }
  return Math.round((aiWeight / operations.length) * 100) / 100
}
