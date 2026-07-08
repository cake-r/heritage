import { useMemo, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { Spin, Empty } from 'antd'
import { useTheme } from '../../contexts/ThemeContext'
import { DARK_INK, DARK_INK_SECONDARY, DARK_PAPER_WHITE } from '../../styles/chart-theme'
import type { SunburstNode } from './useSunburstData'

interface Props {
  data: SunburstNode | null
  drilledCategory: string | null
  onCategoryClick: (name: string) => void
  onBackToOverview: () => void
  onItemClick: (id: number) => void
  onTechniqueClick: (name: string) => void
}

export default function SunburstChart({
  data,
  drilledCategory,
  onCategoryClick,
  onBackToOverview,
  onItemClick,
  onTechniqueClick,
}: Props) {
  const chartRef = useRef<any>(null)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Reset drill-down when data changes (e.g. filter applied)
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance?.()
    if (instance) {
      // Reset to root view when data source changes
      try {
        instance.dispatchAction({ type: 'sunburstRoot' })
      } catch { /* ignore */ }
    }
  }, [data])

  // Sync external drill-down state with chart
  useEffect(() => {
    const instance = chartRef.current?.getEchartsInstance?.()
    if (!instance) return

    if (drilledCategory === null) {
      // Return to root
      try {
        instance.dispatchAction({ type: 'sunburstRoot' })
      } catch { /* ignore */ }
    }
  }, [drilledCategory])

  const option = useMemo(() => {
    if (!data) return null

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: any) => {
          const d = params.data
          if (!d) return params.name

          // Category level tooltip
          if (d._tooltip?.item_count !== undefined) {
            const t = d._tooltip
            const filteredInfo = t.filtered_count !== undefined && t.filtered_count !== t.item_count
              ? `<br/>当前筛选: ${t.filtered_count} 项`
              : ''
            return `<b>${d.name}</b><br/>项目: ${t.item_count} 项${filteredInfo}<br/>地域: ${t.region_count} 省<br/>时代: ${t.era_range}<br/>技法: ${t.technique_count} 种`
          }

          // Item level tooltip
          if (d._tooltip?.region) {
            const t = d._tooltip
            return `<b>${d.name}</b><br/>品类: ${t.category}<br/>地域: ${t.region}<br/>时代: ${t.era}<br/>技法: ${t.techniqueCount} 种`
          }

          // Technique level
          if (d._techniqueName) {
            return `<b>${d.name}</b><br/>技法 · ${d._tooltip?.category || ''}`
          }

          return d.name
        },
      },
      series: [
        {
          type: 'sunburst',
          data: [data],
          radius: ['8%', '88%'],
          center: ['50%', '54%'],
          sort: 'desc',
          nodeClick: 'rootToNode' as const,
          emphasis: {
            focus: 'ancestor' as const,
          },
          levels: [
            {},
            {
              // Level 1: Categories (inner ring)
              r0: '12%',
              r: '45%',
              label: {
                show: true,
                rotate: 'radial' as const,
                fontSize: 25,
                color: isDark ? DARK_INK : '#2C241A',
              },
              itemStyle: {
                borderWidth: 2,
                borderColor: isDark ? DARK_PAPER_WHITE : '#fff',
              },
            },
            {
              // Level 2: Items (middle ring)
              r0: '45%',
              r: '72%',
              label: {
                show: true,
                rotate: 'radial' as const,
                fontSize: 25,
                color: isDark ? DARK_INK : '#2C241A',
              },
              itemStyle: {
                borderWidth: 1,
                borderColor: isDark ? DARK_PAPER_WHITE : '#fff',
              },
            },
            {
              // Level 3: Techniques (outer ring)
              r0: '72%',
              r: '90%',
              label: {
                show: true,
                rotate: 'radial' as const,
                fontSize: 12,
                color: isDark ? DARK_INK_SECONDARY : '#5A4F42',
              },
              itemStyle: {
                borderWidth: 0.5,
                borderColor: isDark ? DARK_PAPER_WHITE : '#fff',
              },
            },
          ],
        },
      ],
    }
  }, [data, isDark])

  const onEvents = useMemo(() => ({
    click: (params: any) => {
      if (!params?.data) return
      const d = params.data

      // Item click → open detail drawer (prevent drill-down)
      if (d._itemId) {
        params.event?.event?.stopPropagation?.()
        onItemClick(d._itemId)
        return
      }

      // Technique click → open technique panel
      if (d._techniqueName) {
        params.event?.event?.stopPropagation?.()
        onTechniqueClick(d._techniqueName)
        return
      }

      // Category click → sync drill-down state
      if (d.children && d.children.length > 0 && d.name !== '非遗文化') {
        // Small delay to let ECharts finish its internal update
        setTimeout(() => onCategoryClick(d.name), 0)
        return
      }

      // Root node (center circle) → back to overview
      if (d.name === '非遗文化') {
        onBackToOverview()
      }
    },
  }), [onItemClick, onTechniqueClick, onCategoryClick, onBackToOverview])

  // Handle data via ref to avoid stale closure in onEvents
  const onEventsRef = useRef(onEvents)
  onEventsRef.current = onEvents

  const stableOnEvents = useMemo(() => ({
    click: (params: any) => onEventsRef.current.click(params),
  }), [])

  if (!data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 750 }}>
        <Spin tip="加载图谱数据..." />
      </div>
    )
  }

  // Check if any categories have children
  const hasData = data.children && data.children.some(c => (c.children?.length || 0) > 0)
  if (!hasData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 750 }}>
        <Empty description="该筛选条件下暂无项目" />
      </div>
    )
  }

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height: 750, width: '100%' }}
      onEvents={stableOnEvents}
      notMerge
      lazyUpdate
    />
  )
}
