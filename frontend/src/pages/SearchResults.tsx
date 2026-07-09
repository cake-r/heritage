import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Input, Card, Typography, Tag, Spin, Empty, Tabs, Row, Col, Button } from 'antd'
import { Search, ArrowLeft, ExternalLink, User, Image, BookOpen } from 'lucide-react'
import { globalSearch, type SearchResult } from '../services/search'
import { normalizeImageUrl } from '../utils/imageUrl'
import { Icon } from '../config/icons'
import { BrocadePattern } from '../components/decoration'

const { Title, Text } = Typography

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  heritage: { icon: <BookOpen size={14} />, label: '非遗藏品', color: 'var(--color-vermilion)' },
  inheritor: { icon: <User size={14} />, label: '传承人', color: 'var(--color-gold)' },
  upload: { icon: <Image size={14} />, label: '用户上传', color: 'var(--color-info)' },
}

export default function SearchResults() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q') || ''
  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await globalSearch(q, 'all', 20)
      setResults(data.results)
      setTotal(data.total)
    } catch {
      setError('搜索失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (query) doSearch(query)
  }, [query, doSearch])

  const filtered = activeTab === 'all'
    ? results
    : results.filter(r => r.type === activeTab)

  const heritageCount = results.filter(r => r.type === 'heritage').length
  const inheritorCount = results.filter(r => r.type === 'inheritor').length
  const uploadCount = results.filter(r => r.type === 'upload').length

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 1 }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <BrocadePattern opacity={0.12} color="var(--color-ink-secondary)" size={56} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* 顶部搜索栏 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} />
          <Input.Search
            size="large"
            defaultValue={query}
            placeholder="搜索藏品、传承人..."
            prefix={<Search size={16} style={{ opacity: 0.4 }} />}
            onSearch={val => {
              if (val.trim()) {
                navigate(`/search?q=${encodeURIComponent(val.trim())}`, { replace: true })
              }
            }}
            style={{ flex: 1, maxWidth: 500 }}
          />
        </div>

        {/* 加载 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>搜索中...</Text>
          </div>
        )}

        {/* 错误 */}
        {!loading && error && <Empty description={error} style={{ marginTop: 80 }} />}

        {/* 空结果 */}
        {!loading && !error && query && results.length === 0 && (
          <Empty description={`未找到与 "${query}" 相关的内容`} style={{ marginTop: 80 }}>
            <Text type="secondary">尝试使用不同的关键词，如藏品名称、地域、品类</Text>
          </Empty>
        )}

        {/* 结果 */}
        {!loading && !error && results.length > 0 && (
          <>
            <Title level={4} style={{ marginBottom: 4 }}>
              搜索 "{query}" — 共 {total} 个结果
            </Title>

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              style={{ marginBottom: 16 }}
              items={[
                { key: 'all', label: `全部 (${total})` },
                { key: 'heritage', label: `藏品 (${heritageCount})`, disabled: heritageCount === 0 },
                { key: 'inheritor', label: `传承人 (${inheritorCount})`, disabled: inheritorCount === 0 },
                { key: 'upload', label: `上传 (${uploadCount})`, disabled: uploadCount === 0 },
              ]}
            />

            <Row gutter={[16, 16]}>
              {filtered.map(r => {
                const cfg = TYPE_CONFIG[r.type]
                return (
                  <Col xs={24} sm={12} lg={8} key={`${r.type}-${r.id}`}>
                    <Card
                      hoverable
                      className="gradient-border-card"
                      onClick={() => navigate(r.route)}
                      style={{ borderRadius: 'var(--radius-lg)', height: '100%' }}
                      cover={
                        r.image_url ? (
                          <div style={{ height: 160, overflow: 'hidden', background: 'var(--gray-100)' }}>
                            <img
                              src={normalizeImageUrl(r.image_url)}
                              alt={r.title}
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div style={{
                            height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'var(--gray-100)', color: 'var(--gray-400)',
                          }}>
                            <Icon name={r.type === 'heritage' ? 'building2' : r.type === 'inheritor' ? 'user' : 'image'} size={40} />
                          </div>
                        )
                      }
                    >
                      <Tag color={cfg.color === 'var(--color-vermilion)' ? '#B8463A' : cfg.color === 'var(--color-gold)' ? '#C4A265' : '#1677FF'}>
                        {cfg.icon} {cfg.label}
                      </Tag>
                      <Title level={5} style={{ marginTop: 8, marginBottom: 4 }}>{r.title}</Title>
                      <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>{r.subtitle}</Text>
                    </Card>
                  </Col>
                )
              })}
            </Row>
          </>
        )}
      </div>
    </div>
  )
}
