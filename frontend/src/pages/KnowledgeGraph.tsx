import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, Spin, Empty, Button, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import * as echarts from 'echarts'
import { FilterProvider, useFilters } from './knowledge-graph/FilterContext'
import GraphBanner from './knowledge-graph/GraphBanner'
import SunburstChart from './knowledge-graph/SunburstChart'
import TimelineScatter from './knowledge-graph/TimelineScatter'
import ChoroplethMap from './knowledge-graph/ChoroplethMap'
import CategorySidebar from './knowledge-graph/CategorySidebar'
import ProvinceDetailPanel from './knowledge-graph/ProvinceDetailPanel'
import ItemDetailDrawer from './knowledge-graph/ItemDetailDrawer'
import TechniquePanel from './knowledge-graph/TechniquePanel'
import { useSunburstData } from './knowledge-graph/useSunburstData'
import {
  getOverview, getItems, getRegions, getTimeline,
  getTechniqueDetail, getRelatedItems,
  type OverviewData, type ItemsData, type RegionData,
  type TimelineItem, type TechniqueDetail, type RelatedItems,
} from '../services/knowledgeGraph'
import { useAuth } from '../contexts/AuthContext'
import { addFavorite, deleteFavorite, listFavorites } from '../services/user'

// Register echarts globally for map registration
;(window as any).echarts = echarts

export default function KnowledgeGraphPage() {
  return (
    <FilterProvider>
      <KnowledgeGraph />
    </FilterProvider>
  )
}

function KnowledgeGraph() {
  const { isAuthenticated } = useAuth()
  const { region, era, drilledCategory, setDrilledCategory } = useFilters()

  // ========== Data State ==========
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [regions, setRegions] = useState<RegionData[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [allItems, setAllItems] = useState<ItemsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Technique + Item detail
  const [techniqueDetail, setTechniqueDetail] = useState<TechniqueDetail | null>(null)
  const [techLoading, setTechLoading] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Record<string, any> | null>(null)
  const [relatedItems, setRelatedItems] = useState<RelatedItems | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [techPanelOpen, setTechPanelOpen] = useState(false)
  const [favIds, setFavIds] = useState<Set<number>>(new Set())

  // ========== Load Data ==========
  useEffect(() => {
    setLoading(true)
    setError(false)
    Promise.all([getOverview(), getRegions(), getTimeline(), getItems({})])
      .then(([ov, rg, tl, items]) => {
        setOverview(ov)
        setRegions(rg)
        setTimeline(tl)
        setAllItems(items)
      })
      .catch(() => { setError(true); message.error('加载图谱数据失败') })
      .finally(() => setLoading(false))
  }, [])

  // ========== Client-side Filtering ==========
  const filteredItems = useMemo(() => {
    if (!allItems) return null
    let nodes = allItems.nodes
    if (region) {
      nodes = nodes.filter(n => n.region.includes(region))
    }
    if (era) {
      nodes = nodes.filter(n => n.era.includes(era))
    }
    return { ...allItems, nodes }
  }, [allItems, region, era])

  // ========== Sunburst Data ==========
  const { sunburstData, categoryList, techniqueList } = useSunburstData(
    overview,
    filteredItems?.nodes || null,
  )

  // ========== Load Favorites ==========
  useEffect(() => {
    if (isAuthenticated) {
      listFavorites()
        .then(favs => setFavIds(new Set(favs.filter(f => f.item_type === 'heritage').map(f => f.item_id))))
        .catch(() => {})
    }
  }, [isAuthenticated])

  // ========== Handlers ==========
  const handleCategoryClick = useCallback((catName: string) => {
    setDrilledCategory(catName || null)
  }, [setDrilledCategory])

  const handleBackToOverview = useCallback(() => {
    setDrilledCategory(null)
  }, [setDrilledCategory])

  const handleTechniqueClick = useCallback((techName: string) => {
    setTechLoading(true)
    setTechPanelOpen(true)
    getTechniqueDetail(techName)
      .then(setTechniqueDetail)
      .catch(() => message.error('加载技法详情失败'))
      .finally(() => setTechLoading(false))
  }, [])

  const handleItemClick = useCallback((id: number) => {
    getRelatedItems(id)
      .then(data => {
        setSelectedItem(data.item)
        setRelatedItems(data)
        setDrawerOpen(true)
      })
      .catch(() => message.error('加载项目详情失败'))
  }, [])

  const handleRelatedClick = useCallback((id: number) => {
    handleItemClick(id)
  }, [handleItemClick])

  const handleToggleFavorite = useCallback(async () => {
    if (!isAuthenticated || !selectedItem) { message.warning('请先登录'); return }
    try {
      if (favIds.has(selectedItem.id)) {
        const favs = await listFavorites()
        const target = favs.find(f => f.item_type === 'heritage' && f.item_id === selectedItem.id)
        if (target) await deleteFavorite(target.id)
        setFavIds(prev => { const n = new Set(prev); n.delete(selectedItem.id); return n })
        message.success('已取消收藏')
      } else {
        await addFavorite('heritage', selectedItem.id)
        setFavIds(prev => new Set(prev).add(selectedItem.id))
        message.success('已收藏')
      }
    } catch (err: any) {
      message.error(err.message || '操作失败')
    }
  }, [isAuthenticated, selectedItem, favIds])

  // ========== Render: Loading ==========
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" tip="加载文化图谱..." />
      </div>
    )
  }

  // ========== Render: Error ==========
  if (error) {
    return (
      <Empty description="加载失败" style={{ padding: 80 }}>
        <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>重试</Button>
      </Empty>
    )
  }

  // ========== Render ==========
  const showRightPanel = region !== null
  const filteredRegionData = region ? regions.find(r => r.name === region) : undefined

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', padding: '24px 16px' }}>
      {/* Banner */}
      <div style={{ marginBottom: 16 }}>
        <GraphBanner drilledCategory={drilledCategory} />
      </div>

      {/* Main content: Sidebar | Sunburst | ProvincePanel */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showRightPanel ? '240px 1fr 300px' : '240px 1fr',
        gap: 20,
        marginBottom: 24,
      }}>
        {/* Left Sidebar */}
        <CategorySidebar
          categories={overview?.categories || []}
          categoryList={categoryList}
          techniqueList={techniqueList}
          drilledCategory={drilledCategory}
          onCategoryClick={handleCategoryClick}
          onTechniqueClick={handleTechniqueClick}
        />

        {/* Center: Sunburst Chart */}
        <Card
          title={drilledCategory ? `📊 ${drilledCategory}` : '☀️ 品类 · 项目 · 技法'}
          bodyStyle={{ padding: 16 }}
          style={{ borderRadius: 12 }}
        >
          <SunburstChart
            data={sunburstData}
            drilledCategory={drilledCategory}
            onCategoryClick={handleCategoryClick}
            onBackToOverview={handleBackToOverview}
            onItemClick={handleItemClick}
            onTechniqueClick={handleTechniqueClick}
          />
        </Card>

        {/* Right: Province Detail Panel (conditional) */}
        {showRightPanel && (
          <ProvinceDetailPanel
            province={region!}
            regionData={filteredRegionData}
            items={filteredItems?.nodes || []}
            onItemClick={handleItemClick}
          />
        )}
      </div>

      {/* Bottom: Timeline + Map */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
      }}>
        <Card
          title="📅 时间脉络"
          bodyStyle={{ padding: '8px 4px' }}
          style={{ borderRadius: 12 }}
        >
          <TimelineScatter
            timelineData={timeline}
            allItems={allItems?.nodes || []}
          />
        </Card>
        <Card
          title="🗺 地域分布"
          bodyStyle={{ padding: 16 }}
          style={{ borderRadius: 12 }}
        >
          <ChoroplethMap data={regions} />
        </Card>
      </div>

      {/* Item Detail Drawer */}
      <ItemDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        item={selectedItem}
        related={relatedItems}
        onRelatedClick={handleRelatedClick}
        isFavorited={selectedItem ? favIds.has(selectedItem.id) : false}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Technique Panel */}
      <TechniquePanel
        open={techPanelOpen}
        onClose={() => setTechPanelOpen(false)}
        data={techniqueDetail}
        loading={techLoading}
        onItemClick={handleItemClick}
      />
    </div>
  )
}
