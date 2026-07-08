import { Card, Button, Tag, Progress } from 'antd'
import { Play } from 'lucide-react'
import { TOOL_NAMES, TOOL_ICONS } from './index'

interface ToolInfo {
  id: string
  name: string
  icon: string
  description: string
  usage: string
}

const ALL_TOOLS: ToolInfo[] = [
  {
    id: 'inspect',
    name: '识物·品鉴',
    icon: '🔍',
    description: '上传非遗作品图片，AI分析工艺技法和风格特征',
    usage: '输入 /inspect 并上传图片',
  },
  {
    id: 'create',
    name: '创作·生成',
    icon: '🎨',
    description: '根据描述生成非遗艺术图案、纹样和设计',
    usage: '输入 /create 加创作描述',
  },
  {
    id: 'connect',
    name: '博学·关联',
    icon: '🔗',
    description: '从知识图谱中发现不同非遗品类之间的文化关联',
    usage: '输入 /connect 加查询主题',
  },
  {
    id: 'teach',
    name: '教学·答疑',
    icon: '📖',
    description: '自动生成系统化入门课程，从基础到实践',
    usage: '输入 /teach 加学习主题',
  },
  {
    id: 'pattern',
    name: '纹样·提取',
    icon: '🏮',
    description: '上传纹样图片，AI提取并分析母题、对称性、文化寓意',
    usage: '输入 /pattern 并上传纹样图片',
  },
  {
    id: 'story',
    name: '故事·讲述',
    icon: '📜',
    description: '根据主题生成非遗传说、匠人轶事，寓教于乐',
    usage: '输入 /story 加故事主题',
  },
  {
    id: 'compare',
    name: '对比·鉴赏',
    icon: '⚖️',
    description: '对比两个非遗项目的技法、风格、历史背景异同',
    usage: '输入 /compare 项目A vs 项目B',
  },
]

interface Props {
  tools: string[]
  activeToolId: string | null
  toolStatus: string
  onToolClick: (toolId: string) => void
}

export default function WorkshopToolbox({ tools, activeToolId, toolStatus, onToolClick }: Props) {
  if (tools.length === 0) {
    return (
      <div style={{
        background: 'var(--color-paper-white, #FFFDF9)',
        borderRadius: 12,
        padding: 16,
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30,27,24,0.06))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          textAlign: 'center',
          color: 'var(--color-ink-secondary, #6B5F52)',
          fontSize: 'var(--text-sm)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛠️</div>
          <div>选择一位传承人</div>
          <div>查看可用工具</div>
        </div>
      </div>
    )
  }

  const activeTools = ALL_TOOLS.filter(t => tools.includes(t.id))

  return (
    <div style={{
      background: 'var(--color-paper-white, #FFFDF9)',
      borderRadius: 12,
      padding: 16,
      overflow: 'auto',
      boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(30,27,24,0.06))',
    }}>
      <div style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--color-ink-secondary, #6B5F52)',
        marginBottom: 16,
        paddingLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
      }}>
        可用工具
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeTools.map(tool => {
          const isActive = activeToolId === tool.id
          return (
            <Card
              key={tool.id}
              size="small"
              styles={{ body: { padding: 12 } }}
              style={{
                border: isActive
                  ? '2px solid var(--color-vermilion, #B8463A)'
                  : '1px solid var(--color-paper, #F7F4ED)',
                borderRadius: 8,
                background: isActive
                  ? 'rgba(184,70,58,0.08)'
                  : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{tool.icon}</span>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 2, lineHeight: 1.3 }}>
                    {tool.name}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary, #6B5F52)', lineHeight: 1.5 }}>
                    {tool.description}
                  </div>

                  {isActive && toolStatus && (
                    <div style={{ marginTop: 8 }}>
                      <Progress percent={99} status="active" size="small" />
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary, #6B5F52)', marginTop: 2 }}>
                        {toolStatus}
                      </div>
                    </div>
                  )}

                  {!isActive && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Tag
                        style={{ fontSize: 'var(--text-xs)', margin: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        color="default"
                      >
                        {tool.usage}
                      </Tag>
                      <Button
                        type="link"
                        size="small"
                        icon={<Play />}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToolClick(tool.id)
                        }}
                        style={{
                          fontSize: 'var(--text-xs)',
                          padding: '0 4px',
                          color: 'var(--color-vermilion, #B8463A)',
                          flexShrink: 0,
                        }}
                      >
                        使用
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
