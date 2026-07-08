import { useMemo } from 'react'

interface CloudPatternProps {
  opacity?: number
  color?: string
  /** 图案高度（控制行密度），默认 100 */
  density?: number
}

/**
 * 流云纹 — 传统云气纹满铺 SVG 背景
 *
 * 设计参考：汉代云气纹（马王堆刺绣） + 唐代卷云纹（敦煌壁画边饰）
 * 特征：横向 S 形云气带 + 螺旋云头 + 飘逸云尾，行间错位形成流动感
 * 区别于之前的散点云团，此版采用"带状连续"布局，更接近传统云气纹的"满铺"效果
 */
export default function CloudPattern({
  opacity = 0.22,
  color = 'var(--color-gold)',
  density = 100,
}: CloudPatternProps) {
  const tileWidth = density * 3
  const tileHeight = density
  const patternId = 'cloud-pattern-v2'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      <defs>
        {/* 单个云团 — 螺旋头 + 双卷尾 */}
        <g id="cloud-motif" stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* 主螺旋云头 — 三层同心弧 */}
          <ellipse cx="0" cy="0" rx="12" ry="8" strokeWidth="1.6" />
          <ellipse cx="0" cy="0" rx="6" ry="4" strokeWidth="1.1" opacity="0.7" />
          <circle cx="0" cy="0" r="2" fill={color} stroke="none" opacity="0.55" />
          {/* 右上卷云 */}
          <path d="M 9 -5 C 16 -16, 28 -14, 32 -6 C 35 0, 30 4, 24 2" strokeWidth="1.4" />
          <path d="M 32 -6 C 38 -12, 46 -8, 44 -2 C 42 2, 36 2, 34 -2" strokeWidth="0.9" opacity="0.6" />
          {/* 左下卷云 */}
          <path d="M -9 5 C -16 16, -28 14, -32 6 C -35 0, -30 -4, -24 -2" strokeWidth="1.4" />
          <path d="M -32 6 C -38 12, -46 8, -44 2 C -42 -2, -36 -2, -34 2" strokeWidth="0.9" opacity="0.6" />
          {/* 云气尾 */}
          <path d="M 12 1 C 18 -2, 26 3, 28 7" strokeWidth="0.9" opacity="0.5" />
          <path d="M -12 -1 C -18 2, -26 -3, -28 -7" strokeWidth="0.9" opacity="0.5" />
        </g>

        <pattern
          id={patternId}
          x="0"
          y="0"
          width={tileWidth}
          height={tileHeight}
          patternUnits="userSpaceOnUse"
        >
          {/* 行 0：S 形云气带（主带） */}
          <g stroke={color} fill="none" strokeWidth="1.2" opacity="0.7" strokeLinecap="round">
            <path
              d={`M 0 ${tileHeight * 0.45}
                  C ${tileWidth * 0.25} ${tileHeight * 0.2}, ${tileWidth * 0.35} ${tileHeight * 0.15}, ${tileWidth * 0.5} ${tileHeight * 0.4}
                  C ${tileWidth * 0.65} ${tileHeight * 0.65}, ${tileWidth * 0.75} ${tileHeight * 0.7}, ${tileWidth} ${tileHeight * 0.45}`}
            />
          </g>
          {/* 云团 A — 主带第一个波峰 */}
          <use href="#cloud-motif" x={tileWidth * 0.22} y={tileHeight * 0.22} transform="scale(1.0)" />
          {/* 云团 B — 主带波谷 */}
          <use href="#cloud-motif" x={tileWidth * 0.55} y={tileHeight * 0.55} transform="scale(0.85)" />
          {/* 云团 C — 主带第二个波峰 */}
          <use href="#cloud-motif" x={tileWidth * 0.82} y={tileHeight * 0.35} transform="scale(0.9)" />

          {/* 行间错位补偿 — 半个云团填充间隙 */}
          <use href="#cloud-motif" x={tileWidth * 0.0} y={tileHeight * 0.48} transform="scale(0.7)" />
          <use href="#cloud-motif" x={tileWidth * 0.38} y={tileHeight * 0.1} transform="scale(0.65)" />
          <use href="#cloud-motif" x={tileWidth * 0.68} y={tileHeight * 0.85} transform="scale(0.7)" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
