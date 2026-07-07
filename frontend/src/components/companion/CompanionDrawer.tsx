/** AI 伴游 Drawer — v2 对话式导游面板
 *
 * Live2D 模型统一由右下角 FloatButton 承载，Drawer 只做聊天面板。
 */

import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Drawer, Typography, Button, Input, Space, Tag, Skeleton, Empty } from 'antd'
import { Send, Bot, Trash2, User, Lightbulb } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCompanion } from '../../contexts/CompanionContext'
import type { CompanionSuggestion } from '../../services/companion'
import type { CompanionChatMsg } from '../../contexts/CompanionContext'

const { Text, Paragraph } = Typography

const CATEGORY_LABELS: Record<string, string> = {
  progression: '继续探索',
  discovery: '发现新知',
  quest: '修习任务',
  related: '关联推荐',
}

const CATEGORY_COLORS: Record<string, string> = {
  progression: 'var(--color-info, #1677ff)',
  discovery: 'var(--color-gold, #C4A265)',
  quest: 'var(--color-vermilion, #B8463A)',
  related: 'var(--color-success, #52c41a)',
}

/** 单条建议卡片 */
function SuggestionInline({
  item,
  onClick,
}: {
  item: CompanionSuggestion
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 10,
        padding: '10px 12px',
        marginTop: 8,
        background: 'var(--color-paper-white, #FFFDF9)',
        border: '1px solid var(--color-paper, #F7F4ED)',
        borderRadius: 'var(--radius-md, 8px)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
    >
      <span style={{ fontSize: 20, flexShrink: 0, lineHeight: '22px' }}>{item.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text strong style={{ fontSize: 'var(--text-sm)', lineHeight: '20px' }}>{item.title}</Text>
          <Tag
            style={{
              margin: 0,
              fontSize: 10,
              lineHeight: '16px',
              padding: '0 5px',
              borderRadius: 'var(--radius-sm, 4px)',
              background: CATEGORY_COLORS[item.category] || 'var(--color-info)',
              color: '#fff',
              border: 'none',
            }}
          >
            {CATEGORY_LABELS[item.category] || item.category}
          </Tag>
        </div>
        <Paragraph
          type="secondary"
          style={{ fontSize: 'var(--text-xs)', margin: 0, lineHeight: '18px' }}
          ellipsis={{ rows: 2 }}
        >
          {item.description}
        </Paragraph>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Lightbulb style={{ fontSize: 10, color: 'var(--color-gold)' }} />
          <Text type="secondary" style={{ fontSize: 10 }}>{Math.round(item.confidence * 100)}% 匹配</Text>
        </div>
      </div>
    </div>
  )
}

/** 单条聊天消息 */
function ChatBubble({
  msg,
  onSuggestionClick,
}: {
  msg: CompanionChatMsg
  onSuggestionClick: (s: CompanionSuggestion) => void
}) {
  const isUser = msg.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 8,
        alignItems: 'flex-start',
        marginBottom: 14,
      }}
    >
      {/* 头像 */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: isUser ? 'var(--color-vermilion, #B8463A)' : 'var(--color-gold-light, #E8D5B0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 14,
        color: isUser ? '#fff' : 'var(--color-ink, #2C241A)',
      }}>
        {isUser ? <User /> : <Bot />}
      </div>

      {/* 气泡 */}
      <div style={{
        maxWidth: '82%',
        padding: '10px 14px',
        borderRadius: 10,
        background: isUser ? 'var(--color-vermilion, #B8463A)' : 'var(--color-paper, #F7F4ED)',
        color: isUser ? '#fff' : 'var(--color-ink, #2C241A)',
        fontSize: 'var(--text-sm)',
        lineHeight: 1.65,
        wordBreak: 'break-word',
      }}>
        <span>{msg.content}</span>

        {/* 关联建议（仅 assistant 消息） */}
        {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {msg.suggestions.map(s => (
              <SuggestionInline
                key={s.id}
                item={s}
                onClick={() => onSuggestionClick(s)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/** 欢迎页 — 首次打开 Drawer 且无聊天记录 */
function WelcomePanel({
  context,
  suggestions,
  loading,
  onSuggestionClick,
  onQuickMessage,
}: {
  context: CompanionContext | null
  suggestions: CompanionSuggestion[]
  loading: boolean
  onSuggestionClick: (s: CompanionSuggestion) => void
  onQuickMessage: (msg: string) => void
}) {
  const quickQs = [
    '带我去看看非遗藏品',
    '推荐一个适合我的功能',
    '最近有什么值得探索的？',
  ]

  return (
    <div style={{ padding: '0 4px' }}>
      {/* 用户摘要 */}
      {context && (
        <div style={{
          padding: '12px 14px',
          background: 'linear-gradient(135deg, rgba(196,162,101,0.08), rgba(184,70,58,0.04))',
          borderRadius: 'var(--radius-md, 8px)',
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)', lineHeight: 1.7 }}>
            {context.user_summary}
          </Text>
          {context.recent_activity.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {context.recent_activity.map((act, i) => (
                <Tag key={i} style={{
                  fontSize: 'var(--text-xs)',
                  background: 'var(--color-paper)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-ink-secondary)',
                  lineHeight: '18px',
                  margin: 0,
                }}>
                  {act}
                </Tag>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 快捷提问 */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 8 }}>
          💬 试试问我：
        </Text>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {quickQs.map((q, i) => (
            <Button
              key={i}
              type="default"
              size="small"
              block
              onClick={() => onQuickMessage(q)}
              style={{
                textAlign: 'left',
                fontSize: 'var(--text-xs)',
                height: 34,
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--color-paper, #F7F4ED)',
              }}
            >
              {q}
            </Button>
          ))}
        </Space>
      </div>

      {/* 加载态 */}
      {loading && (
        <>
          {[1, 2].map(i => (
            <div key={i} style={{
              padding: 14,
              background: 'var(--color-paper, #F7F4ED)',
              borderRadius: 'var(--radius-md, 8px)',
              marginBottom: 10,
            }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Skeleton.Avatar active size={28} shape="circle" />
                <div style={{ flex: 1 }}>
                  <Skeleton active paragraph={{ rows: 1 }} title={{ width: '50%' }} />
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* 建议卡片 */}
      {!loading && suggestions.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 10 }}>
            💡 为你准备了 {suggestions.length} 条个性化建议
          </Text>
          {suggestions.map(item => (
            <div key={item.id} style={{ marginBottom: 8 }}>
              <SuggestionInline item={item} onClick={() => onSuggestionClick(item)} />
            </div>
          ))}
        </div>
      )}

      {/* 空态 */}
      {!loading && suggestions.length === 0 && (
        <Empty
          description="暂时没有新的建议"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 24 }}
        >
          <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
            继续探索非遗世界，我会在你需要时出现 ✨
          </Text>
        </Empty>
      )}
    </div>
  )
}

// ── 主组件 ──

export default function CompanionDrawer() {
  const navigate = useNavigate()
  const {
    visible, closeDrawer, suggestions, loading, chatMessages,
    chatLoading, sendMessage, clearChat, context,
    recordClick,
  } = useCompanion()

  const [inputValue, setInputValue] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [chatMessages, chatLoading])

  // 打开时聚焦输入框
  useEffect(() => {
    if (visible && chatMessages.length > 0) {
      setTimeout(() => inputRef.current?.focus?.(), 200)
    }
  }, [visible, chatMessages.length])

  const handleSend = () => {
    const msg = inputValue.trim()
    if (!msg || chatLoading) return
    setInputValue('')
    // 推断当前页面
    const page = window.location.pathname || '/'
    sendMessage(msg, page)
  }

  const handleSuggestionClick = (suggestion: CompanionSuggestion) => {
    recordClick(suggestion, window.location.pathname)
    navigate(suggestion.target_route)
    closeDrawer()
  }

  const handleQuickMessage = (msg: string) => {
    const page = window.location.pathname || '/'
    sendMessage(msg, page)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasConversation = chatMessages.length > 0

  return (
    <Drawer
      open={visible}
      onClose={closeDrawer}
      placement="right"
      width={400}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
        header: {
          padding: '12px 20px',
          borderBottom: '1px solid var(--color-paper, #F7F4ED)',
        },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, lineHeight: '40px', width: 40, textAlign: 'center' }}>
              🤖
            </span>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              letterSpacing: 1,
              color: 'var(--color-ink)',
            }}>
              文博灵境 · 伴游
            </span>
          </div>
          {hasConversation && (
            <Button
              type="text"
              size="small"
              icon={<Trash2 />}
              onClick={clearChat}
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}
            >
              清空
            </Button>
          )}
        </div>
      }
    >
      {/* 聊天消息区 */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!hasConversation ? (
          <WelcomePanel
            context={context}
            suggestions={suggestions}
            loading={loading}
            onSuggestionClick={handleSuggestionClick}
            onQuickMessage={handleQuickMessage}
          />
        ) : (
          <>
            {chatMessages.map(msg => (
              <ChatBubble
                key={msg.id}
                msg={msg}
                onSuggestionClick={handleSuggestionClick}
              />
            ))}

            {/* 流式输出指示器 */}
            {chatLoading && (
              <div style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                marginBottom: 14,
              }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--color-gold-light, #E8D5B0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 14,
                  color: 'var(--color-ink, #2C241A)',
                }}>
                  <Bot />
                </div>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'var(--color-paper, #F7F4ED)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink-secondary)',
                }}>
                  <span className="cursor-blink" style={{
                    display: 'inline-block',
                    width: 4,
                    height: 14,
                    background: 'var(--color-vermilion)',
                    verticalAlign: 'text-bottom',
                    animation: 'blink 0.8s infinite',
                  }} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 输入区域 */}
      <div style={{
        borderTop: '1px solid var(--color-paper, #F7F4ED)',
        padding: '12px 20px',
        background: 'var(--color-paper-white, #FFFDF9)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <Input.TextArea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="有问题尽管问我..."
          autoSize={{ minRows: 1, maxRows: 3 }}
          disabled={chatLoading}
          style={{
            flex: 1,
            border: '1px solid var(--color-paper, #F7F4ED)',
            borderRadius: 'var(--radius-md, 8px)',
            resize: 'none',
            fontSize: 'var(--text-sm)',
            padding: '8px 12px',
            background: 'var(--color-paper, #F7F4ED)',
          }}
        />
        <Button
          type="primary"
          icon={<Send />}
          onClick={handleSend}
          disabled={!inputValue.trim() || chatLoading}
          loading={chatLoading}
          style={{
            background: 'var(--color-vermilion, #B8463A)',
            borderColor: 'var(--color-vermilion, #B8463A)',
            width: 40,
            height: 40,
            flexShrink: 0,
          }}
        />
      </div>
    </Drawer>
  )
}
