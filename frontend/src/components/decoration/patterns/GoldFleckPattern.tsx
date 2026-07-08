import { useMemo } from 'react'

interface GoldFleckPatternProps {
  opacity?: number
  color?: string
  accentColor?: string
  density?: number
}

/**
 * 洒金笺纹 — 传统洒金宣纸灵感
 *
 * 仿中国书画用洒金纸/泥金笺
 * 金箔碎片 + 朱砂点 + 帘纹，漫不经心的手工感
 * 专为"文创生成"页面——创作从一张好纸开始
 */

function hash(i: number, seed: number = 42): number {
  let h = (i * 2654435761 + seed) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) / 4294967296
}

export default function GoldFleckPattern({
  opacity = 0.35,
  color = 'var(--color-gold)',
  accentColor = 'var(--color-vermilion)',
  density = 120,
}: GoldFleckPatternProps) {
  const patternId = 'gold-fleck'

  const flecks = useMemo(() => {
    const items: {
      cx: number; cy: number; rx: number; ry: number; rot: number; o: number; isAccent: boolean
    }[] = []
    // 大金箔
    for (let i = 0; i < 30; i++) {
      items.push({
        cx: hash(i) * density,
        cy: hash(i + 10) * density,
        rx: 4 + hash(i + 20) * 9,
        ry: 2 + hash(i + 21) * 5,
        rot: hash(i + 30) * 360,
        o: 0.45 + hash(i + 40) * 0.45,
        isAccent: false,
      })
    }
    // 小金箔
    for (let i = 0; i < 40; i++) {
      items.push({
        cx: hash(i + 50) * density,
        cy: hash(i + 60) * density,
        rx: 1.5 + hash(i + 70) * 3,
        ry: 0.8 + hash(i + 71) * 2,
        rot: hash(i + 80) * 360,
        o: 0.35 + hash(i + 90) * 0.45,
        isAccent: false,
      })
    }
    // 朱砂点
    for (let i = 0; i < 12; i++) {
      items.push({
        cx: hash(i + 100) * density,
        cy: hash(i + 110) * density,
        rx: 2 + hash(i + 120) * 3.5,
        ry: 2 + hash(i + 121) * 3.5,
        rot: 0,
        o: 0.5 + hash(i + 130) * 0.4,
        isAccent: true,
      })
    }
    return items
  }, [density])

  const fibers = useMemo(() => {
    const lines: { y: number; o: number }[] = []
    for (let i = 0; i < 10; i++) {
      lines.push({ y: hash(i + 200) * density, o: 0.15 + hash(i + 210) * 0.15 })
    }
    return lines
  }, [density])

  const clusters = useMemo(() => {
    const items: { cx: number; cy: number; r: number; o: number }[] = []
    for (let i = 0; i < 6; i++) {
      items.push({
        cx: hash(i + 300) * density,
        cy: hash(i + 310) * density,
        r: 5 + hash(i + 320) * 8,
        o: 0.5 + hash(i + 330) * 0.4,
      })
    }
    return items
  }, [density])

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} x="0" y="0" width={density} height={density} patternUnits="userSpaceOnUse">
          {/* 帘纹 */}
          {fibers.map((f, i) => (
            <line key={`f-${i}`} x1={0} y1={f.y} x2={density} y2={f.y}
              stroke={color} strokeWidth="0.6" opacity={f.o} />
          ))}
          {/* 金箔碎片 */}
          {flecks.map((f, i) => (
            <ellipse
              key={i}
              cx={f.cx} cy={f.cy}
              rx={f.rx} ry={f.ry}
              fill={f.isAccent ? accentColor : color}
              stroke="none"
              opacity={f.o}
              transform={`rotate(${f.rot}, ${f.cx}, ${f.cy})`}
            />
          ))}
          {/* 金箔簇 */}
          {clusters.map((c, i) => (
            <circle key={`c-${i}`} cx={c.cx} cy={c.cy} r={c.r}
              fill={color} stroke="none" opacity={c.o} />
          ))}
          {/* 簇旁碎屑 */}
          {clusters.map((c, i) => (
            <g key={`cs-${i}`} opacity={c.o * 0.7}>
              <ellipse cx={c.cx + c.r * 1.2} cy={c.cy - c.r * 0.5}
                rx={c.r * 0.4} ry={c.r * 0.2} fill={color} stroke="none"
                transform={`rotate(${hash(i + 400) * 90}, ${c.cx + c.r * 1.2}, ${c.cy - c.r * 0.5})`} />
              <ellipse cx={c.cx - c.r * 0.8} cy={c.cy + c.r * 0.6}
                rx={c.r * 0.3} ry={c.r * 0.15} fill={color} stroke="none"
                transform={`rotate(${hash(i + 410) * 90}, ${c.cx - c.r * 0.8}, ${c.cy + c.r * 0.6})`} />
            </g>
          ))}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} opacity={opacity} />
    </svg>
  )
}
