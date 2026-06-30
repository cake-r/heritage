/**
 * 地域分布地图 — 分级设色 + 品类联动
 * 色阶：0项→米灰 / 1-5→浅鎏金 / 6-20→深鎏金 / 20+→朱砂红
 * 省界：浅褐细线，选中省份朱砂描边 + 外发光
 * 交互：hover 中式卡片，click→setRegion 联动筛选
 *
 * 注意：ECharts Canvas 渲染不支持 CSS 变量，全部使用硬编码色值。
 * GeoJSON 用全名（"江苏省"），API 返回短名（"江苏"），通过 nameMap 桥接。
 */

import { useMemo, useEffect, useState, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import { Empty } from 'antd'
import { getCategoryColor } from '../../utils/categoryColors'
import { useFilters } from './FilterContext'
import type { RegionData, ItemNode } from '../../services/knowledgeGraph'

interface Props {
  data: RegionData[]
  allItems: ItemNode[]
  activeCategory: string | null
}

let chinaGeo: any = null

// ===== 硬编码色值（来自 tokens.css，Canvas 兼容） =====
const INK = '#2C241A'
const INK_SECONDARY = '#6B5F52'
const PAPER_WHITE = '#FFFDF9'
const GOLD_LIGHT = '#E8D5B0'
const BORDER_MEDIUM = '#D5CFC0'
const VERMILION = '#B8463A'
const FONT_DISPLAY = '"Noto Serif SC", "Source Han Serif SC", SimSun, serif'
const FONT_BODY = '"Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif'

// 四档色阶
const COLOR_0 = '#F7F4ED'
const COLOR_LOW = '#E8D5B0'
const COLOR_MID = '#C4A265'
const COLOR_HIGH = '#B8463A'

function getAreaColor(value: number): string {
  if (value === 0) return COLOR_0
  if (value <= 5) return COLOR_LOW
  if (value <= 20) return COLOR_MID
  return COLOR_HIGH
}

// 省份全名→短名 映射（用于 GeoJSON→API 数据匹配）
const SUFFIXES = ['省', '市', '自治区', '壮族自治区', '回族自治区', '维吾尔自治区', '特别行政区']
function toShortName(fullName: string): string {
  for (const s of SUFFIXES) {
    if (fullName.endsWith(s) && fullName.length > s.length) {
      return fullName.slice(0, -s.length)
    }
  }
  return fullName
}

export default function ChoroplethMap({ data, allItems, activeCategory }: Props) {
  const { region, setRegion } = useFilters()
  const [geoLoaded, setGeoLoaded] = useState(false)
  const chartRef = useRef<any>(null)

  // 加载 GeoJSON
  useEffect(() => {
    if (chinaGeo) { setGeoLoaded(true); return }
    fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
      .then(r => r.json())
      .then(geo => { chinaGeo = geo; setGeoLoaded(true) })
      .catch(() => setGeoLoaded(true))
  }, [])

  // 构建短名→全名 的 nameMap（桥接 API 短名和 GeoJSON 全名）
  const nameMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (!chinaGeo) return map
    for (const feature of chinaGeo.features || []) {
      const fullName = feature.properties?.name || ''
      const shortName = toShortName(fullName)
      if (shortName && shortName !== fullName) {
        map[shortName] = fullName
      }
    }
    return map
  }, [geoLoaded])

  // 品类筛选后的省份值；同时将 API 短名映射到 GeoJSON 全名
  const filteredMapData = useMemo(() => {
    const buildEntry = (d: RegionData, items: ItemNode[]) => {
      const geoName = nameMap[d.name] || d.name // 短名→全名
      const categories = [...new Set(items.map(n => n.category))]
      const topTechniques = [...new Set(items.flatMap(n => n.techniques || []))]
      return {
        name: geoName,
        value: items.length,
        _rawName: d.name,
        _items: items.map(n => n.name),
        _categories: categories,
        _topTechniques: topTechniques.slice(0, 5),
      }
    }

    if (!activeCategory) {
      return data.map(d => buildEntry(d, allItems.filter(
        n => n.region.includes(d.name)
      )))
    }

    return data.map(d => {
      const filteredItems = allItems.filter(
        n => n.region.includes(d.name) && n.category === activeCategory
      )
      return buildEntry(d, filteredItems)
    })
  }, [data, allItems, activeCategory, nameMap])

  const maxVal = useMemo(
    () => Math.max(...filteredMapData.map(d => d.value), 1),
    [filteredMapData],
  )

  // 仅标注有数据的省份
  const labeledProvinces = useMemo(() => {
    const set = new Set<string>()
    for (const d of filteredMapData) {
      if (d.value > 0) set.add(d.name)
    }
    return set
  }, [filteredMapData])

  const option = useMemo(() => {
    if (!geoLoaded || !data.length) return {}

    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: PAPER_WHITE,
        borderColor: GOLD_LIGHT,
        borderWidth: 1,
        padding: [14, 18],
        extraCssText: 'border-radius:10px;box-shadow:0 4px 16px rgba(30,27,24,0.10);',
        textStyle: { color: INK, fontSize: 13, fontFamily: FONT_BODY },
        formatter: (params: any) => {
          if (params.seriesType !== 'map') return params.name
          const d = filteredMapData.find(r => r.name === params.name)
          if (!d || d.value === 0) {
            return `<div style="font-family:'Noto Serif SC',serif;padding:4px"><b>${params.name}</b><br/><span style="color:#8A8378">暂无收录</span></div>`
          }
          const catDots = d._categories.slice(0, 5).map((c: string) =>
            `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getCategoryColor(c)};margin-right:4px;vertical-align:middle"></span>${c}`
          ).join('<br/>')
          const more = d._categories.length > 5
            ? `<br/><span style="color:#8A8378;font-size:11px">...共${d._categories.length}个品类</span>` : ''
          return `
            <div style="font-family:'Noto Serif SC','Source Han Serif SC',SimSun,serif;min-width:170px">
              <div style="font-size:15px;font-weight:600;color:#2C241A;margin-bottom:8px;border-bottom:1px solid #E8D5B0;padding-bottom:6px">
                🏛 ${d._rawName || d.name}
              </div>
              <div style="font-size:13px;color:#6B5F52;margin-bottom:4px">
                非遗项目：<b style="color:#B8463A;font-size:16px">${d.value}</b> 项
              </div>
              ${d._categories.length > 0 ? `<div style="font-size:12px;line-height:1.9;margin-top:4px;color:#5A4F42">${catDots}${more}</div>` : ''}
              ${d._topTechniques.length > 0 ? `<div style="font-size:11px;color:#8A8378;margin-top:6px">热门技法：${d._topTechniques.slice(0, 3).join('、')}</div>` : ''}
            </div>`
        },
      },
      visualMap: {
        min: 0,
        max: Math.max(maxVal, 20),
        pieces: [
          { min: 21, color: COLOR_HIGH, label: '20+ 项' },
          { min: 6, max: 20, color: COLOR_MID, label: '6-20 项' },
          { min: 1, max: 5, color: COLOR_LOW, label: '1-5 项' },
          { value: 0, color: COLOR_0, label: '无数据' },
        ],
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 4,
        itemWidth: 16,
        itemHeight: 10,
        itemGap: 6,
        textStyle: { fontSize: 11, color: INK_SECONDARY, fontFamily: FONT_BODY },
        showLabel: true,
      },
      series: [
        {
          type: 'map' as const,
          map: 'china',
          roam: true,
          zoom: 1.15,
          center: [104, 36],
          aspectScale: 0.85,
          nameProperty: 'name',
          nameMap,  // 短名 → 全名桥接
          label: {
            show: true,
            fontSize: 10,
            color: INK_SECONDARY,
            fontFamily: FONT_DISPLAY,
            formatter: (params: any) => labeledProvinces.has(params.name) ? params.name : '',
          },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' as const, fontFamily: FONT_DISPLAY, color: VERMILION },
            itemStyle: { borderColor: VERMILION, borderWidth: 2.5, shadowBlur: 20, shadowColor: 'rgba(184, 70, 58, 0.45)' },
          },
          itemStyle: { borderColor: BORDER_MEDIUM, borderWidth: 0.5, areaColor: COLOR_0 },
          data: filteredMapData,
          ...(region ? {
            selectedMode: 'single' as const,
            selected: { [nameMap[region] || region]: true },
          } : {}),
        },
      ],
    }
  }, [data, region, geoLoaded, maxVal, filteredMapData, labeledProvinces, nameMap])

  // 点击 → setRegion（使用短名）
  const rawNameLookup = useMemo(() => {
    const map: Record<string, string> = {}
    for (const d of filteredMapData) {
      if (d._rawName) map[d.name] = d._rawName
    }
    return map
  }, [filteredMapData])

  const onEvents = useMemo(() => ({
    click: (params: any) => {
      if (params.componentType === 'series' && params.componentSubType === 'map' && params.name) {
        // params.name 是 GeoJSON 全名，转换为 API 短名
        const shortName = rawNameLookup[params.name] || params.name
        const rd = data.find(d => d.name === shortName)
        if (rd && rd.value > 0) {
          setRegion(region === shortName ? null : shortName)
        }
      }
    },
  }), [data, region, setRegion, rawNameLookup])

  // 注册地图
  useEffect(() => {
    if (chinaGeo) {
      try {
        const ec = (window as any).echarts
        if (ec && !ec.getMap?.('china')) {
          ec.registerMap?.('china', chinaGeo)
        }
      } catch { /* ignore */ }
    }
  }, [geoLoaded])

  if (!geoLoaded) {
    return <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK_SECONDARY }}>加载地图中...</div>
  }

  if (!data.length) {
    return <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Empty description="暂无地域数据" /></div>
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: 'radial-gradient(ellipse at 20% 50%, rgba(247,244,237,0.25) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(247,244,237,0.15) 0%, transparent 50%)',
      }} />
      <ReactECharts ref={chartRef} option={option} style={{ height: 380, width: '100%' }} onEvents={onEvents} notMerge />
    </div>
  )
}
