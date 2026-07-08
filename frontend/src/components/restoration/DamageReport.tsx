import React from 'react'
import { Card, Tag, Progress, Collapse, Typography, Space, Tooltip } from 'antd'
import {
  AlertTriangle, Crosshair, Info,
} from 'lucide-react'
import type { DamageRegion, DamageDetectResponse } from '../../services/restorationWorkbench'
import { normalizeImageUrl } from '../../utils/imageUrl'

const { Text, Paragraph } = Typography

interface Props {
  data: DamageDetectResponse
  onRegionClick?: (region: DamageRegion) => void
  selectedRegionIndex?: number
}

const SEVERITY_COLORS: Record<string, string> = {
  '轻度': '#52c41a',
  '中度': '#faad14',
  '重度': '#ff4d4f',
}

const DAMAGE_TYPE_COLORS: Record<string, string> = {
  '釉面剥落': '#ff7875',
  '表面裂纹': '#ff9c6e',
  '色彩氧化': '#ffc069',
  '丝线褪色': '#ffd666',
  '局部破损': '#ff4d4f',
  '污渍': '#b37feb',
  '纸张泛黄': '#ffc53d',
  '边缘破损': '#ff7a45',
  '折叠痕迹': '#ffe7ba',
  '皮革龟裂': '#d9d9d9',
  '颜料脱落': '#f759ab',
  '连接处松动': '#69c0ff',
  '表面磨损': '#95de64',
  '漆面剥落': '#ff9c6e',
  '虫蛀痕迹': '#d9b99b',
  '画面模糊': '#91d5ff',
  '细节丢失': '#adc6ff',
  '对比度不足': '#b7eb8f',
  '噪点': '#d3adf7',
}

const DamageReport: React.FC<Props> = ({ data, onRegionClick, selectedRegionIndex }) => {
  const severityColor = SEVERITY_COLORS[data.severity] || 'default'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Image with bbox overlays */}
      <Card size="small" style={{ borderRadius: 10 }}>
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          <img
            src={normalizeImageUrl(data.image_url)}
            alt="损伤检测"
            style={{
              width: '100%',
              borderRadius: 8,
              display: 'block',
            }}
          />
          {/* SVG overlay for bbox regions */}
          {data.damage_regions.length > 0 && (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
              viewBox="0 0 1024 1024"
              preserveAspectRatio="none"
            >
              {data.damage_regions.map((region, i) => {
                const color = DAMAGE_TYPE_COLORS[data.damage_types[i]] || '#B8463A'
                return (
                  <rect
                    key={i}
                    x={region.x}
                    y={region.y}
                    width={region.width}
                    height={region.height}
                    fill="none"
                    stroke={i === selectedRegionIndex ? color : color + '80'}
                    strokeWidth={i === selectedRegionIndex ? 3 : 2}
                    strokeDasharray={i === selectedRegionIndex ? '' : '6,3'}
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    onClick={() => onRegionClick?.(region)}
                  />
                )
              })}
            </svg>
          )}
          {/* Clickable bbox labels */}
          {data.damage_regions.map((region, i) => (
            <Tooltip key={i} title={region.description}>
              <div
                onClick={() => onRegionClick?.(region)}
                style={{
                  position: 'absolute',
                  left: `${(region.x / 1024) * 100}%`,
                  top: `${((region.y + region.height) / 1024) * 100}%`,
                  background: i === selectedRegionIndex
                    ? DAMAGE_TYPE_COLORS[data.damage_types[i]] || '#B8463A'
                    : 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.2s',
                }}
              >
                {data.damage_types[i] || `区域${i + 1}`} · {region.severity}
              </div>
            </Tooltip>
          ))}
        </div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8, textAlign: 'center' }}>
          <Info /> AI 检测的损伤区域为估算位置，可在工作台中调整选区后再执行修复
        </Text>
      </Card>

      {/* Damage summary */}
      <Card size="small" style={{ borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 15 }}>
            <AlertTriangle style={{ marginRight: 6, color: 'var(--color-vermilion, #B8463A)' }} />
            损伤分析报告
          </Text>
          <Space>
            <Tag color="#B8463A">{data.category}</Tag>
            <Tag color={severityColor}>{data.severity}</Tag>
          </Space>
        </div>

        <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 12 }}>
          {data.description}
        </Paragraph>

        {/* Damage types */}
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>检测到的损伤类型：</Text>
          <div style={{ marginTop: 6 }}>
            {data.damage_types.map((t, i) => (
              <Tag key={i} color={DAMAGE_TYPE_COLORS[t] || 'orange'} style={{ marginBottom: 4 }}>
                {t}
              </Tag>
            ))}
          </div>
        </div>

        {/* Damage regions list */}
        {data.damage_regions.length > 0 && (
          <Collapse
            size="small"
            ghost
            items={[{
              key: 'regions',
              label: <span style={{ fontSize: 13 }}>损伤区域坐标 ({data.damage_regions.length} 处)</span>,
              children: (
                <div>
                  {data.damage_regions.map((region, i) => (
                    <div
                      key={i}
                      onClick={() => onRegionClick?.(region)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        marginBottom: 6,
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: i === selectedRegionIndex
                          ? 'rgba(184, 70, 58, 0.06)'
                          : 'transparent',
                        border: i === selectedRegionIndex
                          ? '1px solid rgba(184, 70, 58, 0.2)'
                          : '1px solid transparent',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Crosshair style={{
                        color: i === selectedRegionIndex ? '#B8463A' : '#999',
                        fontSize: 14,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 13, fontWeight: 500 }}>
                          区域 {i + 1}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                          ({region.x}, {region.y}, {region.width}×{region.height})
                        </Text>
                        <div style={{ marginTop: 2 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {region.description}
                          </Text>
                        </div>
                      </div>
                      <Tag color={SEVERITY_COLORS[region.severity] || 'default'} style={{ fontSize: 11, flexShrink: 0 }}>
                        {region.severity}
                      </Tag>
                    </div>
                  ))}
                </div>
              ),
            }]}
          />
        )}
      </Card>
    </div>
  )
}

export default DamageReport
