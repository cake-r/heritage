import React, { useState } from 'react'
import { Card, Button, Typography, Timeline, Progress, Space, message, Descriptions } from 'antd'
import {
  DownloadOutlined, ShareAltOutlined, TrophyOutlined,
  CheckCircleOutlined, ExperimentOutlined,
} from '@ant-design/icons'
import type { ArchiveOperation, ArchiveResponse } from '../../services/restorationWorkbench'

const { Text, Title } = Typography

interface Props {
  archiveData: {
    originalImageUrl: string
    operations: ArchiveOperation[]
    aiAssistRatio: number
    finalImageUrl: string | null
    verification?: Record<string, any> | null
  }
  onExport: () => void
  onSave: () => Promise<number | null>
}

const TOOL_LABELS: Record<string, string> = {
  stain_brush: '去渍笔',
  pattern_library: '纹样库',
  color_palette: '补色盘',
  line_pen: '补线笔',
  region_select: '选区',
}

const ArchiveExport: React.FC<Props> = ({ archiveData, onExport, onSave }) => {
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)

  const { operations, aiAssistRatio, finalImageUrl, verification } = archiveData

  const handleSave = async () => {
    setSaving(true)
    try {
      const id = await onSave()
      if (id) {
        setSavedId(id)
        message.success('修复档案已保存')
      }
    } catch {
      message.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleShare = () => {
    const url = `${window.location.origin}/restoration-workbench?archive=${savedId}`
    navigator.clipboard?.writeText(url).then(
      () => message.success('分享链接已复制到剪贴板'),
      () => message.info(`分享链接: ${url}`),
    )
  }

  const aiAssistPercent = Math.round((1 - aiAssistRatio) * 100)
  const humanPercent = Math.round(aiAssistRatio * 100)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Title level={4} style={{ marginBottom: 20 }}>
          <ExperimentOutlined style={{ marginRight: 8, color: 'var(--color-vermilion, #B8463A)' }} />
          修复档案
        </Title>

        {/* AI vs Human ratio */}
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
            人机协同占比
          </Text>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={humanPercent}
                size={100}
                strokeColor="#B8463A"
                format={() => <span style={{ fontSize: 20, fontWeight: 700, color: '#B8463A' }}>{humanPercent}%</span>}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>人工操作</Text>
              </div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={aiAssistPercent}
                size={100}
                strokeColor="#4A90C4"
                format={() => <span style={{ fontSize: 20, fontWeight: 700, color: '#4A90C4' }}>{aiAssistPercent}%</span>}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>AI 辅助</Text>
              </div>
            </div>
          </div>
        </div>

        {/* Verification score */}
        {verification && (
          <div style={{ marginBottom: 20, padding: 16, background: '#f9f7f4', borderRadius: 8 }}>
            <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
              <TrophyOutlined style={{ marginRight: 6 }} />
              AI 质量验收
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Progress
                type="circle"
                percent={verification.overall_score || 0}
                size={64}
                strokeColor={
                  (verification.overall_score || 0) >= 85 ? '#52c41a' :
                  (verification.overall_score || 0) >= 70 ? '#faad14' : '#ff4d4f'
                }
              />
              <Text type="secondary" style={{ fontSize: 13, flex: 1 }}>
                {verification.verdict || '修复效果评估'}
              </Text>
            </div>
          </div>
        )}

        {/* Operations timeline */}
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12 }}>
            操作历史
          </Text>
          {operations.length > 0 ? (
            <Timeline
              items={operations.map((op, i) => ({
                color: 'var(--color-vermilion, #B8463A)',
                dot: <CheckCircleOutlined style={{ fontSize: 14 }} />,
                children: (
                  <div key={i}>
                    <Text strong style={{ fontSize: 13 }}>
                      {TOOL_LABELS[op.tool] || op.tool}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      {new Date(op.timestamp).toLocaleTimeString('zh-CN')}
                    </Text>
                    {op.params && Object.keys(op.params).length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Descriptions size="small" column={2}>
                          {Object.entries(op.params).slice(0, 4).map(([k, v]) => (
                            <Descriptions.Item key={k} label={k}>
                              {typeof v === 'object' ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}
                            </Descriptions.Item>
                          ))}
                        </Descriptions>
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          ) : (
            <Text type="secondary" style={{ fontSize: 13 }}>
              尚未进行任何修复操作
            </Text>
          )}
        </div>

        {/* Action buttons */}
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={onExport}
          >
            导出 PNG
          </Button>
          <Button
            icon={<ShareAltOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            {savedId ? '已保存' : '保存档案'}
          </Button>
          {savedId && (
            <Button icon={<ShareAltOutlined />} onClick={handleShare}>
              复制分享链接
            </Button>
          )}
        </Space>
      </Card>
    </div>
  )
}

export default ArchiveExport
