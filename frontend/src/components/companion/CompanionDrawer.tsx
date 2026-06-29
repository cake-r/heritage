/** AI 伴游 Drawer — 右侧滑入面板 */

import { Drawer, Card, Typography, Skeleton, Button, Empty, Space, Tag } from 'antd'
import { RightOutlined, RobotOutlined, BulbOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCompanion } from '../../contexts/CompanionContext'
import type { CompanionSuggestion } from '../../services/companion'

const { Text, Paragraph, Title } = Typography

const CATEGORY_LABELS: Record<string, string> = {
  progression: '继续探索',
  discovery: '发现新知',
  quest: '修习任务',
  related: '关联推荐',
}

const CATEGORY_COLORS: Record<string, string> = {
  progression: 'var(--color-info)',
  discovery: 'var(--color-gold)',
  quest: 'var(--color-vermilion)',
  related: 'var(--color-success)',
}

function SuggestionCard({ item, onNavigate }: { item: CompanionSuggestion; onNavigate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card
        hoverable
        onClick={onNavigate}
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--gray-200)',
          marginBottom: 12,
          boxShadow: 'var(--shadow-sm)',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          {/* 图标 */}
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-paper)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            flexShrink: 0,
          }}>
            {item.icon}
          </div>

          {/* 内容 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
                {item.title}
              </Text>
              <Tag
                style={{
                  margin: 0,
                  fontSize: 10,
                  borderRadius: 'var(--radius-sm)',
                  background: CATEGORY_COLORS[item.category] || 'var(--color-info)',
                  color: '#fff',
                  border: 'none',
                  lineHeight: '18px',
                  padding: '0 6px',
                }}
              >
                {CATEGORY_LABELS[item.category] || item.category}
              </Tag>
            </div>
            <Paragraph
              type="secondary"
              style={{ fontSize: 'var(--text-xs)', margin: 0, lineHeight: 1.6 }}
              ellipsis={{ rows: 2 }}
            >
              {item.description}
            </Paragraph>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <BulbOutlined style={{ fontSize: 10, color: 'var(--color-gold)' }} />
                <Text type="secondary" style={{ fontSize: 10 }}>
                  {Math.round(item.confidence * 100)}% 匹配
                </Text>
              </div>
              <Button
                type="link"
                size="small"
                icon={<RightOutlined />}
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-vermilion)' }}
              >
                去看看
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default function CompanionDrawer() {
  const navigate = useNavigate()
  const { visible, closeDrawer, suggestions, loading, context } = useCompanion()

  const handleNavigate = (route: string) => {
    navigate(route)
    closeDrawer()
  }

  return (
    <Drawer
      open={visible}
      onClose={closeDrawer}
      placement="right"
      width={380}
      styles={{
        body: { padding: '16px 20px' },
        header: { padding: '16px 20px', borderBottom: '1px solid var(--gray-100)' },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RobotOutlined style={{ fontSize: 20, color: 'var(--color-vermilion)' }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-md)',
            fontWeight: 600,
            letterSpacing: 2,
            color: 'var(--color-ink)',
          }}>
            文博灵境 · AI 伴游
          </span>
        </div>
      }
    >
      {/* 用户上下文摘要 */}
      {context && (
        <div style={{
          padding: '12px 14px',
          background: 'linear-gradient(135deg, rgba(196,162,101,0.08), rgba(184,70,58,0.04))',
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)', lineHeight: 1.8 }}>
            {context.user_summary}
          </Text>
          {context.recent_activity.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {context.recent_activity.map((act, i) => (
                <Tag key={i} style={{
                  fontSize: 10,
                  background: 'var(--color-paper)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-ink-secondary)',
                }}>
                  {act}
                </Tag>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 加载态 */}
      {loading && (
        <>
          {[1, 2, 3].map(i => (
            <Card key={i} style={{ borderRadius: 'var(--radius-lg)', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Skeleton.Avatar active size={48} shape="square" style={{ borderRadius: 8 }} />
                <div style={{ flex: 1 }}>
                  <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
                  <Skeleton active paragraph={{ rows: 2 }} title={false} />
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      {/* 建议列表 */}
      {!loading && suggestions.length > 0 && (
        <div>
          <Text type="secondary" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 12 }}>
            💡 为你准备了 {suggestions.length} 条个性化建议
          </Text>
          {suggestions.map(item => (
            <SuggestionCard
              key={item.id}
              item={item}
              onNavigate={() => handleNavigate(item.target_route)}
            />
          ))}
        </div>
      )}

      {/* 空态 */}
      {!loading && suggestions.length === 0 && (
        <Empty
          description="暂时没有新的建议"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 40 }}
        >
          <Text type="secondary" style={{ fontSize: 'var(--text-sm)' }}>
            继续探索非遗世界，我会在你需要时出现 ✨
          </Text>
        </Empty>
      )}
    </Drawer>
  )
}
