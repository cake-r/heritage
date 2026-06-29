import { useMemo } from 'react'
import { getCategoryColor } from '../../utils/categoryColors'
import type { OverviewData, ItemNode } from '../../services/knowledgeGraph'

export interface SunburstNode {
  name: string
  value?: number
  itemStyle?: { color: string; opacity?: number }
  label?: { show: boolean; fontSize?: number }
  children?: SunburstNode[]
  _itemId?: number
  _itemData?: ItemNode
  _techniqueName?: string
  _tooltip?: Record<string, any>
}

interface SunburstResult {
  sunburstData: SunburstNode | null
  /** Flat list of category names with counts for sidebar */
  categoryList: { name: string; count: number }[]
  /** Deduplicated technique names for sidebar tag cloud */
  techniqueList: { name: string; count: number; primaryCategory: string }[]
}

/**
 * Transform flat API data into ECharts sunburst hierarchical data.
 *
 * @param overview  - from getOverview() (categories + all_techniques)
 * @param items     - ItemNode[] from getItems({}) (all 50 heritage items)
 * @param drilledCategory - current drill-down category (for potential highlight)
 */
export function useSunburstData(
  overview: OverviewData | null,
  items: ItemNode[] | null,
): SunburstResult {
  return useMemo(() => {
    if (!overview || !items) {
      return { sunburstData: null, categoryList: [], techniqueList: [] }
    }

    // Build technique frequency map from items
    const techFreq = new Map<string, { count: number; primaryCategory: string }>()
    const itemsByCategory = new Map<string, ItemNode[]>()

    for (const item of items) {
      // Group items by category
      const catItems = itemsByCategory.get(item.category) || []
      catItems.push(item)
      itemsByCategory.set(item.category, catItems)

      // Count technique usage
      for (const tech of item.techniques) {
        const existing = techFreq.get(tech)
        if (existing) {
          existing.count++
        } else {
          techFreq.set(tech, { count: 1, primaryCategory: item.category })
        }
      }
    }

    // Build children (categories) for the root node
    const categoryChildren: SunburstNode[] = []

    for (const cat of overview.categories) {
      const catItems = itemsByCategory.get(cat.name) || []
      const catColor = getCategoryColor(cat.name)

      // Build item children for this category
      const itemChildren: SunburstNode[] = catItems.map(item => {
        // Build technique children for this item
        const techChildren: SunburstNode[] = (item.techniques || []).map(techName => ({
          name: techName,
          value: 1,
          itemStyle: { color: catColor, opacity: 0.7 },
          label: { show: false },
          _techniqueName: techName,
        }))

        return {
          name: item.name,
          value: Math.max(1, item.techniques.length),
          itemStyle: { color: catColor },
          label: { show: false },
          children: techChildren,
          _itemId: item.id,
          _itemData: item,
          _tooltip: {
            category: item.category,
            region: item.region,
            era: item.era,
            techniqueCount: item.techniques.length,
          },
        }
      })

      const catNode: SunburstNode = {
        name: cat.name,
        value: catItems.length > 0 ? cat.item_count : 0,
        itemStyle: {
          color: catColor,
          opacity: catItems.length > 0 ? 1 : 0.2,
        },
        label: { show: true, fontSize: 12 },
        children: itemChildren,
        _tooltip: {
          item_count: cat.item_count,
          region_count: cat.region_count,
          era_range: cat.era_range?.join('、') || '',
          technique_count: cat.technique_count,
          filtered_count: catItems.length,
        },
      }

      categoryChildren.push(catNode)
    }

    // Root node
    const sunburstData: SunburstNode = {
      name: '非遗文化',
      children: categoryChildren,
    }

    // Build sidebar data
    const categoryList = overview.categories.map(c => ({
      name: c.name,
      count: itemsByCategory.get(c.name)?.length || 0,
    }))

    // Top 30 techniques by frequency
    const techniqueList = Array.from(techFreq.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 30)
      .map(([name, info]) => ({
        name,
        count: info.count,
        primaryCategory: info.primaryCategory,
      }))

    return { sunburstData, categoryList, techniqueList }
  }, [overview, items])
}
