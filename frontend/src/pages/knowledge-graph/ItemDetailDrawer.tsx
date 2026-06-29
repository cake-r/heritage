import { Drawer, Image, Tag, Typography, Space, Collapse, Row, Col, Card, Button, Empty } from 'antd'
import { HeartOutlined, HeartFilled, LinkOutlined, ToolOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getCategoryColor } from '../../utils/categoryColors'
import { normalizeImageUrl } from '../../utils/imageUrl'

const { Text, Paragraph } = Typography

interface ItemDetailDrawerProps {
  open: boolean
  onClose: () => void
  item: Record<string, any> | null
  related: {
    same_category: any[]
    same_region: any[]
    shared_techniques: any[]
  } | null
  onRelatedClick: (id: number) => void
  isFavorited: boolean
  onToggleFavorite: () => void
}

export default function ItemDetailDrawer({
  open, onClose, item, related, onRelatedClick, isFavorited, onToggleFavorite,
}: ItemDetailDrawerProps) {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (!item) return null

  const techniques = item.techniques || []
  const inheritors = item.inheritors || []
  const images = item.images || []

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={680}
      title={item.name}
      extra={
        <Space>
          <Button
            type={isFavorited ? 'primary' : 'default'}
            icon={isFavorited ? <HeartFilled /> : <HeartOutlined />}
            onClick={onToggleFavorite}
            danger={isFavorited}
            disabled={!isAuthenticated}
          >
            {isFavorited ? '取消收藏' : '收藏'}
          </Button>
          <Button icon={<LinkOutlined />} onClick={() => { navigate(`/exhibition?id=${item.id}`); onClose() }}>
            展厅查看
          </Button>
        </Space>
      }
    >
      {/* 图片 */}
      {images.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <Image.PreviewGroup>
            <Row gutter={[8, 8]}>
              {images.map((img: string, i: number) => (
                <Col span={images.length === 1 ? 24 : 12} key={i}>
                  <Image src={normalizeImageUrl(img)} alt={`${item.name} ${i + 1}`} style={{ width: '100%', borderRadius: 8 }} />
                </Col>
              ))}
            </Row>
          </Image.PreviewGroup>
        </div>
      ) : (
        <Empty description="暂无图片" style={{ marginBottom: 24 }} />
      )}

      {/* 标签 */}
      <Space wrap size={4} style={{ marginBottom: 16 }}>
        <Tag color={getCategoryColor(item.category)} style={{ fontSize: 14 }}>{item.category}</Tag>
        {item.region && <Tag color="blue">{item.region}</Tag>}
        {item.era && <Tag color="gold">{item.era}</Tag>}
      </Space>

      {/* 描述 */}
      {item.description && (
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ fontSize: 15 }}>📖 简介</Text>
          <div style={{
            marginTop: 8, lineHeight: 1.9, maxHeight: 300, overflowY: 'auto',
            padding: '12px 16px', background: 'var(--color-paper-white, #FFFDF9)', borderRadius: 8,
            border: '1px solid var(--color-border-light, #E8E4D8)',
          }}>
            <Paragraph style={{ margin: 0, color: 'var(--color-ink-tertiary, #5A4F42)' }}>{item.description}</Paragraph>
          </div>
        </div>
      )}

      {/* 技法 */}
      {techniques.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Collapse ghost expandIconPosition="end" items={[{
            key: 'techniques',
            label: <Text strong style={{ fontSize: 15 }}>🔧 工艺技法 ({techniques.length}项)</Text>,
            children: techniques.map((t: any, i: number) => (
              <Card key={i} size="small" style={{ marginBottom: 8, background: 'var(--color-paper-white, #FFFDF9)', borderRadius: 8 }}>
                <Text strong style={{ color: 'var(--color-vermilion, #B8463A)' }}>{t.name}</Text>
                {t.desc && <Paragraph style={{ margin: '8px 0 0', color: 'var(--color-ink-tertiary, #5A4F42)', lineHeight: 1.7 }}>{t.desc}</Paragraph>}
              </Card>
            )),
          }]} />
        </div>
      )}

      {/* 传承人 */}
      {inheritors.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Collapse ghost expandIconPosition="end" items={[{
            key: 'inheritors',
            label: <Text strong style={{ fontSize: 15 }}>👤 传承人 ({inheritors.length}位)</Text>,
            children: inheritors.map((inh: any, i: number) => (
              <Card key={i} size="small" style={{ marginBottom: 8, background: 'var(--color-paper-white, #FFFDF9)', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong>{inh.name}</Text>
                  {inh.title && <Tag color="gold">{inh.title}</Tag>}
                </div>
                {inh.desc && <Paragraph style={{ margin: '8px 0 0', color: '#5a5045', lineHeight: 1.7 }}>{inh.desc}</Paragraph>}
              </Card>
            )),
          }]} />
        </div>
      )}

      {/* 修复建议 — 年代久远的藏品 */}
      {isAuthenticated && item.era && _isAncientEra(item.era) && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, #FFF8F5, #FFFDF9)',
            border: '1px solid var(--color-vermilion, #B8463A)',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ToolOutlined style={{ color: 'var(--color-vermilion, #B8463A)', fontSize: 20 }} />
            <div style={{ flex: 1 }}>
              <Text strong style={{ color: 'var(--color-ink, #2C241A)' }}>该藏品年代久远（{item.era}），可能存在损伤？</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>试试 AI 数字修复技术，让文物重现光彩</Text>
            </div>
          </div>
          <Button
            type="primary"
            size="small"
            icon={<ToolOutlined />}
            onClick={() => { navigate('/restoration'); onClose() }}
            style={{ marginTop: 8, width: '100%' }}
          >
            AI 修复
          </Button>
        </Card>
      )}

      {/* 文化寓意 */}
      {item.cultural_meaning && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15 }}>🎭 文化寓意</Text>
          <div style={{
            marginTop: 8, lineHeight: 1.9, maxHeight: 300, overflowY: 'auto',
            padding: '12px 16px', background: 'var(--color-paper-white, #FFFDF9)', borderRadius: 8,
            border: '1px solid var(--color-border-light, #E8E4D8)',
          }}>
            <Paragraph style={{ margin: 0, color: 'var(--color-ink-tertiary, #5A4F42)' }}>{item.cultural_meaning}</Paragraph>
          </div>
        </div>
      )}

      {/* 相关项目 */}
      {related && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border-light, #E8E4D8)' }}>
          <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 12 }}>🔗 相关非遗项目</Text>
          {related.same_category.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>同类项目</Text>
              <Row gutter={[8, 8]} style={{ marginTop: 4 }}>
                {related.same_category.slice(0, 3).map((r: any) => (
                  <Col span={8} key={r.id}>
                    <Card size="small" hoverable onClick={() => onRelatedClick(r.id)} bodyStyle={{ padding: 8 }}>
                      {r.image && <img src={r.image} alt={r.name} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, marginBottom: 4 }} />}
                      <Text style={{ fontSize: 12 }}>{r.name}</Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          )}
          {related.shared_techniques.filter((r: any) => !related.same_category.find((s: any) => s.id === r.id)).length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>共享技法</Text>
              <Row gutter={[8, 8]} style={{ marginTop: 4 }}>
                {related.shared_techniques.filter((r: any) => !related.same_category.find((s: any) => s.id === r.id)).slice(0, 3).map((r: any) => (
                  <Col span={8} key={r.id}>
                    <Card size="small" hoverable onClick={() => onRelatedClick(r.id)} bodyStyle={{ padding: 8 }}>
                      {r.image && <img src={r.image} alt={r.name} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4, marginBottom: 4 }} />}
                      <Text style={{ fontSize: 12 }}>{r.name}</Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}

/** 判断年代是否足够古老（宋代及更早） */
function _isAncientEra(era: string): boolean {
  if (!era) return false
  const ancient = ['夏', '商', '周', '春秋', '战国', '秦', '汉', '三国', '晋', '南北朝', '隋', '唐', '五代', '宋', '北宋', '南宋', '辽', '金', '西夏', '元']
  return ancient.some(a => era.includes(a))
}
