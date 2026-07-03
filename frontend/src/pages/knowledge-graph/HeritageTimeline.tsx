import { useEffect, useState } from 'react'
import { Timeline, Typography, Tag, Spin, Empty } from 'antd'
import {
  ClockCircleOutlined,
  BulbOutlined,
  UserOutlined,
  HistoryOutlined,
  UpCircleOutlined,
} from '@ant-design/icons'
import { getHeritageTimeline, type HeritageTimeline, type HeritageTimelineEvent } from '../../services/knowledgeGraph'

const { Text, Paragraph } = Typography

interface HeritageTimelineProps {
  itemId: number
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  origin: { icon: <BulbOutlined />, color: '#B8463A', label: '技艺起源' },
  evolution: { icon: <UpCircleOutlined />, color: '#C4A265', label: '技艺变革' },
  inheritor: { icon: <UserOutlined />, color: '#2B5F8A', label: '传承人' },
  event: { icon: <HistoryOutlined />, color: '#5A4F42', label: '历史事件' },
}

function TimelineEventItem({ event }: { event: HeritageTimelineEvent }) {
  const config = EVENT_CONFIG[event.event_type] || EVENT_CONFIG.event

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Tag color={config.color} style={{ margin: 0, fontSize: 12, lineHeight: '20px' }}>
          {config.label}
        </Tag>
        <Text strong style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink)' }}>
          {event.era}
        </Text>
      </div>
      <Paragraph
        style={{
          margin: 0,
          fontSize: 'var(--text-xs)',
          lineHeight: 1.75,
          color: 'var(--color-ink-tertiary, #5A4F42)',
        }}
      >
        {event.description}
      </Paragraph>
      {event.related_person && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          👤 {event.related_person}
        </Text>
      )}
    </div>
  )
}

export default function HeritageTimelinePanel({ itemId }: HeritageTimelineProps) {
  const [data, setData] = useState<HeritageTimeline | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getHeritageTimeline(itemId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [itemId])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin size="small" tip="生成传承时间线..." />
      </div>
    )
  }

  if (!data || data.timeline.length === 0) {
    return <Empty description="暂无传承时间线数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  const items = data.timeline.map((event, idx) => ({
    dot: (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: idx === 0 ? 'var(--color-vermilion, #B8463A)' : 'var(--color-paper-white, #FFFDF9)',
        border: `2px solid ${idx === 0 ? 'var(--color-vermilion, #B8463A)' : 'var(--color-gold, #C4A265)'}`,
        color: idx === 0 ? '#fff' : 'var(--color-ink)',
        fontSize: 12,
      }}>
        {idx + 1}
      </span>
    ),
    children: <TimelineEventItem event={event} />,
  }))

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ClockCircleOutlined style={{ color: 'var(--color-vermilion, #B8463A)' }} />
        <Text strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
          传承时间线
        </Text>
        <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
          (AI 生成，仅供参考)
        </Text>
      </div>
      <Timeline items={items} />
    </div>
  )
}
