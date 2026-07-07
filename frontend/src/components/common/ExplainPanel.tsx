/** XAI 推理路径可视化面板 — 诚实版决策树

- 不做假推理决策树：Qwen-VL 是一次性调用返回所有信息
- 诚实标注为「AI 输出结果的多维度分解」
- ECharts tree 系列 + 四色来源类型编码
*/

import React, { useEffect, useState } from 'react'
import { Alert, Card, Collapse, Empty, Spin, Tag, Typography } from 'antd'
import {
  GitGraph,
  Lightbulb,
  Search,
  Settings,
  Info,
} from 'lucide-react'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import * as echarts from 'echarts/core'
import { TreeChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([TreeChart, TooltipComponent, CanvasRenderer])

import type { TraceNode, TraceResponse, SourceType } from '../../services/xai'
import {
  SOURCE_COLORS,
  SOURCE_LABELS,
  toEChartsTree,
  fetchRecognitionTrace,
  fetchRestorationTrace,
} from '../../services/xai'

const { Text, Title } = Typography

interface ExplainPanelProps {
  /** 模块类型 */
  module: 'recognition' | 'restoration'
  /** 记录 ID */
  recordId: number
  /** 是否紧凑模式（嵌入结果卡片内） */
  compact?: boolean
}

const EXPLAIN_PANEL_HEIGHT = 520

const ExplainPanel: React.FC<ExplainPanelProps> = ({ module, recordId, compact = false }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trace, setTrace] = useState<TraceResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const fetcher = module === 'recognition' ? fetchRecognitionTrace : fetchRestorationTrace

    fetcher(recordId)
      .then((data) => {
        if (!cancelled) setTrace(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || err?.message || '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [module, recordId])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spin tip="加载结果分解中..." />
      </div>
    )
  }

  if (error) {
    return <Alert type="warning" message="无法加载推理可视化" description={error} showIcon />
  }

  if (!trace) return <Empty description="暂无数据" />

  const treeData = toEChartsTree(trace.root)

  const chartOption = {
    tooltip: {
      trigger: 'item' as const,
      triggerOn: 'mousemove' as const,
      formatter: (params: any) => {
        const name = params.name || ''
        const detail = params.data?.tooltip?.formatter
          ? params.data.tooltip.formatter
          : ''
        return `<b>${name}</b>${detail ? `<br/><br/>${detail}` : ''}`
      },
    },
    series: [
      {
        type: 'tree',
        data: [treeData],
        top: '3%',
        left: '8%',
        bottom: '3%',
        right: '8%',
        symbolSize: 10,
        symbol: 'roundRect',
        orient: 'LR',
        expandAndCollapse: true,
        initialTreeDepth: 2,
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 12,
          color: '#333',
          formatter: (p: any) => {
            const maxLen = compact ? 14 : 20
            return p.name.length > maxLen ? p.name.slice(0, maxLen) + '...' : p.name
          },
        },
        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left',
          },
        },
        lineStyle: {
          color: '#ccc',
          curveness: 0.5,
        },
        emphasis: {
          focus: 'descendant' as const,
        },
      },
    ],
  }

  return (
    <Card
      size="small"
      title={
        <span>
          <GitGraph style={{ marginRight: 8, color: '#1890ff' }} />
          AI 输出结果分解
        </span>
      }
      style={{ marginTop: compact ? 12 : 24 }}
    >
      {/* 四色图例 */}
      <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(SOURCE_LABELS) as SourceType[]).map((type) => (
          <Tag key={type} color={SOURCE_COLORS[type]}>
            {SOURCE_LABELS[type]}
          </Tag>
        ))}
      </div>

      {/* 诚实声明 */}
      <Alert
        type="info"
        showIcon
        icon={<Info />}
        message="诚实声明"
        description={trace.disclaimer}
        style={{ marginBottom: 12 }}
        styles={{ description: { fontSize: 12 } }}
      />

      {/* ECharts 树图 */}
      <ReactEChartsCore
        echarts={echarts}
        option={chartOption}
        style={{ height: compact ? 360 : EXPLAIN_PANEL_HEIGHT, width: '100%' }}
        notMerge
        lazyUpdate
      />

      {/* 根节点置信度环 */}
      {trace.root.confidence != null && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Text type="secondary">
            总体置信度：
            <Text strong style={{ color: SOURCE_COLORS[trace.root.source_type] }}>
              {(trace.root.confidence * 100).toFixed(1)}%
            </Text>
          </Text>
        </div>
      )}
    </Card>
  )
}

export default ExplainPanel
