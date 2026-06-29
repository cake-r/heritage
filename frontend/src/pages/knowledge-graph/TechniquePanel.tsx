import { Drawer, Tag, Typography, Row, Col, Card, Spin, Empty, List } from 'antd'
import { getCategoryColor } from '../../utils/categoryColors'
import type { TechniqueDetail } from '../../services/knowledgeGraph'

const { Text, Paragraph } = Typography

interface Props {
  open: boolean
  onClose: () => void
  data: TechniqueDetail | null
  loading: boolean
  onItemClick: (id: number) => void
}

const ERA_ORDER = ['春秋', '战国', '汉', '南北朝', '唐', '宋', '元', '明', '清', '近现代']

export default function TechniquePanel({ open, onClose, data, loading, onItemClick }: Props) {
  if (loading) {
    return (
      <Drawer open={open} onClose={onClose} width={560} title="技法详情">
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      </Drawer>
    )
  }

  if (!data) {
    return (
      <Drawer open={open} onClose={onClose} width={560} title="技法详情">
        <Empty description="未找到技法信息" />
      </Drawer>
    )
  }

  const sortedEras = Object.entries(data.era_distribution)
    .sort(([a], [b]) => {
      const ai = ERA_ORDER.indexOf(a), bi = ERA_ORDER.indexOf(b)
      return (ai >= 0 ? ai : 99) - (bi >= 0 ? bi : 99)
    })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title={`🔧 ${data.name}`}
    >
      {/* 描述 */}
      {data.desc && (
        <div style={{
          padding: '12px 16px', background: 'var(--color-paper-white, #FFFDF9)', borderRadius: 8,
          border: '1px solid var(--color-border-light, #E8E4D8)', marginBottom: 20,
        }}>
          <Paragraph style={{ margin: 0, color: 'var(--color-ink-tertiary, #5A4F42)', lineHeight: 1.8 }}>{data.desc}</Paragraph>
        </div>
      )}

      {/* 使用品类 */}
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>📂 使用品类</Text>
      <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {data.categories.map(c => (
          <Tag key={c} color={getCategoryColor(c)}>{c}</Tag>
        ))}
      </div>

      {/* 时代分布 */}
      {sortedEras.length > 0 && (
        <>
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>📅 时代分布</Text>
          <Row gutter={[6, 6]} style={{ marginBottom: 20 }}>
            {sortedEras.map(([eraName, count]) => (
              <Col span={8} key={eraName}>
                <Card size="small" bodyStyle={{ padding: '8px 10px', textAlign: 'center' }}>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>{eraName}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{count}个项目</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}

      {/* 相关技法 */}
      {data.related_techniques.length > 0 && (
        <>
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>🔗 相关技法</Text>
          <div style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.related_techniques.map(t => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </>
      )}

      {/* 使用此技法的项目 */}
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>📦 使用此技法的非遗项目</Text>
      <List
        dataSource={data.items}
        renderItem={(it: any) => (
          <List.Item
            style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px' }}
            onClick={() => onItemClick(it.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <Tag color={getCategoryColor(it.category)} style={{ margin: 0 }}>{it.category}</Tag>
              <Text strong>{it.name}</Text>
              <div style={{ flex: 1 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>{it.region}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{it.era}</Text>
            </div>
          </List.Item>
        )}
      />
    </Drawer>
  )
}
