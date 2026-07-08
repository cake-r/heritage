import { useMemo } from 'react'

interface IceCracklePatternProps {
  opacity?: number
  color?: string
  /** 裂纹密度（数值越小裂纹越密） */
  size?: number
}

/**
 * 冰裂纹 — 参考宋代哥窑瓷器釉面开片
 *
 * 以不规则多边形网络模拟天然冰裂/釉面开片
 * 每块碎片形状略有不同，大小不一，带有手工的不完美感
 * 适合修复类页面（碎→整的意象）
 */

// 确定性"随机"数生成器 (mulberry32)
function hash(i: number, seed: number = 42): number {
  let h = (i * 2654435761 + seed) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) / 4294967296
}

export default function IceCracklePattern({
  opacity = 0.20,
  color = 'var(--color-ink-secondary)',
  size = 80,
}: IceCracklePatternProps) {
  const patternId = 'ice-crackle-pattern'

  // 生成不规则的裂纹线段网络
  const cracks = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; sw: number; o: number }[] = []
    // 主裂纹 — 横跨全格的几条大线
    for (let i = 0; i < 6; i++) {
      const h = hash(i)
      if (h < 0.33) {
        // 竖线
        const x = size * 0.15 + hash(i + 10) * size * 0.7
        lines.push({ x1: x, y1: 0, x2: x + hash(i + 20) * 8 - 4, y2: size, sw: 1.6, o: 0.55 })
      } else if (h < 0.66) {
        // 横线
        const y = size * 0.15 + hash(i + 10) * size * 0.7
        lines.push({ x1: 0, y1: y, x2: size, y2: y + hash(i + 20) * 8 - 4, sw: 1.6, o: 0.55 })
      } else {
        // 斜线
        const x1 = hash(i + 5) * size * 0.5
        const y1 = hash(i + 6) * size * 0.3
        lines.push({
          x1, y1,
          x2: x1 + size * 0.3 + hash(i + 20) * size * 0.4,
          y2: y1 + size * 0.4 + hash(i + 21) * size * 0.4,
          sw: 1.2, o: 0.4,
        })
      }
    }
    // 副裂纹 — 从主裂纹分叉的小线
    for (let i = 0; i < 12; i++) {
      const x1 = hash(i + 30) * size
      const y1 = hash(i + 31) * size
      const len = size * 0.1 + hash(i + 32) * size * 0.25
      const angle = hash(i + 33) * Math.PI * 2
      lines.push({
        x1, y1,
        x2: x1 + Math.cos(angle) * len,
        y2: y1 + Math.sin(angle) * len,
        sw: 0.8 + hash(i + 34) * 0.6,
        o: 0.25 + hash(i + 35) * 0.25,
      })
    }
    return lines
  }, [size])

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} x="0" y="0" width={size} height={size} patternUnits="userSpaceOnUse">
          {/* 底色 — 模拟釉面微妙的色差 */}
          <rect x="0" y="0" width={size} height={size} fill="none" />
          {/* 裂纹线 */}
          {cracks.map((c, i) => (
            <line
              key={i}
              x1={c.x1} y1={c.y1}
              x2={c.x2} y2={c.y2}
              stroke={color}
              strokeWidth={c.sw}
              opacity={c.o}
              strokeLinecap="round"
            />
          ))}
          {/* 裂纹交叉点 — 小铆钉/气泡感 */}
          {Array.from({ length: 8 }, (_, i) => (
            <circle
              key={`dot-${i}`}
              cx={hash(i + 60) * size}
              cy={hash(i + 61) * size}
              r={1 + hash(i + 62) * 1.5}
              fill={color}
              stroke="none"
              opacity={0.25 + hash(i + 63) * 0.2}
            />
          ))}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
