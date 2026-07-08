import { useMemo } from 'react'

interface MountainMistPatternProps {
  opacity?: number
  color?: string
  density?: number
}

/**
 * 山水云烟纹 — 参考水墨山水画 + 米氏云山
 *
 * 层叠的山峦轮廓线 + 飘渺的云雾带，带有水墨画"远山含烟"的意境
 * 所有线条都用不规则曲线，避免几何机械感
 * 适合知识图谱、故事模式等需要意境深远的页面
 */

function hash(i: number): number {
  let h = (i * 2654435761 + 77) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) / 4294967296
}

export default function MountainMistPattern({
  opacity = 0.16,
  color = 'var(--color-ink-secondary)',
  density = 180,
}: MountainMistPatternProps) {
  const patternId = 'mountain-mist-pattern'
  const w = density * 2
  const h = density

  // 生成层叠山峦轮廓
  const mountainLayers = useMemo(() => {
    const layers: { d: string; sw: number; o: number; yBase: number }[] = []
    // 3 层山峦，从远到近
    for (let layer = 0; layer < 3; layer++) {
      const yBase = h * 0.35 + layer * h * 0.22
      const segments = 8
      let d = `M 0 ${yBase + (hash(layer) - 0.5) * 20}`
      const pts: [number, number][] = []
      for (let i = 0; i <= segments; i++) {
        const x = (w * i) / segments
        const y = yBase + (hash(layer * 10 + i) - 0.5) * h * 0.35
        pts.push([x, y])
      }
      // 用 Catmull-Rom 风格曲线连接
      for (let i = 1; i < pts.length; i++) {
        const cx1 = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) / 3
        const cx2 = pts[i][0] - (pts[i][0] - pts[i - 1][0]) / 3
        d += ` C ${cx1} ${pts[i - 1][1]}, ${cx2} ${pts[i][1]}, ${pts[i][0]} ${pts[i][1]}`
      }
      layers.push({
        d,
        sw: 1.8 - layer * 0.4,
        o: 0.5 - layer * 0.12,
        yBase,
      })
    }
    return layers
  }, [w, h])

  // 云雾带 — 横向不规则飘带
  const mistBands = useMemo(() => {
    const bands: { d: string; o: number }[] = []
    for (let i = 0; i < 3; i++) {
      const y = h * 0.15 + i * h * 0.3
      const d = `M 0 ${y}
        C ${w * 0.2} ${y - h * 0.06}, ${w * 0.35} ${y + h * 0.08}, ${w * 0.5} ${y}
        C ${w * 0.65} ${y - h * 0.06}, ${w * 0.8} ${y + h * 0.05}, ${w} ${y}`
      bands.push({ d, o: 0.25 + i * 0.05 })
    }
    return bands
  }, [w, h])

  // 散点飞鸟/远帆 — 极简点缀
  const birds = useMemo(() => {
    const result: { cx: number; cy: number; r: number }[] = []
    for (let i = 0; i < 5; i++) {
      result.push({
        cx: w * 0.05 + hash(i + 50) * w * 0.9,
        cy: h * 0.05 + hash(i + 51) * h * 0.3,
        r: 1 + hash(i + 52) * 2.5,
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
        <pattern id={patternId} x="0" y="0" width={w} height={h} patternUnits="userSpaceOnUse">
          {/* 远山层 */}
          {mountainLayers.map((layer, i) => (
            <path
              key={`mt-${i}`}
              d={layer.d}
              stroke={color}
              fill="none"
              strokeWidth={layer.sw}
              opacity={layer.o}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {/* 云雾带 */}
          {mistBands.map((band, i) => (
            <path
              key={`mist-${i}`}
              d={band.d}
              stroke={color}
              fill="none"
              strokeWidth="1.0"
              opacity={band.o}
              strokeLinecap="round"
              strokeDasharray="12 6"
            />
          ))}
          {/* 远鸟点缀 */}
          {birds.map((b, i) => (
            <circle
              key={`bird-${i}`}
              cx={b.cx} cy={b.cy}
              r={b.r}
              fill={color}
              stroke="none"
              opacity={0.25}
            />
          ))}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
