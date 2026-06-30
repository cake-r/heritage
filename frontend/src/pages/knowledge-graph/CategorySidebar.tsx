import { useMemo } from 'react'
import { Tag, Tooltip } from 'antd'
import { getCategoryColor, hexToRgb } from '../../utils/categoryColors'
import type { CategoryStat } from '../../services/knowledgeGraph'

interface Props {
  categories: CategoryStat[]
  categoryList: { name: string; count: number }[]
  techniqueList: { name: string; count: number; primaryCategory: string }[]
  drilledCategory: string | null
  onCategoryClick: (name: string) => void
  onTechniqueClick: (name: string) => void
}

export default function CategorySidebar({
  categories,
  categoryList,
  techniqueList,
  drilledCategory,
  onCategoryClick,
  onTechniqueClick,
}: Props) {
  // Sort categories by item_count desc
  const sortedCategories = useMemo(() => {
    const list = categoryList.length > 0
      ? categoryList
      : categories.map(c => ({ name: c.name, count: c.item_count }))
    return list.sort((a, b) => b.count - a.count)
  }, [categories, categoryList])

  if (!categories.length) {
    return (
      <div style={{ width: 240, padding: 16, background: 'var(--color-paper-white, #FFFDF9)', borderRadius: 12, fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary, #6B5F52)', textAlign: 'center' }}>
        暂无品类数据
      </div>
    )
  }

  return (
    <div style={{
      width: 240,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      overflow: 'hidden',
    }}>
      {/* Category Tree */}
      <div style={{
        background: 'var(--color-paper-white, #FFFDF9)',
        borderRadius: 12,
        padding: '16px 12px',
        border: '1px solid var(--color-border-light, #E8E4D8)',
        maxHeight: 360,
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-ink, #2C241A)', marginBottom: 12, padding: '0 8px' }}>
          📂 非遗品类
        </div>

        {/* "All" option */}
        <div
          onClick={() => onCategoryClick('')}
          style={{
            padding: '10px 8px',
            borderRadius: 8,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: !drilledCategory ? 'var(--color-bg-active, #FFF3E0)' : 'transparent',
            fontWeight: !drilledCategory ? 600 : 400,
            marginBottom: 2,
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { if (drilledCategory) (e.currentTarget.style.background = 'var(--color-bg-hover, #F5F5F0)') }}
          onMouseLeave={e => { if (drilledCategory) (e.currentTarget.style.background = 'transparent') }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gray-500, #8A8378)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>全部</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary, #6B5F52)', minWidth: 24, textAlign: 'center' }}>{categories.reduce((s, c) => s + c.item_count, 0)}</span>
        </div>

        {/* Category items */}
        {sortedCategories.map(cat => {
          const color = getCategoryColor(cat.name)
          const isActive = drilledCategory === cat.name
          return (
            <div
              key={cat.name}
              onClick={() => onCategoryClick(isActive ? '' : cat.name)}
              style={{
                padding: '10px 8px',
                borderRadius: 8,
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: isActive ? 'var(--color-bg-active, #FFF3E0)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget.style.background = 'var(--color-bg-hover, #F5F5F0)') }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget.style.background = 'transparent') }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{cat.name}</span>
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-secondary, #6B5F52)',
                background: isActive ? 'var(--color-paper-white, #FFFDF9)' : 'var(--color-paper, #F7F4ED)',
                borderRadius: 6,
                padding: '0 6px',
                minWidth: 24,
                textAlign: 'center',
              }}>
                {cat.count}
              </span>
            </div>
          )
        })}
      </div>

      {/* Technique Tag Cloud */}
      {techniqueList.length > 0 && (
        <div style={{
          background: 'var(--color-paper-white, #FFFDF9)',
          borderRadius: 12,
          padding: '16px 12px',
          border: '1px solid var(--color-border-light, #E8E4D8)',
          overflowY: 'auto',
          flex: 1,
        }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-ink, #2C241A)', marginBottom: 12, padding: '0 8px' }}>
            🏷️ 技法标签
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 4px' }}>
            {techniqueList.map(tech => {
              const color = getCategoryColor(tech.primaryCategory)
              const rgb = hexToRgb(color)
              return (
                <Tooltip key={tech.name} title={`${tech.primaryCategory} · ${tech.count}个项目`}>
                  <Tag
                    style={{
                      cursor: 'pointer',
                      borderRadius: 6,
                      fontSize: 'var(--text-xs)',
                      padding: '6px 12px',
                      borderColor: color,
                      color: color,
                      background: `rgba(${rgb}, 0.08)`,
                      margin: 0,
                    }}
                    onClick={() => onTechniqueClick(tech.name)}
                  >
                    {tech.name}
                  </Tag>
                </Tooltip>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
