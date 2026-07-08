import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, Spin, Empty, Button, message, Alert, Drawer } from 'antd'
import { RefreshCw, Info, GitGraph } from 'lucide-react'
import * as echarts from 'echarts'
import { FilterProvider, useFilters } from './knowledge-graph/FilterContext'
import GraphBanner from './knowledge-graph/GraphBanner'
import SunburstChart from './knowledge-graph/SunburstChart'
import TimelineChart, { PERIOD_TO_ERAS } from './knowledge-graph/TimelineChart'
import ChoroplethMap from './knowledge-graph/ChoroplethMap'
import CategorySidebar from './knowledge-graph/CategorySidebar'
import ProvinceDetailPanel from './knowledge-graph/ProvinceDetailPanel'
import ItemDetailDrawer from './knowledge-graph/ItemDetailDrawer'
import TechniquePanel from './knowledge-graph/TechniquePanel'
import EraContextPanel from './knowledge-graph/EraContextPanel'
import KinshipGraph from './knowledge-graph/KinshipGraph'
import { useSunburstData } from './knowledge-graph/useSunburstData'
import {
  getOverview, getItems, getRegions, getTimeline,
  getTechniqueDetail, getRelatedItems,
  type OverviewData, type ItemsData, type RegionData,
  type TimelineItem, type TechniqueDetail, type RelatedItems,
} from '../services/knowledgeGraph'
import { useAuth } from '../contexts/AuthContext'
import { addFavorite, deleteFavorite, listFavorites } from '../services/user'
import { trackRegionVisit } from '../services/passport'
import { StarChartPattern } from '../components/decoration'

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
  const [kinshipOpen, setKinshipOpen] = useState(false)

  // 首次访问操作提示
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem('kg_guide_shown') !== '1'
  })

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
      // era 可能是分期名（如"明清"）或具体朝代名（如"明"）
      const eraSet = PERIOD_TO_ERAS[era] || [era]
      nodes = nodes.filter(n => eraSet.some(e => n.era?.includes(e)))
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

  // ========== Track Region Visit ==========
  useEffect(() => {
    if (region) {
      trackRegionVisit(region).catch(() => {})
    }
  }, [region])

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
        <Button icon={<RefreshCw />} onClick={() => window.location.reload()}>重试</Button>
      </Empty>
    )
  }

  // ========== Render ==========
  const showRightPanel = region !== null || era !== null
  const filteredRegionData = region ? regions.find(r => r.name === region) : undefined

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <StarChartPattern opacity={0.22} />
      </div>
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
      {/* Banner */}
      <div style={{ marginBottom: 16 }}>
        <GraphBanner drilledCategory={drilledCategory} />
      </div>

      {/* 首次访问操作提示 */}
      {showGuide && (
        <Alert
          message="💡 操作提示"
          description={
            <span>
              点击<strong>左侧品类</strong>筛选分类 · 点击<strong>旭日图</strong>深入探索 · 点击<strong>地图省份</strong>查看该省非遗分布 · 点击<strong>时间轴柱子</strong>筛选朝代
            </span>
          }
          type="info"
          closable
          onClose={() => { setShowGuide(false); localStorage.setItem('kg_guide_shown', '1') }}
          style={{
            marginBottom: 16,
            borderRadius: 8,
            background: 'var(--color-bg-active, #FFF3E0)',
            border: '1px solid var(--color-gold-light, #E8D5B0)',
          }}
        />
      )}

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
          title={
            <span style={{ fontFamily: 'var(--font-display)', letterSpacing: 2, fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
              {drilledCategory ? `📊 ${drilledCategory}` : '☀️ 品类 · 项目 · 技法'}
            </span>
          }
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-light)',
            boxShadow: 'none',
            background: 'var(--color-paper-white)',
          }}
          styles={{ body: { padding: 16 } }}
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

        {/* Right: Province Detail Panel + Era Context Panel (conditional) */}
        {showRightPanel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
            {region && (
              <ProvinceDetailPanel
                province={region!}
                regionData={filteredRegionData}
                items={filteredItems?.nodes || []}
                onItemClick={handleItemClick}
              />
            )}
            {era && <EraContextPanel era={era} />}
          </div>
        )}
      </div>

      {/* Bottom: Timeline + Map */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        marginBottom: 24,
      }}>
        <Card
          title={
            <span style={{ fontFamily: 'var(--font-display)', letterSpacing: 2, fontSize: 20, color: 'var(--color-ink)' }}>
              ☀️ 时间脉络
            </span>
          }
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-light)',
            boxShadow: 'none',
            background: 'var(--color-paper-white)',
          }}
          styles={{ body: { padding: '8px 4px' } }}
        >
          <TimelineChart
            timelineData={timeline}
            activeCategory={drilledCategory}
          />
        </Card>
        <Card
          title={
            <span style={{ fontFamily: 'var(--font-display)', letterSpacing: 2, fontSize: 20, color: 'var(--color-ink)' }}>
              🏛 地域分布
            </span>
          }
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-light)',
            boxShadow: 'none',
            background: 'var(--color-paper-white)',
          }}
          styles={{ body: { padding: 8 } }}
        >
          <ChoroplethMap
            data={regions}
            allItems={allItems?.nodes || []}
            activeCategory={drilledCategory}
          />
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

      {/* Kinship Graph Button */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <Button
          icon={<GitGraph />}
          type="dashed"
          onClick={() => setKinshipOpen(true)}
          style={{
            borderColor: 'var(--color-gold, #C4A265)',
            color: 'var(--color-ink, #2C241A)',
          }}
        >
          技艺亲缘关系图
        </Button>
      </div>

      {/* Kinship Graph Drawer */}
      <Drawer
        open={kinshipOpen}
        onClose={() => setKinshipOpen(false)}
        width={800}
        title="🔗 技艺亲缘关系图"
        styles={{ body: { padding: 16 } }}
      >
        <KinshipGraph
          data={allItems}
          onNodeClick={(id) => { setKinshipOpen(false); handleItemClick(id) }}
          height={520}
        />
      </Drawer>
    </div>
    </>
  )
}
