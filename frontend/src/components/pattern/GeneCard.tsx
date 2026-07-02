import React from 'react'
import { Card, Tag, Tooltip } from 'antd'
import type { PatternGene } from '../../services/patternEngine'

interface Props {
  gene: PatternGene
  selected?: boolean
  onClick?: () => void
}

const MEANING_COLORS: Record<string, string> = {
  '祈福': '#B8463A',
  '吉祥': '#C4A265',
  '祭祀': '#5B8C5A',
  '等级': '#4A90C4',
}

const GeneCard: React.FC<Props> = ({ gene, selected, onClick }) => {
  const meaningColor = MEANING_COLORS[gene.meaning] || '#8B7355'

  return (
    <Card
      hoverable
      size="small"
      onClick={onClick}
      style={{
        width: 160,
        border: selected ? `2px solid ${meaningColor}` : '1px solid #e8e0d5',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: selected ? `0 0 12px ${meaningColor}40` : undefined,
      }}
      bodyStyle={{ padding: '12px' }}
    >
      {/* SVG 预览 */}
      <div
        style={{
          width: '100%',
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAF7F2',
          borderRadius: 6,
          marginBottom: 8,
          overflow: 'hidden',
        }}
      >
        <svg
          viewBox={gene.svg_viewbox || '0 0 100 100'}
          width="64"
          height="64"
          dangerouslySetInnerHTML={{ __html: gene.svg_content }}
        />
      </div>

      {/* 纹样名称 */}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
        {gene.name}
      </div>

      {/* 标签 */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Tooltip title={`形制: ${gene.shape_category}`}>
          <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>{gene.shape_category}</Tag>
        </Tooltip>
        <Tooltip title={`寓意: ${gene.meaning}`}>
          <Tag color="volcano" style={{ fontSize: 11, margin: 0 }}>{gene.meaning}</Tag>
        </Tooltip>
        {gene.era && (
          <Tooltip title={`年代: ${gene.era}`}>
            <Tag style={{ fontSize: 11, margin: 0 }}>{gene.era}</Tag>
          </Tooltip>
        )}
      </div>
    </Card>
  )
}

export default GeneCard
