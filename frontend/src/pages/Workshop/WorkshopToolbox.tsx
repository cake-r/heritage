import { Card, Button, Tag, Progress } from 'antd'
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
          fontSize: 14,
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
        fontSize: 13,
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
              style={{
                border: isActive
                  ? '2px solid var(--color-vermilion, #B8463A)'
                  : '1px solid var(--color-paper, #F7F4ED)',
                borderRadius: 8,
                padding: 12,
                background: isActive
                  ? 'rgba(184,70,58,0.08)'
                  : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 24, lineHeight: 1 }}>{tool.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>
                    {tool.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-ink-secondary, #6B5F52)', lineHeight: 1.6 }}>
                    {tool.description}
                  </div>

                  {isActive && toolStatus && (
                    <div style={{ marginTop: 8 }}>
                      <Progress percent={99} status="active" size="small" />
                      <div style={{ fontSize: 12, color: 'var(--color-ink-secondary, #6B5F52)', marginTop: 2 }}>
                        {toolStatus}
                      </div>
                    </div>
                  )}

                  {!isActive && (
                    <Tag
                      style={{ marginTop: 6, fontSize: 12, cursor: 'pointer' }}
                      color="default"
                    >
                      {tool.usage}
                    </Tag>
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
