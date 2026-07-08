import { useMemo } from 'react'

interface BambooLeafPatternProps {
  opacity?: number
  color?: string
  density?: number
}

/**
 * 竹叶纹 — 参考文人画竹 + 明清单色釉竹叶纹
 *
 * 竹叶三三两两散落，每片旋转角度、大小各异
 * 带有"个"字、"介"字形竹叶组合，自然散点排列
 * 适合修习类页面（竹=君子=修习成长）
 */

function hash(i: number): number {
  let h = (i * 2654435761 + 123) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) / 4294967296
}

export default function BambooLeafPattern({
  opacity = 0.20,
  color = 'var(--color-ink-secondary)',
  density = 140,
}: BambooLeafPatternProps) {
  const patternId = 'bamboo-leaf-pattern'
  const w = density * 2
  const h = density * 2

  // 竹叶组合 — 三叶"个"字组 + 单叶散落
  const leafGroups = useMemo(() => {
    const groups: {
      cx: number; cy: number; rotation: number; scale: number
      leaves: { angle: number; length: number; width: number }[]
    }[] = []
    for (let i = 0; i < 14; i++) {
      const cx = w * 0.03 + hash(i) * w * 0.94
      const cy = h * 0.03 + hash(i + 10) * h * 0.94
      const rotation = hash(i + 20) * 360
      const scale = 0.6 + hash(i + 30) * 0.8
      const pattern = Math.floor(hash(i + 40) * 3) // 0:"个"字 1:"介"字 2:单叶
      const leaves: { angle: number; length: number; width: number }[] = []
      if (pattern === 0) {
        // "个"字 — 三叶
        leaves.push({ angle: -25, length: 14, width: 3 })
        leaves.push({ angle: 25, length: 14, width: 3 })
        leaves.push({ angle: 0, length: 12, width: 2.5 })
      } else if (pattern === 1) {
        // "介"字 — 四叶
        leaves.push({ angle: -35, length: 10, width: 2.5 })
        leaves.push({ angle: 35, length: 10, width: 2.5 })
        leaves.push({ angle: -15, length: 13, width: 3 })
        leaves.push({ angle: 15, length: 13, width: 3 })
      } else {
        // 单叶
        leaves.push({ angle: 0, length: 16, width: 3.5 })
      }
      groups.push({ cx, cy, rotation, scale, leaves })
    }
    return groups
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
        {/* 单片竹叶 */}
        <g id="bamboo-leaf-v2">
          <path
            d="M 0 0 C 3 -3, 8 -2, 14 0 C 8 2, 3 3, 0 0 Z"
            fill={color}
            stroke="none"
          />
        </g>

        <pattern id={patternId} x="0" y="0" width={w} height={h} patternUnits="userSpaceOnUse">
          {leafGroups.map((g, i) => (
            <g
              key={i}
              transform={`translate(${g.cx},${g.cy}) rotate(${g.rotation}) scale(${g.scale})`}
              opacity={0.5 + hash(i + 50) * 0.3}
            >
              {g.leaves.map((leaf, j) => (
                <g key={j} transform={`rotate(${leaf.angle})`}>
                  <use
                    href="#bamboo-leaf-v2"
                    transform={`scale(${leaf.width / 3.5}, ${leaf.length / 14})`}
                  />
                </g>
              ))}
            </g>
          ))}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
