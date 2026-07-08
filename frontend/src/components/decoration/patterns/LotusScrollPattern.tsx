import { useMemo } from 'react'

interface LotusScrollPatternProps {
  opacity?: number
  color?: string
  accentColor?: string
  density?: number
}

/**
 * 缠枝莲纹 — 参考唐代卷草纹 + 明清缠枝莲
 *
 * 连绵不断的 S 形藤蔓上点缀莲花和卷叶，寓意"生生不息"
 * 带有手工感的不规则弧线，避免机械重复
 * 适合创作类页面
 */

function hash(i: number): number {
  let h = (i * 2654435761 + 99) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) / 4294967296
}

export default function LotusScrollPattern({
  opacity = 0.20,
  color = 'var(--color-ink-secondary)',
  accentColor = 'var(--color-vermilion)',
  density = 160,
}: LotusScrollPatternProps) {
  const patternId = 'lotus-scroll-pattern'
  const w = density * 2.5
  const h = density

  // 藤蔓 S 曲线控制点（带微扰动，避免完全重复）
  const vines = useMemo(() => {
    const result: { d: string; offsetY: number }[] = []
    const rows = 3
    for (let row = 0; row < rows; row++) {
      const baseY = (h * row) / rows + h / (rows * 2)
      const jitter = (hash(row) - 0.5) * 12
      const d = `M 0 ${baseY + jitter}
        C ${w * 0.25} ${baseY - h * 0.22 + jitter}, ${w * 0.35} ${baseY - h * 0.2 + jitter}, ${w * 0.5} ${baseY + jitter}
        C ${w * 0.65} ${baseY + h * 0.22 + jitter}, ${w * 0.75} ${baseY + h * 0.2 + jitter}, ${w} ${baseY + jitter}`
      result.push({ d, offsetY: baseY + jitter })
    }
    return result
  }, [w, h])

  // 莲花位置 — 在藤蔓波峰/波谷
  const lotuses = useMemo(() => {
    const result: { cx: number; cy: number; r: number }[] = []
    for (let i = 0; i < 8; i++) {
      result.push({
        cx: w * 0.12 + hash(i) * w * 0.76,
        cy: h * 0.1 + hash(i + 10) * h * 0.8,
        r: 3 + hash(i + 20) * 3,
      })
    }
    return result
  }, [w, h])

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      <defs>
        {/* 小莲花 — 四瓣或五瓣 */}
        <g id="lotus-flower-v2">
          {[0, 72, 144, 216, 288].map((angle, k) => (
            <ellipse
              key={k}
              cx="0" cy="-4"
              rx="2" ry="3.5"
              fill={accentColor}
              stroke="none"
              opacity="0.55"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle cx="0" cy="0" r="1.8" fill={color} stroke="none" opacity="0.5" />
        </g>
        {/* 卷叶 */}
        <g id="scroll-leaf-v2" stroke={color} fill="none" strokeLinecap="round">
          <path d="M 0 0 C 6 -5, 10 -3, 8 2 C 6 5, 2 4, 0 2" strokeWidth="0.9" opacity="0.5" />
        </g>

        <pattern id={patternId} x="0" y="0" width={w} height={h} patternUnits="userSpaceOnUse">
          {/* 藤蔓 */}
          {vines.map((vine, i) => (
            <path
              key={`vine-${i}`}
              d={vine.d}
              stroke={color}
              fill="none"
              strokeWidth="1.3"
              opacity="0.6"
              strokeLinecap="round"
            />
          ))}
          {/* 莲花 */}
          {lotuses.map((l, i) => (
            <use key={`lotus-${i}`} href="#lotus-flower-v2" x={l.cx} y={l.cy} transform={`scale(${l.r / 4})`} />
          ))}
          {/* 卷叶 — 分布在藤蔓两侧 */}
          {Array.from({ length: 10 }, (_, i) => (
            <use
              key={`leaf-${i}`}
              href="#scroll-leaf-v2"
              x={w * 0.05 + hash(i + 40) * w * 0.88}
              y={h * 0.05 + hash(i + 41) * h * 0.88}
              transform={`rotate(${(hash(i + 42) - 0.5) * 120})`}
              opacity={0.3 + hash(i + 43) * 0.3}
            />
          ))}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
