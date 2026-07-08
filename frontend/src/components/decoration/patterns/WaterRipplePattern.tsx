import { useMemo } from 'react'

interface WaterRipplePatternProps {
  opacity?: number
  color?: string
  /** 涟漪密度（数值越小越密） */
  density?: number
}

/**
 * 水波纹 — 涟漪纹
 *
 * 灵感来自水面涟漪扩散与宋代瓷器水波纹
 * 多个涟漪中心散落，同心椭圆交错叠加，产生"波光粼粼"的不规则美感
 * 适合对话交流类页面（涟漪=话语扩散）
 */
export default function WaterRipplePattern({
  opacity = 0.18,
  color = 'var(--color-ink-secondary)',
  density = 120,
}: WaterRipplePatternProps) {
  const patternId = 'water-ripple-pattern'

  // 固定涟漪中心点（避免每次 render 变化）
  const centers = useMemo(() => [
    { x: 0.15, y: 0.2, rings: 4, maxR: 45 },
    { x: 0.55, y: 0.45, rings: 5, maxR: 55 },
    { x: 0.85, y: 0.15, rings: 3, maxR: 35 },
    { x: 0.3, y: 0.7, rings: 4, maxR: 42 },
    { x: 0.7, y: 0.8, rings: 3, maxR: 38 },
    { x: 0.05, y: 0.85, rings: 2, maxR: 28 },
    { x: 0.5, y: 0.05, rings: 3, maxR: 32 },
  ], [])

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} x="0" y="0" width={density * 2} height={density * 2} patternUnits="userSpaceOnUse">
          {centers.map((c, i) => {
            const cx = c.x * density * 2
            const cy = c.y * density * 2
            return (
              <g key={i} stroke={color} fill="none" strokeLinecap="round">
                {Array.from({ length: c.rings }, (_, j) => {
                  const r = (c.maxR * (j + 1)) / c.rings
                  const o = 1 - j * 0.18 // 外层越来越淡
                  const sw = 1.2 - j * 0.1 // 外层线略细
                  return (
                    <ellipse
                      key={j}
                      cx={cx}
                      cy={cy}
                      rx={r}
                      ry={r * 0.6}
                      strokeWidth={Math.max(sw, 0.5)}
                      opacity={o}
                    />
                  )
                })}
                {/* 涟漪中心小点 */}
                <circle cx={cx} cy={cy} r="2" fill={color} stroke="none" opacity="0.4" />
              </g>
            )
          })}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
