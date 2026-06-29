import { useMemo } from 'react'
import { Tag, Empty, Card as AntCard } from 'antd'
import { EnvironmentOutlined, RightOutlined } from '@ant-design/icons'
import { getCategoryColor, hexToRgb } from '../../utils/categoryColors'
import type { RegionData, ItemNode } from '../../services/knowledgeGraph'

interface Props {
  province: string
  regionData: RegionData | undefined
  items: ItemNode[]
  onItemClick: (id: number) => void
}

export default function ProvinceDetailPanel({ province, regionData, items, onItemClick }: Props) {
  // Category breakdown for this province
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [items])

  if (!province) return null

  return (
    <div style={{
      width: 300,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      overflow: 'hidden',
    }}>
      <AntCard
        size="small"
        style={{ borderRadius: 12, border: '1px solid var(--color-border-light, #E8E4D8)' }}
        bodyStyle={{ padding: 16 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <EnvironmentOutlined style={{ color: 'var(--color-vermilion, #B8463A)', fontSize: 16 }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>{province}</span>
          <span style={{ fontSize: 13, color: 'var(--color-ink-secondary, #6B5F52)' }}>
            {regionData?.value || 0} 项
          </span>
        </div>

        {/* Category breakdown */}
        {categoryCounts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--color-ink-secondary, #6B5F52)', marginBottom: 6 }}>品类分布</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {categoryCounts.map(([cat, count]) => {
                const catColor = getCategoryColor(cat)
                const rgb = hexToRgb(catColor)
                return (
                  <Tag
                    key={cat}
                    style={{
                      fontSize: 12,
                      borderRadius: 6,
                      margin: 0,
                      background: `rgba(${rgb}, 0.12)`,
                      borderColor: catColor,
                      color: catColor,
                    }}
                  >
                    {cat} {count}
                  </Tag>
                )
              })}
            </div>
          </div>
        )}

        {/* Top techniques */}
        {regionData?.top_techniques && regionData.top_techniques.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--color-ink-secondary, #6B5F52)', marginBottom: 6 }}>热门技法</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {regionData.top_techniques.slice(0, 8).map(t => (
                <Tag key={t} style={{ fontSize: 12, borderRadius: 6, margin: 0, color: 'var(--color-gold, #C4A265)', background: 'var(--color-paper, #F7F4ED)', borderColor: 'var(--color-gold-light, #E8D5B0)' }}>
                  {t}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </AntCard>

      {/* Item cards */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxHeight: 340,
      }}>
        <div style={{ fontSize: 12, color: 'var(--color-ink-secondary, #6B5F52)', paddingLeft: 4 }}>
          {province}的非遗项目 ({items.length})
        </div>

        {items.length === 0 ? (
          <Empty description="该省份在当前筛选条件下暂无项目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          items.map(item => (
            <div
              key={item.id}
              onClick={() => onItemClick(item.id)}
              style={{
                background: 'var(--color-paper-white, #FFFDF9)',
                borderRadius: 8,
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--color-border-light, #E8E4D8)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--color-bg-active, #FFF3E0)'
                e.currentTarget.style.borderColor = 'var(--color-gold, #C4A265)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--color-paper-white, #FFFDF9)'
                e.currentTarget.style.borderColor = 'var(--color-border-light, #E8E4D8)'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <Tag style={{ fontSize: 12, borderRadius: 6, margin: 0, padding: '0 6px', lineHeight: '20px' }}
                    color="gold">{item.era}</Tag>
                  <Tag style={{ fontSize: 12, borderRadius: 6, margin: 0, padding: '0 6px', lineHeight: '20px' }}
                    color="blue">{item.category}</Tag>
                </div>
              </div>
              <RightOutlined style={{ color: 'var(--gray-300, #C4BEB4)', fontSize: 12, flexShrink: 0, marginLeft: 8 }} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
