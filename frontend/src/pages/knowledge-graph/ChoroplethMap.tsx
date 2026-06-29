import { useMemo, useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Empty } from 'antd'
import { getCategoryColor } from '../../utils/categoryColors'
import { useFilters } from './FilterContext'
import type { RegionData } from '../../services/knowledgeGraph'

interface Props {
  data: RegionData[]
}

let chinaGeo: any = null

export default function ChoroplethMap({ data }: Props) {
  const { region, setRegion } = useFilters()
  const [geoLoaded, setGeoLoaded] = useState(false)

  useEffect(() => {
    if (chinaGeo) { setGeoLoaded(true); return }
    fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
      .then(r => r.json())
      .then(geo => { chinaGeo = geo; setGeoLoaded(true) })
      .catch(() => setGeoLoaded(true))
  }, [])

  const maxVal = useMemo(() => Math.max(...data.map(d => d.value), 1), [data])

  const option = useMemo(() => {
    if (!geoLoaded || !data.length) return {}

    // Map data array for choropleth coloring
    const mapData = data.map(d => ({
      name: d.name,
      value: d.value,
      _items: d.items,
      _categories: d.categories,
      _topTechniques: d.top_techniques,
    }))

    // Highlight selected province
    const selectedProvince: any[] = []
    if (region) {
      selectedProvince.push({
        name: region,
        selected: true,
        itemStyle: { areaColor: '#B8463A', opacity: 0.7, borderWidth: 2, borderColor: '#B8463A' },
        label: { show: true, fontSize: 13, fontWeight: 'bold', color: '#B8463A' },
      })
    }

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: any) => {
          if (params.seriesType !== 'map') return params.name
          const d = data.find(r => r.name === params.name)
          if (!d) return params.name
          const catDots = d.categories.slice(0, 6).map(c =>
            `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${getCategoryColor(c)};margin-right:4px"></span>${c}`
          ).join('<br/>')
          const more = d.categories.length > 6 ? `<br/>...共${d.categories.length}个品类` : ''
          return `<b>${d.name}</b><br/>非遗项目: <b>${d.value}</b> 项<br/>${catDots}${more}<br/><small>热门技法: ${d.top_techniques.slice(0, 3).join('、')}</small>`
        },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        text: ['多', '少'],
        realtime: false,
        calculable: true,
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 8,
        itemWidth: 12,
        itemHeight: 100,
        textStyle: { fontSize: 12, color: '#777' },
        inRange: {
          color: ['#fdf8f0', '#e8d5c0', '#C4A265', '#8B4513'],
        },
      },
      series: [
        {
          type: 'map',
          map: 'china',
          roam: true,
          zoom: 1.15,
          center: [104, 36],
          aspectScale: 0.85,
          nameProperty: 'name',
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 13, fontWeight: 'bold' },
            itemStyle: { areaColor: '#B8463A', opacity: 0.6 },
          },
          itemStyle: {
            areaColor: '#F7F4ED',
            borderColor: '#DED9D0',
            borderWidth: 0.5,
          },
          data: mapData,
          ...(selectedProvince.length > 0 ? {
            selectedMode: 'single' as const,
            selected: { [region!]: true },
          } : {}),
        },
      ],
    }
  }, [data, region, geoLoaded, maxVal])

  const onEvents = useMemo(() => ({
    click: (params: any) => {
      if (params.componentType === 'series' && params.seriesType === 'map' && params.name) {
        const rd = data.find(d => d.name === params.name)
        if (rd) {
          setRegion(region === params.name ? null : params.name)
        }
      }
    },
  }), [data, region, setRegion])

  if (!geoLoaded) {
    return (
      <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
        加载地图...
      </div>
    )
  }

  if (chinaGeo) {
    try { (window as any).echarts?.registerMap?.('china', chinaGeo) } catch { /* ignore */ }
  }

  if (!data.length) {
    return (
      <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="暂无地域数据" />
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 360, width: '100%' }}
      onEvents={onEvents}
      notMerge
    />
  )
}
