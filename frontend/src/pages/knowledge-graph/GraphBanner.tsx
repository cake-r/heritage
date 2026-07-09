import { Typography, Tag, Button, Space } from 'antd'
import { X, MapPin, Calendar } from 'lucide-react'
import { useFilters } from './FilterContext'

const { Title, Text } = Typography

interface Props {
  drilledCategory: string | null
  techniqueName?: string
}

export default function GraphBanner({ drilledCategory, techniqueName }: Props) {
  const { activeTags, clearFilters, hasActiveFilters } = useFilters()

  const breadcrumb = ['总览']
  if (drilledCategory) breadcrumb.push(drilledCategory)
  if (techniqueName) breadcrumb.push(techniqueName)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div>
        <Title level={4} style={{ margin: 0, display: 'inline', marginRight: 12 }}>
          非遗探索
        </Title>
        <Text type="secondary" style={{ fontSize: 'var(--text-sm)' }}>
          {breadcrumb.join(' > ')}
        </Text>
      </div>

      <Space wrap size={4}>
        {activeTags.map(tag => (
          <Tag
            key={tag.key}
            closable
            onClose={tag.onClose}
            closeIcon={<X />}
            color={tag.key === 'region' ? 'blue' : 'gold'}
          >
            {tag.key === 'region' ? <MapPin size={12} style={{ marginRight: 3 }} /> : <Calendar size={12} style={{ marginRight: 3 }} />}
            {tag.label}
          </Tag>
        ))}
        {hasActiveFilters && (
          <Button size="middle" onClick={clearFilters}>清除筛选</Button>
        )}
      </Space>
    </div>
  )
}
