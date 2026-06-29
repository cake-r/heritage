import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { message } from 'antd'
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
}

export const TOOL_ICONS: Record<string, string> = {
  inspect: '🔍',
  create: '🎨',
  connect: '🔗',
  teach: '📖',
}

export default function Workshop() {
  const [searchParams] = useSearchParams()
  const initialPersona = searchParams.get('persona') || ''

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
    const presetList: InheritorInfo[] = chars.map(c => ({
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      expertise: c.expertise,
      greeting: c.greeting,
      tools: c.tools || [],
      quick_questions: c.quick_questions || [],
      isCustom: false,
    }))

    const customList: InheritorInfo[] = ci.map(c => ({
      id: `custom:${c.id}`,
      name: c.name,
      avatar: c.avatar_url,
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
          const finalContent = contentRef.current
          const aiMsg: WorkshopMessage = {
            id: data.message_id,
            role: 'assistant',
            content: finalContent,
            image_url: null,
            voice_url: data.voice_url,
            created_at: new Date().toISOString(),
            toolUsed: data.tool_used,
            curriculumSections: curriculumSections.length > 0 ? curriculumSections : undefined,
          }
          setMessages(prev => [...prev, aiMsg])
          setStreaming(false)
          setStreamingContent('')
          setActiveToolId(null)
          setToolStatus('')
          contentRef.current = ''
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
          setToolStatus(`正在${data.step === 'recognizing' ? '识别' : data.step === 'generating' ? '生成' : data.step === 'searching' ? '搜索' : '整理'}...`)
        },
        onToolResult: (data: ToolResultEvent) => {
          const aiMsg: WorkshopMessage = {
            id: Date.now(),
            role: 'assistant',
            content: data.summary || data.commentary || '',
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

  // 处理删除自定义传承人
  const handleDeleteCustom = (id: number) => {
    setCustoms(prev => prev.filter(c => c.id !== `custom:${id}`))
  }

  // 刷新自定义传承人列表
  const refreshCustoms = async () => {
    try {
      const ci = await listMyInheritors()
      const { customs: c } = buildInheritorList(
        presets.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, expertise: p.expertise, greeting: p.greeting, tools: p.tools, quick_questions: p.quick_questions })),
        ci
      )
      setCustoms(c)
    } catch { /* ignore */ }
  }

  const selectedInheritorInfo = [...presets, ...customs].find(i => i.id === selectedInheritor)
  const sessionCount = sessions.length

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '240px 1fr 260px',
      gridTemplateRows: '1fr auto',
      height: 'calc(100vh - 64px - 48px)',
      gap: 20,
      padding: '0 20px 20px',
    }}>
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
        <WorkshopChat
          messages={messages}
          streaming={streaming}
          streamingContent={streamingContent}
          loading={loading}
          inheritor={selectedInheritorInfo}
          onQuickQuestion={handleQuickQuestion}
        />
        <WorkshopChatInput
          onSend={handleSendMessage}
          streaming={streaming}
          availableTools={availableTools}
          activeToolId={activeToolId}
          onCancelTool={() => setActiveToolId(null)}
        />
      </div>

      {/* 右侧：工具箱 */}
      <WorkshopToolbox
        tools={availableTools}
        activeToolId={activeToolId}
        toolStatus={toolStatus}
        onToolClick={(toolId) => {
          // 工具箱点击在 WorkshopChatInput 中处理
        }}
      />

      {/* 底部：状态栏 */}
      <WorkshopStatusBar
        inheritor={selectedInheritorInfo}
        messageCount={messages.length}
        sessionCount={sessionCount}
      />
    </div>
  )
}
