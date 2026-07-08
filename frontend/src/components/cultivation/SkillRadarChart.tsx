/** 六艺技能雷达图 — ECharts 蛛网图展示6条技能树总览 */

import { Component } from 'react'
import { Empty } from 'antd'
import ReactECharts from 'echarts-for-react'

import type { SkillTreeProgress } from '../../services/cultivation'

class SafeChart extends Component<{ option: any; style?: React.CSSProperties }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <Empty description="雷达图暂时不可用" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 20 }} />
    }
    return (
      <ReactECharts
        option={this.props.option}
        style={this.props.style}
        notMerge
        lazyUpdate
      />
    )
  }
}

interface Props {
  skillTrees: SkillTreeProgress[]
  darkMode?: boolean
}

export default function SkillRadarChart({ skillTrees, darkMode }: Props) {
  const textColor = darkMode ? '#DED9D0' : '#2C241A'
  const areaColor = darkMode ? 'rgba(184,70,58,0.2)' : 'rgba(184,70,58,0.15)'
  const vermilionColor = darkMode ? '#C96B5F' : '#B8463A'
  const vermilionArea = darkMode ? 'rgba(201,107,95,0.25)' : 'rgba(184,70,58,0.25)'

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.name && params.value != null) {
          return `${params.name}<br/>进度: <b>${params.value}%</b>`
        }
        return ''
      },
    },
    legend: { show: false },
    radar: {
      center: ['50%', '52%'],
      radius: '68%',
      indicator: skillTrees.map(t => ({
        name: `${t.icon} ${t.label.replace('之路', '')}`,
        max: 100,
      })),
      axisName: {
        color: textColor,
        fontSize: 16,
        borderRadius: 3,
        padding: [2, 4],
      },
      splitArea: {
        areaStyle: {
          color: [areaColor, 'transparent', areaColor, 'transparent'],
        },
      },
      axisLine: {
        lineStyle: { color: darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' },
      },
      splitLine: {
        lineStyle: { color: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
      },
    },
    series: [{
      type: 'radar',
      data: [{
        value: skillTrees.map(t => t.percentage),
        name: '技能进度',
        areaStyle: {
          color: vermilionArea,
        },
        lineStyle: {
          color: vermilionColor,
          width: 2,
        },
        itemStyle: {
          color: vermilionColor,
        },
        symbol: 'circle',
        symbolSize: 5,
      }],
    }],
  }

  return (
    <SafeChart option={option} style={{ height: 280 }} />
  )
}
