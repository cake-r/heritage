/**
 * ECharts 主题常量 — 集中管理所有硬编码色值。
 * ECharts Canvas 不支持 CSS 变量，必须使用固定 hex。
 * 与 tokens.css 保持同步。
 */

// === 核心品牌色 ===
export const VERMILION = '#B8463A'
export const VERMILION_HOVER = '#9A2F25'
export const GOLD = '#C4A265'
export const GOLD_LIGHT = '#E8D5B0'
export const INK = '#2C241A'
export const INK_SECONDARY = '#6B5F52'

// === 底色系统 ===
export const PAPER = '#F7F4ED'
export const PAPER_WHITE = '#FFFDF9'
export const DEEP = '#1E1B18'
export const DEEP_LIGHT = '#2A2520'

// === 语义色 ===
export const SUCCESS = '#4A8C5C'
export const ERROR = '#C5533B'
export const INFO = '#5B7FA0'
export const WARNING = '#C49A3C'

// === 交互态背景 ===
export const BG_ACTIVE = '#FFF3E0'
export const BG_HOVER = '#F5F5F0'
export const BORDER_LIGHT = '#E8E4D8'
export const BORDER_MEDIUM = '#D5CFC0'

// === 中性色阶 ===
export const GRAY_900 = '#1E1B18'
export const GRAY_700 = '#4A4540'
export const GRAY_500 = '#8A8378'
export const GRAY_300 = '#C4BEB4'
export const GRAY_200 = '#DED9D0'
export const GRAY_100 = '#EDE9E0'
export const GRAY_50 = '#F7F4ED'

// === 暗色模式 ===
export const DARK_PAPER = '#161310'
export const DARK_PAPER_WHITE = '#201C18'
export const DARK_DEEP = '#0F0D0B'
export const DARK_INK = '#E8E2D8'
export const DARK_INK_SECONDARY = '#A09888'
export const DARK_VERMILION = '#C96B5F'

// === 19品类色板 ===
export const CATEGORY_COLORS: Record<string, string> = {
  '传统音乐': '#B8463A',
  '传统舞蹈': '#C96B5F',
  '传统戏剧': '#D4847A',
  '曲艺': '#C4A265',
  '传统体育/游艺/杂技': '#5B7FA0',
  '传统美术': '#4A8C5C',
  '传统技艺': '#C49A3C',
  '传统医药': '#6B5F52',
  '民俗': '#8A8378',
  '民间文学': '#2C241A',
  '传统手工技艺': '#A09888',
  '传统建筑营造技艺': '#5A5248',
  '传统饮食制作技艺': '#C4BEB4',
  '传统礼仪/节庆': '#4A4540',
  '民间信仰': '#B8B0A0',
  '传统游艺': '#8A8278',
  '传统知识': '#D5CFC0',
  '传统历法': '#EDE9E0',
  '其他': '#3A3530',
}

// === 暗色模式品类色板 ===
export const CATEGORY_COLORS_DARK: Record<string, string> = {
  '传统音乐': '#C96B5F',
  '传统舞蹈': '#D4847A',
  '传统戏剧': '#E09E95',
  '曲艺': '#D4B875',
  '传统体育/游艺/杂技': '#7BA0C0',
  '传统美术': '#6AAC7C',
  '传统技艺': '#D4AA4C',
  '传统医药': '#8B7F72',
  '民俗': '#AAA298',
  '民间文学': '#E8E2D8',
  '传统手工技艺': '#B8B0A0',
  '传统建筑营造技艺': '#7A7268',
  '传统饮食制作技艺': '#D4CEC4',
  '传统礼仪/节庆': '#6A6560',
  '民间信仰': '#C8C0B0',
  '传统游艺': '#A29888',
  '传统知识': '#E5DFD0',
  '传统历法': '#F7F4EA',
  '其他': '#5A5550',
}

/**
 * 获取当前主题的品类色板。
 * @param isDark - 是否暗色模式
 */
export function getCategoryColors(isDark: boolean): Record<string, string> {
  return isDark ? CATEGORY_COLORS_DARK : CATEGORY_COLORS
}

/**
 * hex → rgb 字符串（用于 rgba() 组合）。
 * 例: '#B8463A' → '184, 70, 58'
 */
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0, 0, 0'
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}
