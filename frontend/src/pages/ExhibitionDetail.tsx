import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Typography, Tag, Spin, Empty, Button, Row, Col, Divider, message, Image, Tooltip } from 'antd'
import { ArrowLeft, Share2, MapPin, Calendar, Tag as TagIcon, User, Palette, BookOpen } from 'lucide-react'
import { getItemDetail } from '../services/exhibition'
import { normalizeImageUrl } from '../utils/imageUrl'
import { Icon } from '../config/icons'
import { BrocadePattern } from '../components/decoration'

const { Title, Text, Paragraph } = Typography

interface HeritageItemDetail {
  id: number
  name: string
  category?: string
  region?: string
  era?: string
  description?: string
  images?: string[]
  techniques?: { name: string; desc?: string }[]
  inheritors?: { name: string; title?: string; desc?: string }[]
  cultural_meaning?: string
}

export default function ExhibitionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<HeritageItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError('')
    getItemDetail(Number(id))
      .then(data => setItem(data as HeritageItemDetail))
      .catch(() => setError('加载藏品详情失败'))
      .finally(() => setLoading(false))
  }, [id])

  const handleShare = () => {
    const url = window.location.href
    navigator.clipboard?.writeText(url).then(
      () => message.success('链接已复制，可分享给好友'),
      () => message.info(`分享链接: ${url}`),
    )
  }

  // Loading
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  // Error
  if (error || !item) {
    return (
      <Empty description={error || '藏品不存在'} style={{ marginTop: 80 }}>
        <Button icon={<ArrowLeft size={14} />} onClick={() => navigate('/exhibition')}>返回展厅</Button>
      </Empty>
    )
  }

  const images = item.images || []

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <BrocadePattern opacity={0.1} color="var(--color-ink-secondary)" size={56} />
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Top Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>返回</Button>
          <Tooltip title="复制链接分享">
            <Button icon={<Share2 size={16} />} onClick={handleShare}>分享</Button>
          </Tooltip>
        </div>

        {/* Image Gallery */}
        {images.length > 0 && (
          <Card style={{ borderRadius: 'var(--radius-lg)', marginBottom: 24, overflow: 'hidden' }} bodyStyle={{ padding: 0 }}>
            {images.length === 1 ? (
              <img src={normalizeImageUrl(images[0])} alt={item.name} loading="lazy"
                style={{ width: '100%', maxHeight: 600, objectFit: 'contain', display: 'block', background: 'var(--color-paper)' }} />
            ) : (
              <Image.PreviewGroup>
                <Row gutter={4}>
                  {images.map((img, i) => (
                    <Col span={images.length <= 2 ? 12 : 8} key={i}>
                      <Image src={normalizeImageUrl(img)} alt={`${item.name}-${i + 1}`}
                        style={{ width: '100%', objectFit: 'contain' }}
                        preview={{ mask: '点击查看大图' }} />
                    </Col>
                  ))}
                </Row>
              </Image.PreviewGroup>
            )}
          </Card>
        )}

        {/* Main Info */}
        <Card style={{ borderRadius: 'var(--radius-lg)', marginBottom: 24 }} bodyStyle={{ padding: '32px 28px' }}>
          <Title level={2} style={{ fontFamily: 'var(--font-display)', marginBottom: 12 }}>
            {item.name}
          </Title>

          {/* Meta Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {item.category && (
              <Tag color="#B8463A" style={{ fontSize: 14, padding: '2px 12px' }}>
                <Palette size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />{item.category}
              </Tag>
            )}
            {item.region && (
              <Tag color="#C4A265" style={{ fontSize: 14, padding: '2px 12px' }}>
                <MapPin size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />{item.region}
              </Tag>
            )}
            {item.era && (
              <Tag style={{ fontSize: 14, padding: '2px 12px' }}>
                <Calendar size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />{item.era}
              </Tag>
            )}
          </div>

          {/* Description */}
          <Paragraph style={{ fontSize: 'var(--text-base)', lineHeight: 1.9, color: 'var(--color-ink)', whiteSpace: 'pre-wrap' }}>
            {item.description || '暂无描述信息'}
          </Paragraph>

          {/* Cultural Meaning */}
          {item.cultural_meaning && (
            <>
              <Divider />
              <Title level={5} style={{ marginBottom: 8 }}>
                <BookOpen size={16} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--color-gold)' }} />
                文化意义
              </Title>
              <Paragraph style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)', lineHeight: 1.8 }}>
                {item.cultural_meaning}
              </Paragraph>
            </>
          )}
        </Card>

        {/* Techniques + Inheritors */}
        <Row gutter={24}>
          {item.techniques && item.techniques.length > 0 && (
            <Col xs={24} md={12}>
              <Card
                title={<><TagIcon size={16} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--color-gold)' }} />工艺技法</>}
                style={{ borderRadius: 'var(--radius-lg)', height: '100%' }}
              >
                {item.techniques.map((t, i) => (
                  <div key={i} style={{ marginBottom: i < item.techniques!.length - 1 ? 16 : 0 }}>
                    <Text strong style={{ fontSize: 'var(--text-sm)' }}>{t.name}</Text>
                    {t.desc && <Paragraph type="secondary" style={{ fontSize: 'var(--text-xs)', marginBottom: 0, marginTop: 4 }}>{t.desc}</Paragraph>}
                  </div>
                ))}
              </Card>
            </Col>
          )}
          {item.inheritors && item.inheritors.length > 0 && (
            <Col xs={24} md={item.techniques?.length ? 12 : 24}>
              <Card
                title={<><User size={16} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--color-gold)' }} />传承人</>}
                style={{ borderRadius: 'var(--radius-lg)', height: '100%' }}
              >
                {item.inheritors.map((inh, i) => (
                  <div key={i} style={{ marginBottom: i < item.inheritors!.length - 1 ? 16 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 'var(--text-sm)' }}>{inh.name}</Text>
                      {inh.title && <Tag color="gold" style={{ margin: 0 }}>{inh.title}</Tag>}
                    </div>
                    {inh.desc && <Paragraph type="secondary" style={{ fontSize: 'var(--text-xs)', marginBottom: 0, lineHeight: 1.7 }}>{inh.desc}</Paragraph>}
                  </div>
                ))}
              </Card>
            </Col>
          )}
        </Row>
      </div>
    </div>
  )
}
