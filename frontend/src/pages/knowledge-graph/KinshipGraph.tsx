import { useMemo, useRef, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import { Empty, Typography, Tag } from 'antd'
import { getCategoryColor } from '../../utils/categoryColors'
import type { ItemsData } from '../../services/knowledgeGraph'

const { Text } = Typography

// ECharts canvas 硬编码色值
const VERMILION = '#B8463A'
const GOLD = '#C4A265'
const INK = '#2C241A'
const PAPER = '#FFFDF9'
const INK_TERTIARY = '#5A4F42'

interface KinshipGraphProps {
  data: ItemsData | null
  onNodeClick?: (id: number) => void
  height?: number
}

export default function KinshipGraph({ data, onNodeClick, height = 400 }: KinshipGraphProps) {
  const chartRef = useRef<any>(null)

  const handleClick = useCallback((params: any) => {
    if (params.dataType === 'node' && params.data?._itemId && onNodeClick) {
      onNodeClick(params.data._itemId)
    }
  }, [onNodeClick])

  const onEvents = useMemo(() => ({ click: handleClick }), [handleClick])

  const option = useMemo(() => {
    if (!data || data.nodes.length === 0) return null

    const categories = [...new Set(data.nodes.map(n => n.category))]
    const nodes = data.nodes.map(n => ({
      id: n.id,
      name: n.name,
      symbolSize: Math.max(18, Math.min(48, n.symbolSize)),
      category: categories.indexOf(n.category),
      _itemId: n.id,
      _category: n.category,
      itemStyle: {
        color: getCategoryColor(n.category),
        borderColor: PAPER,
        borderWidth: 2,
        shadowBlur: 8,
        shadowColor: 'rgba(0,0,0,0.08)',
      },
      label: {
        show: n.symbolSize >= 25,
        formatter: n.name,
        fontSize: 11,
        color: INK,
      },
    }))

    const links = data.links.slice(0, 80).map(l => ({
      source: l.source,
      target: l.target,
      value: l.relation,
      lineStyle: {
        color: l.relation === '技法相似' ? VERMILION
          : l.relation === '地域接近' ? GOLD
          : '#A0A0A0',
        width: 1,
        curveness: 0.2,
        opacity: 0.5,
      },
    }))

    const legendData = categories.map(cat => ({
      name: cat,
      itemStyle: { color: getCategoryColor(cat) },
    }))

    return {
      backgroundColor: PAPER,
      legend: {
        data: legendData,
        bottom: 0,
        textStyle: { fontSize: 11, color: INK_TERTIARY },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [{
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        categories: categories.map(cat => ({
          name: cat,
          itemStyle: { color: getCategoryColor(cat) },
        })),
        data: nodes,
        links: links,
        force: {
          repulsion: 300,
          edgeLength: [80, 200],
          gravity: 0.1,
          friction: 0.6,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 2 },
          itemStyle: { shadowBlur: 16, shadowColor: 'rgba(184,70,58,0.3)' },
        },
        lineStyle: {
          opacity: 0.4,
          curveness: 0.2,
        },
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          color: INK,
        },
        edgeSymbol: ['none', 'none'],
      }],
      tooltip: {
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const d = params.data
            return `<strong>${d.name}</strong><br/>品类: ${d._category}`
          }
          return `${params.data?.value || ''}`
        },
      },
    }
  }, [data])

  if (!option) {
    return <Empty description="暂无关联数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 'var(--text-sm)', color: INK }}>
          🔗 技艺亲缘关系图
        </Text>
        <Tag color="gold" style={{ fontSize: 11 }}>
          {data?.nodes.length || 0} 节点 · {(data?.links.length || 0)} 关联
        </Tag>
      </div>
      <ReactECharts
        ref={chartRef}
        option={option}
        onEvents={onEvents}
        style={{ height, width: '100%' }}
        notMerge
      />
      <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 4 }}>
        拖拽节点探索 · 滚轮缩放 · 点击节点查看详情
      </Text>
    </div>
  )
}
