import { Tag } from 'antd'
import { UserOutlined, MessageOutlined, ClockCircleOutlined } from '@ant-design/icons'
import type { InheritorInfo } from './index'

interface Props {
  inheritor?: InheritorInfo
  messageCount: number
  sessionCount: number
}

export default function WorkshopStatusBar({ inheritor, messageCount, sessionCount }: Props) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 20px',
      background: 'var(--color-paper-white, #FFFDF9)',
      borderRadius: 8,
      border: '1px solid var(--color-paper, #F7F4ED)',
      fontSize: 13,
      color: 'var(--color-ink-secondary, #6B5F52)',
    }}>
      {/* 左侧：传承人信息 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {inheritor ? (
          <>
            <span style={{ fontWeight: 600, color: 'var(--color-ink, #2C241A)' }}>
              <UserOutlined style={{ marginRight: 4 }} />
              {inheritor.name}
            </span>
            {inheritor.expertise.slice(0, 3).map(e => (
              <Tag key={e} style={{ fontSize: 12, margin: 0, lineHeight: '20px' }}>{e}</Tag>
            ))}
            {inheritor.isCustom && (
              <Tag color="gold" style={{ fontSize: 12, margin: 0, lineHeight: '20px' }}>自定义</Tag>
            )}
          </>
        ) : (
          <span>未选择传承人</span>
        )}
      </div>

      {/* 右侧：统计 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <span>
          <MessageOutlined style={{ marginRight: 4 }} />
          {messageCount} 条消息
        </span>
        <span>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {sessionCount} 个会话
        </span>
      </div>
    </div>
  )
}
