import React from 'react'
import { Tooltip } from 'antd'
import {
  Crosshair, Highlighter, Palette,
  Pencil, LayoutGrid,
} from 'lucide-react'

export type ToolType = 'region_select' | 'stain_brush' | 'color_palette' | 'line_pen' | 'pattern_library'

interface ToolDef {
  key: ToolType
  label: string
  icon: React.ReactNode
  enabled: boolean
  tip: string
}

const TOOLS: ToolDef[] = [
  {
    key: 'region_select',
    label: '选区',
    icon: <Crosshair style={{ fontSize: 20 }} />,
    enabled: true,
    tip: '框选损伤区域进行AI修复',
  },
  {
    key: 'stain_brush',
    label: '去渍笔',
    icon: <Highlighter style={{ fontSize: 20 }} />,
    enabled: true,
    tip: '涂抹污渍区域进行AI清除',
  },
  {
    key: 'pattern_library',
    label: '纹样库',
    icon: <LayoutGrid style={{ fontSize: 20 }} />,
    enabled: true,
    tip: '从85种传统纹样中选择覆盖破损区域',
  },
  {
    key: 'color_palette',
    label: '补色盘',
    icon: <Palette style={{ fontSize: 20 }} />,
    enabled: false,
    tip: '选择区域进行AI色彩修复',
  },
  {
    key: 'line_pen',
    label: '补线笔',
    icon: <Pencil style={{ fontSize: 20 }} />,
    enabled: false,
    tip: '描绘缺失线条进行AI补全',
  },
]

interface Props {
  selectedTool: ToolType
  onSelect: (tool: ToolType) => void
}

const ToolPanel: React.FC<Props> = ({ selectedTool, onSelect }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '12px 10px',
      background: 'var(--color-paper)',
      borderRadius: 10,
      border: '1px solid #e8e0d5',
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: '#999',
        textAlign: 'center',
        marginBottom: 4,
        letterSpacing: 1,
      }}>
        工具
      </div>
      {TOOLS.map(tool => (
        <Tooltip
          key={tool.key}
          title={tool.enabled ? tool.tip : `${tool.tip}（即将推出）`}
          placement="right"
        >
          <button
            onClick={() => tool.enabled && onSelect(tool.key)}
            disabled={!tool.enabled}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '10px 6px 6px',
              border: selectedTool === tool.key
                ? '2px solid #B8463A'
                : '2px solid transparent',
              borderRadius: 8,
              background: selectedTool === tool.key
                ? 'rgba(184, 70, 58, 0.08)'
                : 'transparent',
              cursor: tool.enabled ? 'pointer' : 'not-allowed',
              opacity: tool.enabled ? 1 : 0.35,
              transition: 'all 0.2s',
              width: 64,
            }}
          >
            <span style={{
              color: selectedTool === tool.key ? '#B8463A' : '#666',
              transition: 'color 0.2s',
            }}>
              {tool.icon}
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: selectedTool === tool.key ? 600 : 400,
              color: selectedTool === tool.key ? '#B8463A' : '#888',
            }}>
              {tool.label}
            </span>
          </button>
        </Tooltip>
      ))}
    </div>
  )
}

export default ToolPanel
export { TOOLS }
