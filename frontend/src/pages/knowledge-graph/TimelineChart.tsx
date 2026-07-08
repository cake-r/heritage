/**
 * 时间脉络堆叠柱状图
 * X轴：7个核心历史分期（商周→近现代），宋体水平排列，不倾斜、不挤压
 * 柱体：每个分期一根竖向堆叠条，按非遗品类分色，高度=项目总数
 * 底纹：交替极淡米灰底色，古籍卷轴分段感
 * 交互：hover→中式卡片，click→全局朝代筛选，左侧品类筛选→降透明度
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
import type { TimelineItem } from '../../services/knowledgeGraph'

// ===== 朝代→历史分期映射 =====
export const ERA_TO_PERIOD: Record<string, string> = {
  '商': '商周', '西周': '商周', '春秋': '商周', '战国': '商周',
  '秦': '秦汉', '汉': '秦汉', '西汉': '秦汉', '东汉': '秦汉',
  '魏晋': '魏晋南北朝', '南北朝': '魏晋南北朝', '三国': '魏晋南北朝',
  '隋': '隋唐', '唐': '隋唐', '五代': '隋唐',
  '宋': '宋元', '北宋': '宋元', '南宋': '宋元', '元': '宋元', '辽': '宋元', '金': '宋元',
  '明': '明清', '清': '明清',
  '民国': '近现代', '现代': '近现代', '当代': '近现代',
}

/** 7个核心历史分期 */
export const PERIODS = ['商周', '秦汉', '魏晋南北朝', '隋唐', '宋元', '明清', '近现代'] as const

/** 分期→朝代反向映射（用于全局筛选时展开分期名为所有朝代） */
export const PERIOD_TO_ERAS: Record<string, string[]> = {
  '商周': ['商', '西周', '春秋', '战国'],
  '秦汉': ['秦', '汉', '西汉', '东汉'],
  '魏晋南北朝': ['魏晋', '南北朝', '三国'],
  '隋唐': ['隋', '唐', '五代'],
  '宋元': ['宋', '北宋', '南宋', '元', '辽', '金'],
  '明清': ['明', '清'],
  '近现代': ['民国', '现代', '当代'],
}

// ===== 品类堆叠顺序（自下而上） =====
const CATEGORY_ORDER = [
  '刺绣', '陶瓷', '剪纸', '皮影', '织锦', '金属', '漆器', '竹编',
  '雕塑', '泥塑', '民间美术', '戏曲', '年画', '蓝印花布',
  '紫砂', '篆刻', '唐三彩', '书法',
]

const FONT_DISPLAY = '"Noto Serif SC", "Source Han Serif SC", SimSun, serif'
const FONT_BODY = '"Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif'

// ===== Props =====
interface Props {
  timelineData: TimelineItem[]
  activeCategory: string | null
}

export default function TimelineChart({ timelineData, activeCategory }: Props) {
  const { era, setEra } = useFilters()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // 当前选中的分期（era 可能是分期名或朝代名，统一转为分期名）
  const selectedPeriod = useMemo(() => {
    if (!era) return null
    if ((PERIODS as readonly string[]).includes(era)) return era
    return ERA_TO_PERIOD[era] || null
  }, [era])

  // 聚合数据：分期 → 品类 → count（跨同分期所有朝代汇总）
  const periodCategoryData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const p of PERIODS) {
      map[p] = {}
      for (const cat of CATEGORY_ORDER) {
        map[p][cat] = 0
      }
    }

    for (const eraEntry of timelineData) {
      const period = ERA_TO_PERIOD[eraEntry.era]
      if (!period || !map[period]) continue

      // 从 items 数组直接统计品类（与旧 TimelineScatter 一致）
      for (const item of eraEntry.items) {
        const cat = item.category
        if (map[period][cat] !== undefined) {
          map[period][cat]++
        }
      }
    }

    return map
  }, [timelineData])

  // 每个分期的项目总数 & 全局最大值
  const maxTotal = useMemo(() => {
    let max = 0
    for (const p of PERIODS) {
      const t = Object.values(periodCategoryData[p] || {}).reduce((a, b) => a + b, 0)
      max = Math.max(max, t)
    }
    return max || 1
  }, [periodCategoryData])

  const option = useMemo(() => {
    // isDark-aware colors
    const paperWhite = isDark ? DARK_PAPER_WHITE : '#FFFDF9'
    const ink = isDark ? DARK_INK : '#2C241A'
    const inkSecondary = isDark ? DARK_INK_SECONDARY : '#6B5F52'
    const vermilion = isDark ? DARK_VERMILION : VERMILION
    const borderMedium = isDark ? '#4A4540' : BORDER_MEDIUM
    const borderLight = isDark ? '#3A3530' : BORDER_LIGHT

    // 构建每个品类的堆叠 series
    const barSeries = CATEGORY_ORDER.map(cat => {
      const catColor = getCategoryColor(cat)
      const isDimmed = !!(activeCategory && activeCategory !== cat)

      return {
        name: cat,
        type: 'bar' as const,
        stack: 'total',
        cursor: 'pointer',
        barWidth: '55%',
        emphasis: {
          focus: 'series' as const,
        },
        itemStyle: {
          color: catColor,
          opacity: isDimmed ? 0.12 : 0.92,
          borderRadius: 3,
          borderWidth: 0,
        },
        data: PERIODS.map(p => {
          const count = periodCategoryData[p]?.[cat] || 0
          const isSelected = p === selectedPeriod
          return {
            value: count,
            ...(isSelected ? {
              itemStyle: {
                borderColor: vermilion,
                borderWidth: 1.5,
                borderRadius: 3,
              },
            } : {}),
          }
        }),
      }
    })

    // TODO: 分段底纹 — markArea 在 ECharts 6.1 中格式变更导致 "Cannot read 'coord'"
    // 先用基础版本跑通，后续用 graphic 或独立 series 实现

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: {
          type: 'shadow' as const,
          shadowStyle: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(30,27,24,0.04)',
          },
        },
        backgroundColor: paperWhite,
        borderColor: GOLD_LIGHT,
        borderWidth: 1,
        padding: [14, 18],
        extraCssText: `border-radius:10px;box-shadow:0 6px 20px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(30,27,24,0.12)'};`,
        textStyle: {
          color: ink,
          fontSize: 15,
          fontFamily: FONT_BODY,
        },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          const periodName = params[0].axisValue
          let total = 0
          for (const p of params) {
            total += (p.value || 0) as number
          }
          if (total === 0) return `
            <div style="font-family:'Noto Serif SC','Source Han Serif SC',SimSun,serif;text-align:center;color:${inkSecondary}">
              📜 ${periodName}<br/>暂无数据
            </div>`

          const items = params
            .filter((p: any) => p.value > 0)
            .sort((a: any, b: any) => b.value - a.value)
            .map((p: any) => {
              const dotColor = typeof p.color === 'string' ? p.color : '#999'
              return `<div style="display:flex;align-items:center;justify-content:space-between;padding:2px 0;font-size:15px;color:${isDark ? '#A09888' : '#5A4F42'};min-width:160px">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:6px"></span>${p.seriesName}</span>
                <b style="color:${ink};margin-left:16px">${p.value}</b> 项
              </div>`
            })
            .join('')

          return `
            <div style="font-family:'Noto Serif SC','Source Han Serif SC',SimSun,serif">
              <div style="font-size:18px;font-weight:700;color:${ink};margin-bottom:6px;padding-bottom:8px;border-bottom:1px solid ${GOLD_LIGHT}">
                📜 ${periodName}
              </div>
              <div style="font-size:15px;color:${inkSecondary};margin-bottom:10px">
                非遗项目总计：<b style="color:${vermilion};font-size:18px">${total}</b> 项
              </div>
              <div style="margin-bottom:2px">${items}</div>
              <div style="font-size:13px;color:${isDark ? '#A09888' : '#C4BEB4'};margin-top:8px;padding-top:6px;border-top:1px dashed ${borderLight};font-style:italic">
                点击柱子筛选此历史分期
              </div>
            </div>`
        },
      },
      legend: {
        show: true,
        type: 'scroll' as const,
        orient: 'horizontal',
        left: 8,
        top: 0,
        itemWidth: 14,
        itemHeight: 14,
        itemGap: 16,
        textStyle: {
          fontSize: 16,
          color: inkSecondary,
          fontFamily: FONT_BODY,
        },
        pageTextStyle: {
          color: inkSecondary,
        },
      },
      grid: {
        top: 50,
        bottom: 36,
        left: 48,
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
          fontSize: 15,
          fontFamily: FONT_DISPLAY,
          color: ink,
          fontWeight: 500,
          interval: 0,
        },
        splitLine: { show: false },
        // 交替分段底色（古籍卷轴分段感）— 比 markArea 更简洁可靠
        splitArea: {
          show: true,
          areaStyle: {
            color: isDark
              ? ['rgba(32,28,24,0.40)', 'rgba(196,162,101,0.05)']
              : ['rgba(247,244,237,0.40)', 'rgba(196,162,101,0.07)'],
          },
        },
      },
      yAxis: {
        type: 'value',
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          fontSize: 13,
          fontFamily: FONT_BODY,
          color: inkSecondary,
        },
        splitLine: { show: false },
      },
      series: barSeries,
    }
  }, [periodCategoryData, maxTotal, selectedPeriod, activeCategory, isDark])

  // 点击事件 → setEra
  const onEvents = useMemo(() => ({
    click: (params: any) => {
      if (params.componentType === 'series' && params.componentSubType === 'bar') {
        const clickedPeriod = params.name
        if (!clickedPeriod || !(PERIODS as readonly string[]).includes(clickedPeriod)) return

        if (selectedPeriod === clickedPeriod) {
          setEra(null)
        } else {
          setEra(clickedPeriod)
        }
      }
    },
  }), [selectedPeriod, setEra])

  // ========== Empty State ==========
  if (!timelineData.length) {
    return (
      <div style={{
        height: 380, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: isDark ? DARK_INK_SECONDARY : '#6B5F52',
      }}>
        <Empty description="暂无时间轴数据" />
      </div>
    )
  }

  // ========== Render ==========
  return (
    <ReactECharts
      option={option}
      style={{ height: 380, width: '100%' }}
      onEvents={onEvents}
      notMerge
    />
  )
}
