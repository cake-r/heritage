/** 个性化推荐卡片 — 可复用于首页 / 模块推荐 */

import { Card, Tag, Typography } from 'antd'
import { RightOutlined, BulbOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { normalizeImageUrl } from '../../utils/imageUrl'
import type { RecommendationItem } from '../../services/recommendation'

const { Text, Paragraph } = Typography

interface Props {
  item: RecommendationItem
}

export default function RecommendationCard({ item }: Props) {
  const navigate = useNavigate()

  return (
    <Card
      hoverable
      onClick={() => navigate(item.target_route)}
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--gray-200)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        height: '100%',
        transition: 'box-shadow var(--duration-normal) var(--ease-out), transform var(--duration-normal) var(--ease-out)',
      }}
      styles={{ body: { padding: 0 } }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* 缩略图 */}
      <div style={{
        width: '100%',
        height: 160,
        background: item.image_url
          ? `url(${normalizeImageUrl(item.image_url)}) center/cover no-repeat`
          : 'linear-gradient(135deg, var(--color-paper), var(--color-border-light))',
      }} />

      {/* 内容区 */}
      <div style={{ padding: '16px 20px' }}>
        {/* 分类标签 + 地域 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Tag
            color="processing"
            style={{
              margin: 0,
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              background: 'var(--color-vermilion)',
              color: '#fff',
              border: 'none',
            }}
          >
            {item.category}
          </Tag>
          {item.region && (
            <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
              {item.region}
            </Text>
          )}
        </div>

        {/* 标题 */}
        <Text strong style={{ fontSize: 'var(--text-md)', color: 'var(--color-ink)', display: 'block', marginBottom: 8 }}>
          {item.title}
        </Text>

        {/* LLM 推荐理由 */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
          padding: '8px 10px',
          background: 'var(--color-paper)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 8,
        }}>
          <BulbOutlined style={{ color: 'var(--color-gold)', fontSize: 12, marginTop: 2, flexShrink: 0 }} />
          <Paragraph
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-ink-secondary)',
              margin: 0,
              lineHeight: 1.6,
            }}
            ellipsis={{ rows: 2 }}
          >
            {item.reason}
          </Paragraph>
        </div>

        {/* 查看详情 */}
        <div style={{ textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
            去看看 <RightOutlined style={{ fontSize: 10 }} />
          </Text>
        </div>
      </div>
    </Card>
  )
}
