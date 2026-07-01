/** 内容审核工作台 — 审核拓展队列 */

import { useEffect, useState } from 'react'
import { Card, Button, Tag, Typography, Spin, Empty, Space, message, Descriptions } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import api from '../../services/api'
import { normalizeImageUrl } from '../../utils/imageUrl'

const { Title, Paragraph } = Typography

interface QueueItem {
  id: number
  name: string
  category: string
  region?: string
  era?: string
  description?: string
  status: string
  images_json?: string
}

export default function ContentReview() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadQueue = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/expansion/queue', { params: { status: 'pending' } })
      setItems(Array.isArray(data) ? data : data.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadQueue() }, [])

  const handleApprove = async (id: number) => {
    await api.post(`/api/expansion/queue/${id}/approve`)
    message.success('已通过')
    loadQueue()
  }

  const handleReject = async (id: number) => {
    await api.post(`/api/expansion/queue/${id}/reject`)
    message.success('已驳回')
    loadQueue()
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
  if (!items.length) return <Empty description="暂无待审核项目" />

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        内容审核 <Tag>{items.length} 条待审</Tag>
      </Title>

      {items.map((item) => {
        const images = (() => {
          try { return item.images_json ? JSON.parse(item.images_json) : [] } catch { return [] }
        })()
        return (
          <Card
            key={item.id}
            style={{ marginBottom: 16 }}
            title={<span>{item.name} <Tag color="blue">{item.category}</Tag></span>}
            extra={
              <Space>
                <Button type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(item.id)}>
                  通过
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={() => handleReject(item.id)}>
                  驳回
                </Button>
              </Space>
            }
          >
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="地区">{item.region || '-'}</Descriptions.Item>
              <Descriptions.Item label="年代">{item.era || '-'}</Descriptions.Item>
            </Descriptions>
            <Paragraph ellipsis={{ rows: 3, expandable: true }} style={{ marginTop: 8 }}>
              {item.description || '无描述'}
            </Paragraph>
            {images.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {images.slice(0, 4).map((img: string, i: number) => (
                  <img
                    key={i} src={normalizeImageUrl(img)} alt={item.name}
                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }}
                  />
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
