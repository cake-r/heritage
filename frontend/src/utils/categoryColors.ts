/** 非遗品类完整色板 — 19 品类 */
export const CATEGORY_COLORS: Record<string, string> = {
  '刺绣': '#C41E3A',
  '陶瓷': '#2B5F8A',
  '剪纸': '#E85D3A',
  '皮影': '#5B8A3C',
  '织锦': '#8A3C5B',
  '金属': '#B8860B',
  '漆器': '#8B0000',
  '竹编': '#6B8E23',
  '雕塑': '#708090',
  '泥塑': '#A0522D',
  '民间美术': '#D4738C',
  '戏曲': '#B4464B',
  '年画': '#E8313F',
  '蓝印花布': '#1E5B94',
  '紫砂': '#8B4513',
  '篆刻': '#4A3728',
  '唐三彩': '#E8B84B',
  '书法': '#2C2C2C',
  '其他': '#999999',
}

export const DEFAULT_CATEGORY_COLOR = '#999999'

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || DEFAULT_CATEGORY_COLOR
}

/** Convert hex color (#RGB or #RRGGBB) to "r, g, b" string for use in rgba() */
export function hexToRgb(hex: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}
