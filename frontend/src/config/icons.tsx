/**
 * 统一图标映射系统
 *
 * 将后端 JSON 配置中的 icon 名称字符串 或 前端遗留 emoji 映射为 lucide-react 组件。
 * 所有页面/组件通过此文件获取图标，确保视觉风格统一（线性图标 + 国风色值）。
 *
 * 用法：
 * - JSX:  <Icon name="search" size={18} color="var(--color-gold)" />
 * - 字符串: getIconName('🔍') → 'search'
 * - 组件引用: ICON_MAP.search  → <Search />
 */

import React from 'react'
import {
  Search,
  Palette,
  MessageCircle,
  Wrench,
  ScrollText,
  Landmark,
  BookOpen,
  Map,
  Star,
  Hammer,
  Microscope,
  Bell,
  User,
  RefreshCw,
  Pin,
  Target,
  Flame,
  Scissors,
  ImageIcon,
  Link,
  Camera,
  ClipboardList,
  GraduationCap,
  Hourglass,
  Calendar,
  MapPin,
  Trash2,
  Lock,
  Scale,
  Sun,
  Leaf,
  PenLine,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  PartyPopper,
  ArrowUp,
  SkipForward,
  Medal,
  Gem,
  Crown,
  Trophy,
  Bot,
  Compass,
  Drama,
  Eye,
  Globe,
  BarChart3,
  TrendingUp,
  FileText,
  Puzzle,
  Sparkles,
  Music,
  Pill,
  Rocket,
  GitBranch,
  Grid3x3,
  Droplet,
  Ruler,
  PenTool,
  type LucideIcon,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// 自定义 SVG 图标（lucide 无对应）
// ═══════════════════════════════════════════════════════════════

/** 灯笼图标 — 中国文化核心符号，用于 Logo/标题/向导 */
export const LanternIcon: React.FC<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }> = ({
  size = 24, color = 'currentColor', className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    {/* 提线 */}
    <line x1="12" y1="2" x2="12" y2="4" />
    {/* 上盖 */}
    <rect x="7" y="4" width="10" height="1.5" rx="0.75" />
    {/* 灯笼体 — 椭圆 */}
    <ellipse cx="12" cy="13" rx="6" ry="7.5" />
    {/* 骨架竖线 */}
    <line x1="12" y1="5.5" x2="12" y2="20.5" />
    {/* 横肋上 */}
    <path d="M6.5 9.5 Q12 7.5 17.5 9.5" />
    {/* 横肋下 */}
    <path d="M6.5 16.5 Q12 18.5 17.5 16.5" />
    {/* 底部花托 */}
    <rect x="7" y="20.5" width="10" height="1.5" rx="0.75" />
    {/* 流苏 */}
    <line x1="12" y1="22" x2="12" y2="23" />
    <path d="M9 22.5 L12 23 L15 22.5" />
  </svg>
)

/** 刺绣针线图标 — 苏绣/湘绣/蜀绣/粤绣标识 */
export const EmbroideryIcon: React.FC<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }> = ({
  size = 24, color = 'currentColor', className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" className={className} style={className}>
    {/* 针 */}
    <line x1="16" y1="3" x2="8" y2="14" />
    {/* 针眼 */}
    <path d="M15 3.5 Q16 2.5 16.5 3 Q17 3.5 15.5 4.5" />
    {/* 线 — S 曲线 */}
    <path d="M8 14 Q4 12 5 9 Q6 6 10 8 Q14 10 13 14 Q12 18 9 21" />
  </svg>
)

/** 漆器瓶图标 — 漆器/陶艺标识 */
export const LacquerIcon: React.FC<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }> = ({
  size = 24, color = 'currentColor', className, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    {/* 瓶颈 */}
    <path d="M9 4 L9 7 Q9 8 10 8 L14 8 Q15 8 15 7 L15 4" />
    {/* 瓶身 */}
    <path d="M6 9 Q5 6 7 5 L17 5 Q19 6 18 9 L16 18 Q15 21 12 21 Q9 21 8 18 Z" />
    {/* 底足 */}
    <line x1="8" y1="21" x2="16" y2="21" />
  </svg>
)

// ═══════════════════════════════════════════════════════════════
// 图标名称 → 组件 映射表
// ═══════════════════════════════════════════════════════════════

export const ICON_MAP: Record<string, LucideIcon | React.FC<any>> = {
  // ── 通用操作 ──
  search: Search,
  palette: Palette,
  'message-circle': MessageCircle,
  wrench: Wrench,
  'scroll-text': ScrollText,
  landmark: Landmark,
  'book-open': BookOpen,
  map: Map,
  star: Star,
  hammer: Hammer,
  microscope: Microscope,
  bell: Bell,
  user: User,
  'refresh-cw': RefreshCw,
  pin: Pin,
  target: Target,
  flame: Flame,
  scissors: Scissors,
  image: ImageIcon,
  link: Link,
  camera: Camera,
  'clipboard-list': ClipboardList,
  'graduation-cap': GraduationCap,
  hourglass: Hourglass,
  calendar: Calendar,
  'map-pin': MapPin,
  'trash-2': Trash2,
  lock: Lock,
  scale: Scale,
  sun: Sun,
  leaf: Leaf,
  'pen-line': PenLine,

  // ── 状态反馈 ──
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'alert-triangle': AlertTriangle,
  lightbulb: Lightbulb,
  'party-popper': PartyPopper,
  'arrow-up': ArrowUp,
  'skip-forward': SkipForward,

  // ── 段位/排名 ──
  medal: Medal,
  gem: Gem,
  crown: Crown,
  trophy: Trophy,

  // ── AI / 伴游 ──
  bot: Bot,
  compass: Compass,
  drama: Drama,
  eye: Eye,
  globe: Globe,

  // ── 数据/文档 ──
  'bar-chart-3': BarChart3,
  'trending-up': TrendingUp,
  'file-text': FileText,
  puzzle: Puzzle,
  sparkles: Sparkles,
  music: Music,
  pill: Pill,
  rocket: Rocket,
  'git-branch': GitBranch,
  'grid-3x3': Grid3x3,
  droplet: Droplet,
  ruler: Ruler,
  'pen-tool': PenTool,

  // ── 自定义 ──
  lantern: LanternIcon,
  embroidery: EmbroideryIcon,
  lacquer: LacquerIcon,
}

// ═══════════════════════════════════════════════════════════════
// Emoji → icon name 迁移映射（前端遗留兼容）
// ═══════════════════════════════════════════════════════════════

export const EMOJI_TO_ICON_NAME: Record<string, string> = {
  '🔍': 'search',
  '🎨': 'palette',
  '💬': 'message-circle',
  '🛠️': 'wrench',
  '📜': 'scroll-text',
  '🏛️': 'landmark',
  '📚': 'book-open',
  '🗺️': 'map',
  '⭐': 'star',
  '⚒️': 'hammer',
  '🔬': 'microscope',
  '📖': 'book-open',
  '🔔': 'bell',
  '👤': 'user',
  '🔄': 'refresh-cw',
  '📌': 'pin',
  '🎯': 'target',
  '🔥': 'flame',
  '✂️': 'scissors',
  '🖼️': 'image',
  '🔗': 'link',
  '📷': 'camera',
  '📋': 'clipboard-list',
  '🔧': 'wrench',
  '🎓': 'graduation-cap',
  '⏳': 'hourglass',
  '📅': 'calendar',
  '📍': 'map-pin',
  '🗑️': 'trash-2',
  '🔒': 'lock',
  '⚖️': 'scale',
  '☀️': 'sun',
  '🌿': 'leaf',
  '🖊️': 'pen-line',
  '✅': 'check-circle',
  '❌': 'x-circle',
  '⚠️': 'alert-triangle',
  '💡': 'lightbulb',
  '✨': 'sparkles',
  '🎉': 'party-popper',
  '⬆️': 'arrow-up',
  '⏭️': 'skip-forward',
  '🥉': 'medal',
  '🥈': 'medal',
  '🥇': 'medal',
  '💎': 'gem',
  '👑': 'crown',
  '🏆': 'trophy',
  '🤖': 'bot',
  '🧭': 'compass',
  '🎭': 'drama',
  '👁️': 'eye',
  '🌏': 'globe',
  '📊': 'bar-chart-3',
  '📈': 'trending-up',
  '📝': 'file-text',
  '🧩': 'puzzle',
  '🌟': 'sparkles',
  '🎵': 'music',
  '🎶': 'music',
  '💊': 'pill',
  '🚀': 'rocket',
  '🧬': 'git-branch',
  '🔪': 'pen-tool',
  '💧': 'droplet',
  '📐': 'ruler',
  '🏺': 'flame',
  '🧶': 'grid-3x3',
  '🏮': 'lantern',
  '🧵': 'embroidery',
  '🪔': 'lacquer',
  '🏅': 'medal',
  '🏭': 'landmark',
  '🔮': 'sparkles',
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** 根据名称获取图标组件 */
export function getIcon(name: string): LucideIcon | React.FC<any> | null {
  // 先查直接名称
  if (ICON_MAP[name]) return ICON_MAP[name]
  // 再查 emoji 映射
  if (EMOJI_TO_ICON_NAME[name]) return ICON_MAP[EMOJI_TO_ICON_NAME[name]]
  return null
}

/** emoji → icon name，未知时返回原值 */
export function resolveIconName(raw: string): string {
  return EMOJI_TO_ICON_NAME[raw] || raw
}

// ═══════════════════════════════════════════════════════════════
// 便捷图标组件（统一 size=18 color=currentColor 默认值）
// ═══════════════════════════════════════════════════════════════

interface IconProps {
  name: string
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

/** 统一图标渲染组件 — 根据名称字符串渲染对应 lucide/自定义图标 */
export const Icon: React.FC<IconProps> = ({ name, size = 18, color, className, style }) => {
  const resolved = resolveIconName(name)
  const Component = ICON_MAP[resolved]
  if (!Component) {
    // fallback: 显示原始文本
    return <span style={{ fontSize: size, ...style }} className={className}>{name}</span>
  }
  return <Component size={size} color={color} className={className} style={style} />
}

// ═══════════════════════════════════════════════════════════════
// 段位图标辅助
// ═══════════════════════════════════════════════════════════════

/** 段位索引 → 图标组件 + 色值。0=铜 1=银 2=金 3=钻石 4=皇冠 */
export const RANK_ICON_CONFIG: Array<{ icon: LucideIcon | React.FC<any>; color: string }> = [
  { icon: Medal, color: '#CD7F32' },   // 铜
  { icon: Medal, color: '#A8A8A8' },   // 银
  { icon: Medal, color: '#C4A265' },   // 金（鎏金）
  { icon: Gem, color: '#7B68EE' },     // 钻石
  { icon: Crown, color: '#C4A265' },   // 皇冠
]
