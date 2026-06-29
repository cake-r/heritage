import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { Empty } from 'antd'
import { getCategoryColor } from '../../utils/categoryColors'
import { useFilters } from './FilterContext'
import type { TimelineItem, ItemNode } from '../../services/knowledgeGraph'

interface Props {
  timelineData: TimelineItem[]
  allItems: ItemNode[]
}

const CATEGORY_ORDER = [
  '刺绣', '陶瓷', '剪纸', '皮影', '织锦', '金属', '漆器', '竹编',
  '雕塑', '泥塑', '民间美术', '戏曲', '年画', '蓝印花布',
  '紫砂', '篆刻', '唐三彩', '书法', '其他',
]

export default function TimelineScatter({ timelineData, allItems }: Props) {
  const { era, setEra } = useFilters()

  // Build technique count map from allItems
  const techniqueCountMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const item of allItems) {
      map.set(item.id, (item.techniques || []).length)
    }
    return map
  }, [allItems])

  // Build cumulative era data for timeline
  const { timelineLabels, timelineOptions } = useMemo(() => {
    if (!timelineData.length) return { timelineLabels: [] as string[], timelineOptions: [] as any[] }

    const labels: string[] = []
    const options: any[] = []

    // Track seen item ids for cumulative display
    const seenItemIds = new Set<number>()

    for (let eraIdx = 0; eraIdx < timelineData.length; eraIdx++) {
      const eraEntry = timelineData[eraIdx]
      labels.push(eraEntry.era)

      // Mark new items this era
      const newThisEra = new Set<number>()
      for (const item of eraEntry.items) {
        newThisEra.add(item.id)
        seenItemIds.add(item.id)
      }

      // Build scatter data: all items seen so far
      const scatterData: any[] = []
      for (let pastIdx = 0; pastIdx <= eraIdx; pastIdx++) {
        for (const item of timelineData[pastIdx].items) {
          const catIdx = CATEGORY_ORDER.indexOf(item.category)
          if (catIdx < 0) continue
          const tc = techniqueCountMap.get(item.id) || 1
          const isNew = newThisEra.has(item.id)
          scatterData.push({
            value: [catIdx, Math.random() * 0.8 + 0.1, tc],
            name: item.name,
            itemStyle: {
              color: getCategoryColor(item.category),
              opacity: isNew ? 1 : 0.2,
            },
            symbolSize: Math.max(8, Math.min(tc * 4 + 6, 28)),
            _tooltip: {
              name: item.name,
              category: item.category,
              era: timelineData[pastIdx].era,
              techniques: tc,
              isNew,
            },
          })
        }
      }

      // Mark points for techniques introduced in this era
      const markPoints: any[] = []
      for (const techName of eraEntry.techniques_introduced || []) {
        // Find an item that uses this technique in the current era
        let foundCatIdx = -1
        for (const item of eraEntry.items) {
          const catIdx = CATEGORY_ORDER.indexOf(item.category)
          if (catIdx >= 0) {
            foundCatIdx = catIdx
            break
          }
        }
        if (foundCatIdx >= 0) {
          markPoints.push({
            name: techName,
            coord: [foundCatIdx, 0.95],
            symbol: 'pin',
            symbolSize: 22,
            itemStyle: { color: '#B8463A' },
            label: { show: false },
            _tooltip: { isNewTechnique: true, name: techName },
          })
        }
      }

      options.push({
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const d = params.data?._tooltip || params.data
            if (d?.isNewTechnique) {
              return `<b>🆕 ${d.name}</b><br/>技法首次出现`
            }
            if (d?.name) {
              return `<b>${d.name}</b><br/>品类: ${d.category}<br/>时代: ${d.era}<br/>技法数: ${d.techniques}<br/>${d.isNew ? '<span style="color:#B8463A">✦ 本朝新出现</span>' : '<span style="color:#8A8378">历史传承</span>'}`
            }
            return params.name
          },
        },
        grid: { top: 20, bottom: 60, left: 10, right: 20 },
        xAxis: {
          type: 'category',
          data: CATEGORY_ORDER,
          axisLabel: { rotate: 30, fontSize: 12, color: '#555' },
          name: '品类',
          nameLocation: 'middle',
          nameGap: 50,
          nameTextStyle: { fontSize: 12, color: '#777' },
        },
        yAxis: {
          type: 'value',
          show: false,
          min: -0.1,
          max: 1.1,
        },
        series: [
          {
            type: 'scatter',
            data: scatterData,
            emphasis: {
              scale: 1.5,
              focus: 'self',
            },
            markPoint: markPoints.length > 0 ? {
              data: markPoints,
              animation: true,
              label: { show: false },
            } : undefined,
          },
        ],
      })
    }

    return { timelineLabels: labels, timelineOptions: options }
  }, [timelineData, techniqueCountMap])

  const option = useMemo(() => {
    if (!timelineLabels.length) return {}
    return {
      timeline: {
        data: timelineLabels,
        axisType: 'category' as const,
        autoPlay: true,
        playInterval: 2000,
        loop: true,
        label: {
          fontSize: 12,
          fontWeight: 'bold' as const,
          color: '#2C241A',
        },
        checkpointStyle: {
          color: '#B8463A',
          borderColor: '#B8463A',
        },
        controlStyle: {
          show: true,
          position: 'left' as const,
          itemSize: 24,
          borderColor: '#C4A265',
        },
        lineStyle: { color: '#C4A265' },
        emphasis: {
          label: { color: '#B8463A' },
          checkpointStyle: { color: '#B8463A' },
        },
      },
      options: timelineOptions,
    }
  }, [timelineLabels, timelineOptions])

  // Handle timeline label click (era selection)
  const onEvents = useMemo(() => ({
    timelinechanged: (params: any) => {
      if (params && params.currentIndex !== undefined) {
        const clickedEra = timelineLabels[params.currentIndex]
        if (clickedEra) {
          setEra(era === clickedEra ? null : clickedEra)
        }
      }
    },
  }), [timelineLabels, era, setEra])

  if (!timelineData.length) {
    return (
      <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="暂无时间轴数据" />
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 360, width: '100%' }}
      onEvents={onEvents}
      notMerge
      lazyUpdate
    />
  )
}
