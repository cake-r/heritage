import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { message, Button, Popconfirm, Drawer, Grid } from 'antd'
import { Trash2, Wrench } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getCharacters, createSession, listSessions, getSessionDetail,
  deleteSession, sendMessageSSE,
  type Character, type ChatSessionItem, type ChatMessage, type SSEDoneData,
  type ToolStartEvent, type ToolResultEvent, type ImageBatchEvent, type CurriculumSectionEvent,
} from '../../services/chat'
import { listMyInheritors, type CustomInheritor } from '../../services/inheritor'
import { getModuleRecommendations } from '../../services/recommendation'
import InheritorRoster from './InheritorRoster'
import WorkshopChat from './WorkshopChat'
import WorkshopChatInput from './WorkshopChatInput'
import WorkshopToolbox from './WorkshopToolbox'
import WorkshopStatusBar from './WorkshopStatusBar'
import { WaterRipplePattern } from '../../components/decoration'

// === 扩展消息类型 ===

export interface WorkshopMessage extends ChatMessage {
  toolData?: ToolResultEvent | ImageBatchEvent
  curriculumSections?: Array<{
    section_id: string
    title: string
    description: string
    content: string
    collapsed: boolean
  }>
  toolUsed?: string
}

export interface InheritorInfo {
  id: string           // persona_id or "custom:{id}"
  name: string
  avatar: string
  expertise: string[]
  greeting: string
  tools: string[]
  quick_questions: string[]
  isCustom: boolean
  category?: string
}

// === 工具中文名映射 ===

export const TOOL_NAMES: Record<string, string> = {
  inspect: '识物·品鉴',
  create: '创作·生成',
  connect: '博学·关联',
  teach: '教学·答疑',
  pattern: '纹样·提取',
  story: '故事·讲述',
  compare: '对比·鉴赏',
}

export const TOOL_ICONS: Record<string, string> = {
  inspect: 'search',
  create: 'palette',
  connect: 'link',
  teach: 'book-open',
  pattern: 'lantern',
  story: 'scroll-text',
  compare: 'scale',
}

export default function Workshop() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialPersona = searchParams.get('persona') || ''
  const screens = Grid.useBreakpoint()
  const isCompact = !screens.xxl  // < 1600px: 收起工具箱

  // 工具箱 Drawer 状态（紧凑模式）
  const [toolboxOpen, setToolboxOpen] = useState(false)

  // 传承人
  const [presets, setPresets] = useState<InheritorInfo[]>([])
  const [customs, setCustoms] = useState<InheritorInfo[]>([])
  const [selectedInheritor, setSelectedInheritor] = useState<string>('')
  const [availableTools, setAvailableTools] = useState<string[]>([])
  const [recommendedInheritor, setRecommendedInheritor] = useState<string>('')

  // 会话
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<WorkshopMessage[]>([])

  // UI状态
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [activeToolId, setActiveToolId] = useState<string | null>(null)
  const [toolStatus, setToolStatus] = useState<string>('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef('')

  // 构建传承人列表
  const buildInheritorList = useCallback((chars: Character[], ci: CustomInheritor[]) => {
    // 读取 localStorage 中的头像覆盖
    let overrides: Record<string, string> = {}
    try {
      const raw = localStorage.getItem('inheritor_avatar_overrides')
      if (raw) overrides = JSON.parse(raw)
    } catch { /* ignore */ }

    const presetList: InheritorInfo[] = chars.map(c => ({
      id: c.id,
      name: c.name,
      avatar: overrides[c.id] || c.avatar,
      expertise: c.expertise,
      greeting: c.greeting,
      tools: c.tools || [],
      quick_questions: c.quick_questions || [],
      isCustom: false,
    }))

    const customList: InheritorInfo[] = ci.map(c => ({
      id: `custom:${c.id}`,
      name: c.name,
      avatar: overrides[`custom:${c.id}`] || c.avatar_url,
      expertise: c.expertise,
      greeting: c.greeting,
      tools: c.tools,
      quick_questions: [],
      isCustom: true,
      category: c.category,
    }))

    return { presets: presetList, customs: customList }
  }, [])

  // 初始加载
  useEffect(() => {
    Promise.all([getCharacters(), listSessions(), listMyInheritors()])
      .then(([chars, sess, ci]) => {
        const { presets: p, customs: c } = buildInheritorList(chars, ci)
        setPresets(p)
        setCustoms(c)

        if (sess.length > 0) {
          const active = sess[0]
          setSessions(sess)
          setCurrentSessionId(active.id)
          setSelectedInheritor(active.persona)
          setAvailableTools(active.available_tools || [])
          loadSession(active.id)
        } else {
          // 检查 URL 参数预选传承人
          const allInheritors = [...p, ...c]
          const preSelected = initialPersona
            ? allInheritors.find(inh => inh.id === initialPersona)
            : null
          const target = preSelected || (p.length > 0 ? p[0] : null)
          if (target) {
            setSelectedInheritor(target.id)
            setAvailableTools(target.tools)
            // 自动创建会话，确保快捷问题可以立即发送
            createSession(target.id).then(s => {
              setSessions([s])
              setCurrentSessionId(s.id)
            }).catch(() => { message.error('创建会话失败') })
              .finally(() => setLoading(false))
          } else {
            setLoading(false)
          }
        }
      })
      .catch(() => { message.error('加载失败'); setLoading(false) })

    // 千人千面 — 获取推荐传承人
    getModuleRecommendations('workshop').then(data => {
      if (data.items.length > 0) {
        const topPick = data.items[0]
        // 查找匹配的传承人 ID (预设或自定义)
        if (topPick.item_type === 'inheritor') {
          setRecommendedInheritor(topPick.target_route.includes('custom:')
            ? `custom:${topPick.id}`
            : (topPick as any).target_route?.match(/persona=([^&]+)/)?.[1] || '')
        }
      }
    }).catch(() => { /* 静默降级 */ })
  }, [])

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // 加载会话消息
  const loadSession = async (id: number) => {
    setLoading(true)
    try {
      const detail = await getSessionDetail(id)
      setMessages(detail.messages.map(m => ({ ...m })))
      setSelectedInheritor(detail.persona)
      setAvailableTools(detail.available_tools || [])
    } catch { message.error('加载会话失败') }
    finally { setLoading(false) }
  }

  // 处理选择传承人
  const handleSelectInheritor = async (persona: string) => {
    setSelectedInheritor(persona)

    // 更新工具列表
    const allInheritors = [...presets, ...customs]
    const inheritor = allInheritors.find(i => i.id === persona)
    setAvailableTools(inheritor?.tools || [])

    // 查找已有会话
    const existing = sessions.find(s => s.persona === persona)
    if (existing) {
      setCurrentSessionId(existing.id)
      await loadSession(existing.id)
    } else {
      // 创建新会话
      try {
        const s = await createSession(persona)
        setSessions(prev => [s, ...prev])
        setCurrentSessionId(s.id)
        setMessages([])
      } catch { message.error('创建会话失败') }
    }
  }

  // 处理发送消息
  const handleSendMessage = useCallback((content: string, image?: File | null) => {
    if (!currentSessionId) return

    setStreaming(true)
    setStreamingContent('')
    setActiveToolId(null)
    setToolStatus('')
    contentRef.current = ''

    // 添加用户消息到列表
    const userMsg: WorkshopMessage = {
      id: Date.now(),
      role: 'user',
      content,
      image_url: image ? URL.createObjectURL(image) : null,
      voice_url: null,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    // 当前课程的章节列表（用于teach工具）
    let curriculumSections: WorkshopMessage['curriculumSections'] = []

    const controller = sendMessageSSE(
      currentSessionId,
      content,
      image,
      {
        onToken: (token) => {
          contentRef.current += token
          setStreamingContent(contentRef.current)
        },
        onDone: (data: SSEDoneData) => {
          if (data.tool_used) {
            // teach 工具无 tool_result 事件，需从 streaming content 创建消息
            if (data.tool_used === 'teach') {
              const finalContent = contentRef.current
              setMessages(prev => [...prev, {
                id: data.message_id,
                role: 'assistant' as const,
                content: finalContent,
                image_url: null,
                voice_url: data.voice_url,
                created_at: new Date().toISOString(),
                toolUsed: data.tool_used,
                curriculumSections: curriculumSections.length > 0 ? curriculumSections : undefined,
              }])
            } else {
              // 其他工具：消息已由 onToolResult / onImageBatch 创建，补充 voice_url
              setMessages(prev => {
                const updated = [...prev]
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].role === 'assistant' && updated[i].toolUsed === data.tool_used) {
                    updated[i] = { ...updated[i], id: data.message_id, voice_url: data.voice_url }
                    return updated
                  }
                }
                // 兜底：没找到则新建
                updated.push({
                  id: data.message_id,
                  role: 'assistant',
                  content: contentRef.current,
                  image_url: null,
                  voice_url: data.voice_url,
                  created_at: new Date().toISOString(),
                  toolUsed: data.tool_used,
                })
                return updated
              })
            }
          } else {
            const finalContent = contentRef.current
            const aiMsg: WorkshopMessage = {
              id: data.message_id,
              role: 'assistant',
              content: finalContent,
              image_url: null,
              voice_url: data.voice_url,
              created_at: new Date().toISOString(),
            }
            setMessages(prev => [...prev, aiMsg])
          }
          setStreaming(false)
          setStreamingContent('')
          setActiveToolId(null)
          setToolStatus('')
          contentRef.current = ''
          curriculumSections = []
          window.dispatchEvent(new CustomEvent('cultivation:check'))
        },
        onError: (err) => {
          message.error(err)
          setStreaming(false)
          setStreamingContent('')
          setActiveToolId(null)
          setToolStatus('')
        },
        onToolStart: (data: ToolStartEvent) => {
          setActiveToolId(data.tool)
          setToolStatus(data.message)
          setStreamingContent('')
          contentRef.current = ''
        },
        onToolProgress: (data) => {
          const stepLabels: Record<string, string> = {
            recognizing: '识别',
            generating: '生成',
            searching: '搜索',
            curating: '整理',
            writing: '撰写',
            analyzing: '分析',
          }
          setToolStatus(`正在${stepLabels[data.step] || '处理'}...`)
        },
        onToolResult: (data: ToolResultEvent) => {
          const aiMsg: WorkshopMessage = {
            id: Date.now(),
            role: 'assistant',
            content: data.summary || data.commentary || (data as any).story || '',
            image_url: null,
            voice_url: null,
            created_at: new Date().toISOString(),
            toolData: data,
            toolUsed: data.tool,
          }
          setMessages(prev => [...prev, aiMsg])
          setStreaming(false)
          setStreamingContent('')
          setActiveToolId(null)
          setToolStatus('')
          contentRef.current = ''
        },
        onImageBatch: (data: ImageBatchEvent) => {
          const aiMsg: WorkshopMessage = {
            id: Date.now(),
            role: 'assistant',
            content: `创作提示：${data.prompt_used}\n\n已生成 ${data.images.length} 张作品。`,
            image_url: null,
            voice_url: null,
            created_at: new Date().toISOString(),
            toolData: data,
            toolUsed: data.tool,
          }
          setMessages(prev => [...prev, aiMsg])
          setStreaming(false)
          setStreamingContent('')
          setActiveToolId(null)
          setToolStatus('')
          contentRef.current = ''
        },
        onCurriculumSection: (data: CurriculumSectionEvent) => {
          if (data.action === 'start' && data.title) {
            curriculumSections.push({
              section_id: data.section_id,
              title: data.title,
              description: data.description || '',
              content: '',
              collapsed: false,
            })
          } else if (data.action === 'end' && curriculumSections.length > 0) {
            curriculumSections[curriculumSections.length - 1].content = contentRef.current
            contentRef.current = ''
          }
        },
      }
    )

    return controller
  }, [currentSessionId])

  // 处理快捷问题
  const handleQuickQuestion = useCallback((question: string) => {
    if (!currentSessionId) {
      message.warning('会话未就绪，请稍后再试')
      return
    }
    handleSendMessage(question)
  }, [currentSessionId, handleSendMessage])

  // 处理删除会话
  const handleDeleteSession = async (id: number) => {
    try {
      await deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (currentSessionId === id) {
        const remaining = sessions.filter(s => s.id !== id)
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id)
          setSelectedInheritor(remaining[0].persona)
          await loadSession(remaining[0].id)
        } else {
          setCurrentSessionId(null)
          setMessages([])
          if (presets.length > 0) {
            setSelectedInheritor(presets[0].id)
            setAvailableTools(presets[0].tools)
          }
        }
      }
    } catch { message.error('删除失败') }
  }

  // 处理清除对话历史
  const handleClearHistory = async () => {
    if (!currentSessionId || !selectedInheritor) return
    try {
      await deleteSession(currentSessionId)
      // 从 sessions 列表中移除
      setSessions(prev => prev.filter(s => s.id !== currentSessionId))
      // 清除消息
      setMessages([])
      // 为新对话创建会话
      const s = await createSession(selectedInheritor)
      setSessions(prev => [s, ...prev])
      setCurrentSessionId(s.id)
    } catch { message.error('清除失败') }
  }

  // 处理删除自定义传承人
  const handleDeleteCustom = (id: number) => {
    setCustoms(prev => prev.filter(c => c.id !== `custom:${id}`))
  }

  // 刷新传承人列表（含头像覆盖）
  const refreshCustoms = async () => {
    try {
      const ci = await listMyInheritors()
      const { presets: p, customs: c } = buildInheritorList(
        presets.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, expertise: p.expertise, greeting: p.greeting, tools: p.tools, quick_questions: p.quick_questions })),
        ci
      )
      setPresets(p)
      setCustoms(c)
    } catch { /* ignore */ }
  }

  // 工具箱点击 → 自动填入工具前缀
  const chatInputRef = useRef<{ selectTool: (toolId: string) => void }>(null)

  const handleToolClick = useCallback((toolId: string) => {
    if (chatInputRef.current) {
      chatInputRef.current.selectTool(toolId)
    }
    // 紧凑模式下关闭 Drawer
    if (isCompact) {
      setToolboxOpen(false)
    }
  }, [isCompact])

  const selectedInheritorInfo = [...presets, ...customs].find(i => i.id === selectedInheritor)
  const sessionCount = sessions.length

  // 工具箱组件（复用）
  const toolboxElement = (
    <WorkshopToolbox
      tools={availableTools}
      activeToolId={activeToolId}
      toolStatus={toolStatus}
      onToolClick={handleToolClick}
    />
  )

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isCompact ? '220px 1fr' : '240px 1fr 260px',
      gridTemplateRows: '1fr auto',
      height: 'calc(100vh - 64px - 32px)',
      gap: isCompact ? 12 : 20,
      padding: isCompact ? '0 8px 12px' : '0 20px 20px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <WaterRipplePattern opacity={0.15} />
      {/* 左侧：传承人列表 */}
      <InheritorRoster
        presets={presets}
        customs={customs}
        selectedId={selectedInheritor}
        onSelect={handleSelectInheritor}
        onDeleteCustom={handleDeleteCustom}
        onRefresh={refreshCustoms}
        recommendedId={recommendedInheritor}
      />

      {/* 中间：聊天区域 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-paper-white, #FFFDF9)',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30,27,24,0.06))',
      }}>
        {/* 聊天头部 — 传承人名称 + 工具按钮 + 清除按钮 */}
        {selectedInheritorInfo && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid var(--color-paper, #F7F4ED)',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--color-ink, #2C241A)',
            }}>
              {selectedInheritorInfo.name} · 对话
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isCompact && availableTools.length > 0 && (
                <Button
                  type="text"
                  size="small"
                  icon={<Wrench />}
                  onClick={() => setToolboxOpen(true)}
                  style={{ fontSize: 'var(--text-xs)' }}
                >
                  工具箱
                </Button>
              )}
              {messages.length > 0 && !streaming && (
                <Popconfirm
                  title="确定清除当前对话记录？"
                  description="清除后将开启新对话，历史消息不可恢复。"
                  onConfirm={handleClearHistory}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<Trash2 />}
                    danger
                    style={{ fontSize: 'var(--text-xs)' }}
                  >
                    清除对话
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
        )}
        <WorkshopChat
          messages={messages}
          streaming={streaming}
          streamingContent={streamingContent}
          loading={loading}
          inheritor={selectedInheritorInfo}
          userAvatar={user?.avatar_url}
          onQuickQuestion={handleQuickQuestion}
          onRegenerate={() => {
            // 找到最后一条用户消息，重新发送
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
            if (lastUserMsg) {
              // 移除最后一条 AI 消息后重发
              setMessages(prev => {
                const lastAiIdx = prev.map((m, i) => ({ m, i })).reverse().find(({ m }) => m.role === 'assistant')
                if (lastAiIdx) {
                  return prev.slice(0, lastAiIdx.i)
                }
                return prev
              })
              handleSendMessage(lastUserMsg.content)
            }
          }}
        />
        <WorkshopChatInput
          ref={chatInputRef}
          onSend={handleSendMessage}
          streaming={streaming}
          availableTools={availableTools}
          activeToolId={activeToolId}
          onCancelTool={() => setActiveToolId(null)}
        />
      </div>

      {/* 右侧：工具箱 — 宽屏固定显示，紧凑屏收起到 Drawer */}
      {!isCompact && toolboxElement}

      <Drawer
        title={<><Wrench size={18} /> 工具</>}
        open={toolboxOpen}
        onClose={() => setToolboxOpen(false)}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        {toolboxElement}
      </Drawer>

      {/* 底部：状态栏 */}
      <WorkshopStatusBar
        inheritor={selectedInheritorInfo}
        messageCount={messages.length}
        sessionCount={sessionCount}
      />
    </div>
  )
}
