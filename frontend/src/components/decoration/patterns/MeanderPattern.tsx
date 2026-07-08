interface MeanderPatternProps {
  opacity?: number
  color?: string
  /** 单元格大小，默认 48 */
  cellSize?: number
  /** 显示模式：full 满铺 / band 仅上下横带 */
  mode?: 'full' | 'band'
}

/**
 * 回纹 — 满铺/带状双模式
 *
 * 设计参考：商周青铜回纹 + 明清家具回纹边饰
 * - full 模式：四方连续满铺，适合大面积背景
 * - band 模式：仅上下两条横带，适合分隔线/边框
 *
 * 单元结构：外回字（双线） + 内回字（单线） + 四角铆钉点
 */
export default function MeanderPattern({
  opacity = 0.22,
  color = 'var(--color-ink-secondary)',
  cellSize = 48,
  mode = 'full',
}: MeanderPatternProps) {
  const pad = cellSize * 0.12 // 外边距
  const inner = cellSize * 0.3  // 内回字缩进
  const patternId = 'meander-pattern-v2'

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
        <g id="meander-cell-v2" stroke={color} fill="none" strokeLinejoin="miter" strokeLinecap="square">
          {/* 外回字框 */}
          <rect
            x={pad} y={pad}
            width={cellSize - pad * 2}
            height={cellSize - pad * 2}
            strokeWidth="1.4"
            rx="2"
            opacity="0.55"
          />
          {/* 内回字 — 偏左上有开口 */}
          <path
            d={`M ${inner},${inner}
                L ${cellSize - inner},${inner}
                L ${cellSize - inner},${cellSize - inner}
                L ${inner},${cellSize - inner}`}
            strokeWidth="1.1"
            opacity="0.45"
          />
          {/* 开口 — 上下各一处断开 */}
          <line x1={inner + 2} y1={inner} x2={inner + 8} y2={inner}
            stroke={color} strokeWidth="1.8" opacity="0.5" />
          <line x1={cellSize - inner - 2} y1={cellSize - inner}
            x2={cellSize - inner - 8} y2={cellSize - inner}
            stroke={color} strokeWidth="1.8" opacity="0.5" />
          {/* 四角装饰点 */}
          <circle cx={pad} cy={pad} r="2.2" fill={color} stroke="none" opacity="0.5" />
          <circle cx={cellSize - pad} cy={pad} r="2.2" fill={color} stroke="none" opacity="0.5" />
          <circle cx={pad} cy={cellSize - pad} r="2.2" fill={color} stroke="none" opacity="0.5" />
          <circle cx={cellSize - pad} cy={cellSize - pad} r="2.2" fill={color} stroke="none" opacity="0.5" />
        </g>

        <pattern
          id={patternId}
          x="0" y="0"
          width={cellSize}
          height={cellSize}
          patternUnits="userSpaceOnUse"
        >
          <use href="#meander-cell-v2" />
        </pattern>
      </defs>

      {mode === 'full' ? (
        <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
      ) : (
        <>
          <rect x="0" y="0" width="100%" height={cellSize} fill={`url(#${patternId})`} />
          <rect x="0" y={`calc(100% - ${cellSize}px)`} width="100%" height={cellSize} fill={`url(#${patternId})`} />
        </>
      )}
    </svg>
  )
}

/**
 * 回纹分隔带 — 单条水平带
 */
interface MeanderBandProps {
  color?: string
  opacity?: number
  height?: number
}

export function MeanderBand({
  color = 'var(--color-gold)',
  opacity = 0.30,
  height = 40,
}: MeanderBandProps) {
  return (
    <div style={{ position: 'relative', height, overflow: 'hidden' }} aria-hidden="true">
      <MeanderPattern
        opacity={opacity}
        color={color}
        cellSize={height}
        mode="band"
      />
    </div>
  )
}
