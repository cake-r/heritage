/**
 * 时间脉络散点图 — 朝代分段式设计
 * X轴：7个历史分期（先秦→近现代），宋体水平排列，无倾斜
 * Y轴：品类纵向错落，每品类一个槽位
 * 散点：颜色=品类，大小=项目数，外晕=墨点晕染
 * 底色：markArea 交替浅米黄/浅鎏金分段
 * 交互：hover 中式卡片，click→setEra 联动筛选
 *
 * 注意：ECharts 渲染到 Canvas，所有颜色值必须使用硬编码 hex/rgba，
 * CSS 变量（var(--xxx)）在 Canvas 中不会解析。
 */

import { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { Empty } from 'antd'
import { getCategoryColor } from '../../utils/categoryColors'
import { useFilters } from './FilterContext'
import { useTheme } from '../../contexts/ThemeContext'
import {
  DARK_PAPER_WHITE,
  DARK_INK,
  DARK_INK_SECONDARY,
  DARK_VERMILION,
  GOLD_LIGHT,
  VERMILION,
  BORDER_MEDIUM,
  BORDER_LIGHT,
} from '../../styles/chart-theme'
import type { TimelineItem, ItemNode } from '../../services/knowledgeGraph'

interface Props {
  timelineData: TimelineItem[]
  allItems: ItemNode[]
  activeCategory: string | null
}

const FONT_DISPLAY = '"Noto Serif SC", "Source Han Serif SC", SimSun, serif'
const FONT_BODY = '"Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif'

// ===== 朝代→历史分期映射 =====
const ERA_TO_PERIOD: Record<string, string> = {
  '先秦': '先秦', '商': '先秦', '西周': '先秦', '春秋': '先秦', '战国': '先秦',
  '秦': '秦汉', '汉': '秦汉', '西汉': '秦汉', '东汉': '秦汉',
  '魏晋': '魏晋南北朝', '南北朝': '魏晋南北朝', '三国': '魏晋南北朝',
  '隋': '隋唐', '唐': '隋唐', '五代': '隋唐',
  '宋': '宋元', '北宋': '宋元', '南宋': '宋元', '元': '宋元', '辽': '宋元', '金': '宋元',
  '明': '明清', '清': '明清',
  '民国': '近现代', '现代': '近现代', '当代': '近现代',
}

const PERIODS = ['先秦', '秦汉', '魏晋南北朝', '隋唐', '宋元', '明清', '近现代']
const PERIOD_BG_COLORS_LIGHT = [
  'rgba(247,244,237,0.55)',   // 先秦 — 极浅米黄
  'rgba(196,162,101,0.10)',   // 秦汉 — 浅鎏金
  'rgba(247,244,237,0.55)',   // 魏晋南北朝
  'rgba(196,162,101,0.10)',   // 隋唐
  'rgba(247,244,237,0.55)',   // 宋元
  'rgba(196,162,101,0.10)',   // 明清
  'rgba(247,244,237,0.55)',   // 近现代
]
const PERIOD_BG_COLORS_DARK = [
  'rgba(32,28,24,0.55)',      // 先秦
  'rgba(196,162,101,0.06)',   // 秦汉
  'rgba(32,28,24,0.55)',      // 魏晋南北朝
  'rgba(196,162,101,0.06)',   // 隋唐
  'rgba(32,28,24,0.55)',      // 宋元
  'rgba(196,162,101,0.06)',   // 明清
  'rgba(32,28,24,0.55)',      // 近现代
]

// 品类纵向槽位（Y轴位置）
const CATEGORY_ORDER = [
  '刺绣', '陶瓷', '剪纸', '皮影', '织锦', '金属', '漆器', '竹编',
  '雕塑', '泥塑', '民间美术', '戏曲', '年画', '蓝印花布',
  '紫砂', '篆刻', '唐三彩', '书法',
]

export default function TimelineScatter({ timelineData, allItems, activeCategory }: Props) {
  const { era, setEra } = useFilters()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // 聚合数据：{ period -> { category -> { count, items } } }
  const periodData = useMemo(() => {
    const map: Record<string, Record<string, { count: number; items: { id: number; name: string; era: string; techniques: number }[] }>> = {}
    for (const p of PERIODS) {
      map[p] = {}
      for (const cat of CATEGORY_ORDER) {
        map[p][cat] = { count: 0, items: [] }
      }
    }

    for (const eraEntry of timelineData) {
      const period = ERA_TO_PERIOD[eraEntry.era] || '近现代'
      if (!map[period]) continue
      for (const item of eraEntry.items) {
        const cat = item.category
        if (!map[period][cat]) map[period][cat] = { count: 0, items: [] }
        map[period][cat].count++
        map[period][cat].items.push({
          id: item.id,
          name: item.name,
          era: eraEntry.era,
          techniques: (allItems.find(n => n.id === item.id)?.techniques || []).length,
        })
      }
    }
    return map
  }, [timelineData, allItems])

  // 计算全局最大 count 用于散点大小归一化
  const maxGlobalCount = useMemo(() => {
    let m = 0
    for (const p of PERIODS) {
      for (const cat of CATEGORY_ORDER) {
        m = Math.max(m, periodData[p]?.[cat]?.count || 0)
      }
    }
    return m || 1
  }, [periodData])

  // 构建 scatter series 数据
  const scatterSeries = useMemo(() => {
    const allScatterData: any[] = []

    for (let pi = 0; pi < PERIODS.length; pi++) {
      const period = PERIODS[pi]
      for (let ci = 0; ci < CATEGORY_ORDER.length; ci++) {
        const cat = CATEGORY_ORDER[ci]
        const cell = periodData[period]?.[cat]
        if (!cell || cell.count === 0) continue

        const catColor = getCategoryColor(cat)
        const isDimmed = !!(activeCategory && activeCategory !== cat)

        // 散点大小：基础 10px，最大 34px，按 count 线性映射
        const baseSize = 10
        const maxSize = 34
        const size = baseSize + (cell.count / maxGlobalCount) * (maxSize - baseSize)

        allScatterData.push({
          value: [pi, ci],
          name: cat,
          symbolSize: size,
          itemStyle: {
            color: catColor,
            opacity: isDimmed ? 0.12 : 0.88,
            shadowBlur: isDimmed ? 0 : 10,
            shadowColor: isDimmed ? 'transparent' : catColor,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
            borderWidth: 0.5,
          },
          emphasis: {
            scale: 1.8,
            itemStyle: {
              shadowBlur: 20,
              shadowColor: catColor,
              opacity: 1,
              borderColor: isDark ? DARK_PAPER_WHITE : '#fff',
              borderWidth: 1.5,
            },
          },
          _cell: cell,
          _period: period,
          _category: cat,
          _periodIdx: pi,
        })
      }
    }
    return allScatterData
  }, [periodData, activeCategory, maxGlobalCount, isDark])

  const option = useMemo(() => {
    if (!timelineData.length) return {}

    // isDark-aware colors
    const paperWhite = isDark ? DARK_PAPER_WHITE : '#FFFDF9'
    const ink = isDark ? DARK_INK : '#2C241A'
    const inkSecondary = isDark ? DARK_INK_SECONDARY : '#6B5F52'
    const vermilion = isDark ? DARK_VERMILION : VERMILION
    const borderMedium = isDark ? '#4A4540' : BORDER_MEDIUM
    const borderLight = isDark ? '#3A3530' : BORDER_LIGHT
    const periodBgColors = isDark ? PERIOD_BG_COLORS_DARK : PERIOD_BG_COLORS_LIGHT

    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: paperWhite,
        borderColor: GOLD_LIGHT,
        borderWidth: 1,
        padding: [14, 18],
        extraCssText: `border-radius:10px;box-shadow:0 4px 16px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(30,27,24,0.10)'};`,
        textStyle: {
          color: ink,
          fontSize: 13,
          fontFamily: FONT_BODY,
        },
        formatter: (params: any) => {
          const d = params.data
          if (!d?._cell) return ''
          const { _cell, _period, _category } = d
          const itemNames = _cell.items.slice(0, 8).map((i: any) => i.name).join('、')
          const more = _cell.items.length > 8 ? ` 等${_cell.items.length}项` : ''
          return `
            <div style="font-family:'Noto Serif SC','Source Han Serif SC',SimSun,serif;min-width:190px">
              <div style="font-size:15px;font-weight:600;color:${ink};margin-bottom:8px;border-bottom:1px solid ${GOLD_LIGHT};padding-bottom:6px">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:text-bottom;margin-right:4px"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>${_period} · ${_category}
              </div>
              <div style="font-size:13px;color:${inkSecondary};margin-bottom:4px">
                非遗项目：<b style="color:${vermilion}">${_cell.count}</b> 项
              </div>
              <div style="font-size:12px;color:${isDark ? '#A09888' : '#5A4F42'};line-height:1.7;max-width:270px">
                ${itemNames}${more}
              </div>
              <div style="font-size:11px;color:${isDark ? '#A09888' : '#C4BEB4'};margin-top:8px;font-style:italic">
                点击散点筛选此历史分期
              </div>
            </div>`
        },
      },
      grid: {
        top: 36,
        bottom: 36,
        left: 24,
        right: 16,
      },
      xAxis: {
        type: 'category',
        data: PERIODS,
        position: 'bottom',
        axisTick: { show: false },
        axisLine: {
          lineStyle: { color: borderMedium, width: 0.5 },
        },
        axisLabel: {
          fontSize: 13,
          fontFamily: FONT_DISPLAY,
          color: ink,
          fontWeight: 500,
          interval: 0,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category',
        data: CATEGORY_ORDER,
        position: 'left',
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          fontSize: 11,
          fontFamily: FONT_BODY,
          color: inkSecondary,
          width: 52,
          overflow: 'truncate',
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: borderLight,
            width: 0.5,
            type: 'dashed' as const,
          },
        },
        inverse: true,
      },
      series: [
        {
          type: 'scatter',
          data: scatterSeries,
          cursor: 'pointer',
          symbol: 'circle',
          // markArea 分段底色
          markArea: {
            silent: true,
            itemStyle: { borderWidth: 0 },
            data: PERIODS.map((name, idx) => ({
              name,
              itemStyle: { color: periodBgColors[idx] },
              coord: [
                { xAxis: idx - 0.46, yAxis: -0.5 },
                { xAxis: idx + 0.46, yAxis: CATEGORY_ORDER.length - 0.5 },
              ],
            })),
          },
        },
      ],
      // 左上角极简图例
      graphic: [
        {
          type: 'text' as const,
          left: 12,
          top: 4,
          style: {
            text: '● 颜色 = 品类    ● 大小 = 数量',
            fill: inkSecondary,
            font: '11px "Noto Sans SC", sans-serif',
          },
        },
      ],
    }
  }, [timelineData, scatterSeries, isDark])

  // 点击事件 → setEra
  const onEvents = useMemo(() => ({
    click: (params: any) => {
      // ECharts scatter 点击: componentType === 'series', componentSubType === 'scatter'
      if (params.componentType === 'series' && params.componentSubType === 'scatter') {
        const clickedPeriod = params.data?._period
        if (!clickedPeriod) return

        const periodEras = timelineData
          .filter(e => ERA_TO_PERIOD[e.era] === clickedPeriod)
          .map(e => e.era)

        if (periodEras.length > 0) {
          const currentPeriod = era ? ERA_TO_PERIOD[era] : null
          if (currentPeriod === clickedPeriod) {
            setEra(null)
          } else {
            setEra(periodEras[0])
          }
        }
      }
    },
  }), [timelineData, era, setEra])

  if (!timelineData.length) {
    return (
      <div style={{
        height: 420, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: isDark ? DARK_INK_SECONDARY : '#6B5F52',
      }}>
        <Empty description="暂无时间轴数据" />
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 420, width: '100%' }}
      onEvents={onEvents}
      notMerge
      lazyUpdate
    />
  )
}
