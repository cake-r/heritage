/**
 * KinshipGraph — 技艺亲缘桑基图
 *
 * 三列流：品类 → 技艺 → 地域
 * 展示非遗品类之间通过共享技法形成的亲缘关联，以及技法在地域间的流动分布。
 * ECharts Sankey，force-directed 的替代方案。
 */
import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Empty, Typography, Tag, Button } from 'antd'
import { GitBranch, RefreshCw } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { getCategoryColor } from '../../utils/categoryColors'
import {
  DARK_INK,
  DARK_INK_SECONDARY,
  GOLD,
  DARK_DEEP,
} from '../../styles/chart-theme'
import type { ItemsData } from '../../services/knowledgeGraph'

const { Text } = Typography

interface KinshipGraphProps {
  data: ItemsData | null
  onNodeClick?: (id: number) => void
  onRefresh?: () => void
  height?: number
}

// ─── 节点前缀（保证 Sankey 节点名唯一） ───
const CAT_PREFIX = '品类:'
const TECH_PREFIX = '技法:'
const REG_PREFIX = '地域:'

export default function KinshipGraph({ data, onNodeClick, onRefresh, height }: KinshipGraphProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    onRefresh?.()
    setTimeout(() => setRefreshing(false), 800)
  }

  // ─── 数据聚合：ItemsData → Sankey nodes/links ───
  const { sankeyNodes, sankeyLinks, stats } = useMemo(() => {
    if (!data || data.nodes.length === 0) {
      return { sankeyNodes: [], sankeyLinks: [], stats: { catCount: 0, techCount: 0, regCount: 0, linkCount: 0 } }
    }

    // 构建 id → node 快速查找
    const nodeMap = new Map<number, typeof data.nodes[number]>()
    data.nodes.forEach(n => nodeMap.set(n.id, n))

    // 聚合计数器
    const catToTech: Record<string, Record<string, number>> = {}   // category → { technique → count }
    const techToReg: Record<string, Record<string, number>> = {}   // technique → { region → count }

    for (const link of data.links) {
      const sourceNode = nodeMap.get(link.source)
      const targetNode = nodeMap.get(link.target)
      if (!sourceNode || !targetNode) continue

      const tech = link.shared_value || link.relation
      if (!tech) continue

      // Category → Technique (from source & target)
      for (const cat of [sourceNode.category, targetNode.category]) {
        if (!cat) continue
        if (!catToTech[cat]) catToTech[cat] = {}
        catToTech[cat][tech] = (catToTech[cat][tech] || 0) + 1
      }

      // Technique → Region (from source & target)
      for (const reg of [sourceNode.region, targetNode.region]) {
        if (!reg) continue
        if (!techToReg[tech]) techToReg[tech] = {}
        techToReg[tech][reg] = (techToReg[tech][reg] || 0) + 1
      }
    }

    // 收集唯一节点
    const catSet = new Set(Object.keys(catToTech))
    const techSet = new Set<string>()
    Object.keys(catToTech).forEach(c => Object.keys(catToTech[c]).forEach(t => techSet.add(t)))

    // 只保留有流向地域的技艺
    const activeTechSet = new Set(Object.keys(techToReg))
    techSet.forEach(t => { if (!activeTechSet.has(t)) techSet.delete(t) })

    // 过滤掉连接数为 0 的品类
    const activeCatSet = new Set<string>()
    catSet.forEach(c => {
      const techs = catToTech[c] || {}
      let hasFlow = false
      Object.keys(techs).forEach(t => {
        if (activeTechSet.has(t)) hasFlow = true
      })
      if (hasFlow) activeCatSet.add(c)
    })

    const regSet = new Set<string>()
    Object.keys(techToReg).forEach(t => {
      Object.keys(techToReg[t]).forEach(r => regSet.add(r))
    })

    // 构建 Sankey 节点（按关联总量排序，限制数量防重叠）
    const MAX_PER_COL = 12
    const sortedCats = [...activeCatSet]
      .sort((a, b) => {
        const sumA = Object.values(catToTech[a] || {}).reduce((s, v) => s + v, 0)
        const sumB = Object.values(catToTech[b] || {}).reduce((s, v) => s + v, 0)
        return sumB - sumA
      })
      .slice(0, MAX_PER_COL)
    const sortedTechs = [...activeTechSet]
      .sort((a, b) => {
        const sumA = Object.values(techToReg[a] || {}).reduce((s, v) => s + v, 0)
        const sumB = Object.values(techToReg[b] || {}).reduce((s, v) => s + v, 0)
        return sumB - sumA
      })
      .slice(0, MAX_PER_COL)
    const sortedRegs = [...regSet]
      .sort((a, b) => {
        const sumA = [...sortedTechs].reduce((s, t) => s + (techToReg[t]?.[a] || 0), 0)
        const sumB = [...sortedTechs].reduce((s, t) => s + (techToReg[t]?.[b] || 0), 0)
        return sumB - sumA
      })
      .slice(0, MAX_PER_COL)

    const sankeyNodes = [
      ...sortedCats.map(c => ({ name: CAT_PREFIX + c, label: c, depth: 0 })),
      ...sortedTechs.map(t => ({ name: TECH_PREFIX + t, label: t, depth: 1 })),
      ...sortedRegs.map(r => ({ name: REG_PREFIX + r, label: r, depth: 2 })),
    ]

    // 构建 Sankey links
    const sankeyLinks: { source: string; target: string; value: number }[] = []

    sortedCats.forEach(c => {
      sortedTechs.forEach(t => {
        const v = catToTech[c]?.[t] || 0
        if (v > 0) {
          sankeyLinks.push({
            source: CAT_PREFIX + c,
            target: TECH_PREFIX + t,
            value: v,
          })
        }
      })
    })

    sortedTechs.forEach(t => {
      sortedRegs.forEach(r => {
        const v = techToReg[t]?.[r] || 0
        if (v > 0) {
          sankeyLinks.push({
            source: TECH_PREFIX + t,
            target: REG_PREFIX + r,
            value: v,
          })
        }
      })
    })

    return {
      sankeyNodes,
      sankeyLinks,
      stats: {
        catCount: sortedCats.length,
        techCount: sortedTechs.length,
        regCount: sortedRegs.length,
        linkCount: sankeyLinks.length,
      },
    }
  }, [data])

  // ─── ECharts option ───
  const option = useMemo(() => {
    if (sankeyNodes.length === 0) return null

    const ink = isDark ? DARK_INK : '#2C241A'
    const bgColor = isDark ? DARK_DEEP : '#fffdf9'

    // 颜色函数
    const nodeColor = (name: string): string => {
      if (name.startsWith(CAT_PREFIX)) {
        return getCategoryColor(name.slice(CAT_PREFIX.length), isDark)
      }
      if (name.startsWith(TECH_PREFIX)) {
        return GOLD
      }
      // Region nodes
      return isDark ? '#8A8278' : '#6B5F52'
    }

    return {
      backgroundColor: bgColor,
      series: [{
        type: 'sankey',
        top: 8,
        bottom: 8,
        layoutIterations: 32,    // 优化节点垂直间距，减少重叠
        emphasis: {
          focus: 'adjacency',
        },
        nodeAlign: 'justify',
        nodeWidth: 32,
        nodeGap: 22,
        data: sankeyNodes.map(n => ({
          name: n.name,
          itemStyle: {
            color: nodeColor(n.name),
            borderColor: 'transparent',
            borderRadius: 4,
          },
          label: {
            show: true,
            position: n.depth === 0 ? 'left' : n.depth === 1 ? 'inside' : 'right',
            formatter: (p: any) => {
              const label = (p.name || '').replace(CAT_PREFIX, '').replace(TECH_PREFIX, '').replace(REG_PREFIX, '')
              return label.length > 8 ? label.slice(0, 7) + '…' : label
            },
            fontSize: 16,
            color: n.depth === 1 ? (isDark ? '#1A1510' : '#2C241A') : ink,
            fontWeight: n.depth === 0 ? 600 : n.depth === 1 ? 500 : 'normal',
            distance: n.depth === 1 ? 0 : 10,
          },
        })),
        links: sankeyLinks.map(l => ({
          source: l.source,
          target: l.target,
          value: l.value,
        })),
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.45,
        },
        tooltip: {
          formatter: (p: any) => {
            if (p.dataType === 'node') {
              const label = (p.name || '').replace(CAT_PREFIX, '').replace(TECH_PREFIX, '').replace(REG_PREFIX, '')
              const depth = sankeyNodes.find(n => n.name === p.name)?.depth
              const typeLabel = depth === 0 ? '品类' : depth === 1 ? '技艺' : '地域'
              return `<strong>${label}</strong><br/><span style="color:#999">${typeLabel}</span>`
            }
            if (p.dataType === 'edge') {
              const src = (p.data.source || '').replace(CAT_PREFIX, '').replace(TECH_PREFIX, '').replace(REG_PREFIX, '')
              const tgt = (p.data.target || '').replace(CAT_PREFIX, '').replace(TECH_PREFIX, '').replace(REG_PREFIX, '')
              return `<strong>${src}</strong> → <strong>${tgt}</strong><br/>关联强度: ${p.data.value}`
            }
            return ''
          },
        },
      }],
    }
  }, [sankeyNodes, sankeyLinks, isDark])

  // ─── 空态 ───
  if (!option) {
    return <Empty description="暂无亲缘关联数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  // ─── 节点点击（仅品类节点支持回跳） ───
  const handleClick = (params: any) => {
    if (params.dataType === 'node' && onNodeClick && params.name?.startsWith(CAT_PREFIX)) {
      // 品类节点：查找该品类下的任意一个 item id 供跳转
      const catName = (params.name as string).slice(CAT_PREFIX.length)
      const item = data?.nodes?.find(n => n.category === catName)
      if (item) onNodeClick(item.id)
    }
  }

  return (
    <div style={{ height: height || 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* 标题栏 + 图例 */}
      <div style={{ flexShrink: 0, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text strong style={{ fontSize: 20, color: isDark ? DARK_INK : '#2C241A' }}>
            <GitBranch size={22} style={{ marginRight: 6, verticalAlign: -4 }} />
            技艺亲缘桑基图
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color="gold" style={{ fontSize: 14, padding: '2px 10px' }}>
              {stats.catCount} 品类 · {stats.techCount} 技艺 · {stats.regCount} 地域
            </Tag>
            {onRefresh && (
              <Button
                type="text"
                size="small"
                icon={<RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />}
                onClick={handleRefresh}
                style={{ color: isDark ? '#A09888' : '#8A8378' }}
              />
            )}
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 20, flexWrap: 'wrap',
          fontSize: 15, color: isDark ? DARK_INK_SECONDARY : '#6B5F52',
        }}>
          <span>
            <span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: 3,
              background: getCategoryColor('刺绣', isDark), marginRight: 5 }} />
            品类
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: 3,
              background: GOLD, marginRight: 5 }} />
            共享技艺
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: 3,
              background: isDark ? '#8A8278' : '#6B5F52', marginRight: 5 }} />
            地域
          </span>
        </div>
      </div>

      {/* 图表 — flex:1 填满剩余空间 */}
      <ReactECharts
        option={option}
        onEvents={{ click: handleClick }}
        style={{ flex: 1, minHeight: 0, width: '100%' }}
        notMerge
      />

      {/* 操作提示 */}
      <Text type="secondary" style={{ flexShrink: 0, fontSize: 14, textAlign: 'center', paddingTop: 6 }}>
        悬停高亮关联流 · 点击品类跳转详情
      </Text>
    </div>
  )
}
