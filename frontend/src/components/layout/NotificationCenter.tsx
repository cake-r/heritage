/** 通知中心 — 铃铛图标 + Popover 面板 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Popover, Button, Badge, List, Typography, Empty, Space } from 'antd'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { useNotificationStore, type AppNotification } from '../../stores/notificationStore'

const { Text } = Typography

const TYPE_EMOJI: Record<string, string> = {
  achievement: '🏅',
  stamp: '📜',
  rank_up: '⬆️',
  quest: '✅',
  system: '💡',
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  return `${Math.floor(hr / 30)}天前`
}

export default function NotificationCenter() {
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead, clearRead } = useNotificationStore()
  const [open, setOpen] = useState(false)

  const handleClick = (n: AppNotification) => {
    markRead(n.id)
    if (n.route) {
      setOpen(false)
      navigate(n.route)
    }
  }

  const content = (
    <div style={{ width: 340 }}>
      {/* 顶部操作栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 8,
        borderBottom: '1px solid var(--gray-100)',
        marginBottom: 4,
      }}>
        <Text strong style={{ fontSize: 'var(--text-sm)' }}>
          通知中心
          {unreadCount > 0 && (
            <span style={{ color: 'var(--color-vermilion)', marginLeft: 6, fontSize: 'var(--text-xs)' }}>
              ({unreadCount}条未读)
            </span>
          )}
        </Text>
        <Space size={4}>
          {unreadCount > 0 && (
            <Button type="text" size="small" icon={<CheckCheck size={14} />} onClick={markAllRead}>
              全部已读
            </Button>
          )}
          <Button
            type="text"
            size="small"
            icon={<Trash2 size={14} />}
            onClick={clearRead}
            disabled={notifications.every(n => n.read)}
          />
        </Space>
      </div>

      {/* 列表 */}
      {notifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无通知"
          style={{ padding: '24px 0' }}
        />
      ) : (
        <List
          style={{ maxHeight: 400, overflow: 'auto' }}
          dataSource={notifications}
          renderItem={(n) => (
            <List.Item
              key={n.id}
              onClick={() => handleClick(n)}
              style={{
                cursor: n.route ? 'pointer' : 'default',
                padding: '10px 8px',
                borderRadius: 8,
                background: n.read ? 'transparent' : 'rgba(196,162,101,0.04)',
                borderBottom: '1px solid var(--gray-50)',
                transition: 'background 0.2s',
              }}
            >
              <List.Item.Meta
                avatar={
                  <span style={{ fontSize: 22, flexShrink: 0 }}>
                    {n.icon || TYPE_EMOJI[n.type] || '📌'}
                  </span>
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 'var(--text-xs)',
                      fontWeight: n.read ? 400 : 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 220,
                    }}>
                      {n.title}
                    </span>
                    {!n.read && (
                      <span style={{
                        width: 6, height: 6, borderRadius: 3,
                        background: 'var(--color-vermilion)', flexShrink: 0,
                      }} />
                    )}
                  </div>
                }
                description={
                  <div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
                      {n.description}
                    </span>
                    <br />
                    <span style={{ fontSize: 11, color: 'var(--color-border-medium)' }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow={false}
      overlayInnerStyle={{ borderRadius: 12, padding: 12 }}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<Bell size={25} />}
          aria-label="通知中心"
        />
      </Badge>
    </Popover>
  )
}
