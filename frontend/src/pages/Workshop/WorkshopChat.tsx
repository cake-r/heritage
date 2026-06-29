import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Tag, Button, Card, Spin, Empty } from 'antd'
import { UserOutlined, RobotOutlined, NodeIndexOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import AudioPlayer from '../../components/recognition/AudioPlayer'
import type { WorkshopMessage, InheritorInfo } from './index'
import { TOOL_NAMES, TOOL_ICONS } from './index'

interface Props {
  messages: WorkshopMessage[]
  streaming: boolean
  streamingContent: string
  loading: boolean
  inheritor?: InheritorInfo
  onQuickQuestion?: (question: string) => void
}

export default function WorkshopChat({ messages, streaming, streamingContent, loading, inheritor, onQuickQuestion }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingContent])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="加载中..." />
      </div>
    )
  }

  // 欢迎页
  if (messages.length === 0 && !streaming) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        {inheritor ? (
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <Avatar
              size={80}
              src={inheritor.avatar}
              icon={<UserOutlined />}
              style={{ marginBottom: 16, border: '3px solid var(--color-gold, #C4A265)' }}
            />
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--color-ink, #2C241A)' }}>
              {inheritor.name}
            </h2>
            <div style={{ marginBottom: 16 }}>
              {inheritor.expertise.map(e => (
                <Tag key={e} style={{ marginBottom: 4 }}>{e}</Tag>
              ))}
            </div>
            <p style={{ color: 'var(--color-ink-secondary, #6B5F52)', fontSize: 15, lineHeight: 1.8 }}>
              {inheritor.greeting}
            </p>

            {/* 工具展示 */}
            {inheritor.tools.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginTop: 24,
              }}>
                {inheritor.tools.map(toolId => (
                  <Card
                    key={toolId}
                    size="small"
                    style={{
                      textAlign: 'center',
                      border: '1px solid var(--color-paper, #F7F4ED)',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{TOOL_ICONS[toolId]}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{TOOL_NAMES[toolId]}</div>
                  </Card>
                ))}
              </div>
            )}

            {/* 快捷提问 */}
            {inheritor.quick_questions.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 13, color: 'var(--color-ink-secondary, #6B5F52)', marginBottom: 8 }}>
                  试试这些问题：
                </div>
                {inheritor.quick_questions.map((q, i) => (
                  <Button
                    key={i}
                    type="default"
                    style={{ marginBottom: 8, width: '100%', textAlign: 'left' }}
                    onClick={() => onQuickQuestion?.(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Empty description="请选择一个传承人开始对话" />
        )}
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {messages.map(msg => (
        <div key={msg.id}>
          {/* 工具调用标识 */}
          {msg.toolUsed && (
            <div style={{
              textAlign: 'center',
              marginBottom: 8,
            }}>
              <Tag color="gold" style={{ fontSize: 12 }}>
                {TOOL_ICONS[msg.toolUsed]} {TOOL_NAMES[msg.toolUsed]}
              </Tag>
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            {/* 头像 */}
            <Avatar
              size={32}
              src={msg.role === 'assistant' ? inheritor?.avatar : undefined}
              icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              style={{ flexShrink: 0 }}
            />

            {/* 消息气泡 */}
            <div style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: 8,
              background: msg.role === 'user'
                ? 'var(--color-vermilion, #B8463A)'
                : 'var(--color-paper, #F7F4ED)',
              color: msg.role === 'user' ? '#fff' : 'var(--color-ink, #2C241A)',
              fontSize: 15,
              lineHeight: 1.7,
            }}>
              {/* 图片 */}
              {msg.image_url && (
                <img
                  src={msg.image_url}
                  alt="uploaded"
                  style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, marginBottom: 8 }}
                />
              )}

              {/* 文本内容 */}
              {msg.role === 'assistant' ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                <span>{msg.content}</span>
              )}

              {/* 工具结果：识物品鉴 */}
              {msg.toolData?.tool === 'inspect' && msg.toolData.recognition && (
                <div style={{
                  marginTop: 12,
                  padding: 12,
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: 8,
                  fontSize: 13,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    识别结果：{(msg.toolData.recognition as Record<string, unknown>).category as string}
                    <Tag style={{ marginLeft: 8 }} color="blue">
                      置信度 {Math.round(((msg.toolData.recognition as Record<string, unknown>).confidence as number || 0) * 100)}%
                    </Tag>
                  </div>
                </div>
              )}

              {/* 工具结果：创作生成 */}
              {msg.toolData?.tool === 'create' && 'images' in msg.toolData && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: 8,
                  marginTop: 12,
                }}>
                  {(msg.toolData as { images: string[] }).images.map((img: string, i: number) => (
                    <img
                      key={i}
                      src={img}
                      alt={`generated-${i}`}
                      style={{ width: '100%', borderRadius: 8, border: '1px solid var(--color-paper, #F7F4ED)' }}
                    />
                  ))}
                </div>
              )}

              {/* 工具结果：博学关联 */}
              {msg.toolData?.tool === 'connect' && msg.toolData.related_items && (
                <div style={{ marginTop: 12 }}>
                  {msg.toolData.related_items.map((item: any) => (
                    <Card key={item.id} size="small" style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-ink-secondary, #6B5F52)' }}>
                        {item.category} · {item.region} · {item.era}
                      </div>
                    </Card>
                  ))}
                  <Button
                    type="link"
                    size="small"
                    icon={<NodeIndexOutlined />}
                    onClick={() => navigate('/knowledge-graph')}
                    style={{ padding: 0, color: 'var(--color-gold, #C4A265)' }}
                  >
                    在文化图谱中探索更多关联
                  </Button>
                </div>
              )}

              {/* 工具结果：教学课程 */}
              {msg.curriculumSections && msg.curriculumSections.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {msg.curriculumSections.map(sec => (
                    <details key={sec.section_id} style={{ marginBottom: 8 }}>
                      <summary style={{ fontWeight: 600, cursor: 'pointer', fontSize: 13, color: 'var(--color-vermilion, #B8463A)' }}>
                        {sec.title}
                      </summary>
                      <div style={{ padding: '4px 0 8px 8px', fontSize: 13, lineHeight: 1.7 }}>
                        <ReactMarkdown>{sec.content}</ReactMarkdown>
                      </div>
                    </details>
                  ))}
                </div>
              )}

              {/* 语音播放 */}
              {msg.voice_url && (
                <div style={{ marginTop: 8 }}>
                  <AudioPlayer src={msg.voice_url} />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* 流式输出 */}
      {streaming && streamingContent && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Avatar size={32} src={inheritor?.avatar} icon={<RobotOutlined />} />
          <div style={{
            maxWidth: '70%',
            padding: '12px 16px',
            borderRadius: 8,
            background: 'var(--color-paper, #F7F4ED)',
            fontSize: 15,
            lineHeight: 1.7,
          }}>
            <ReactMarkdown>{streamingContent}</ReactMarkdown>
            <span className="cursor-blink" style={{
              display: 'inline-block',
              width: 2,
              height: 16,
              background: 'var(--color-vermilion, #B8463A)',
              marginLeft: 2,
              verticalAlign: 'text-bottom',
            }} />
          </div>
        </div>
      )}

      <div ref={scrollRef} />
    </div>
  )
}
