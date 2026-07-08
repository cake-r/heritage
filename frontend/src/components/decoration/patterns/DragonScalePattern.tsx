interface Props {
  opacity?: number
  color?: string
  goldColor?: string
  fireColor?: string
}

/**
 * 龙鳞纹 — 修习之路页
 *
 * 灵感：龙袍鳞甲 + 云龙纹 + 火珠
 * 层叠鳞片错位排列 + 火珠点缀 + 云须
 * 龙=飞升=修习进阶，鳞=层层突破，火珠=能量核心
 */
export default function DragonScalePattern({
  opacity = 0.22,
  color = 'var(--color-ink-secondary)',
  goldColor = 'var(--color-gold)',
  fireColor = 'var(--color-vermilion)',
}: Props) {
  const W = 90   // 鳞片宽度
  const H = 40   // 行高
  const pid = 'dragon-scale'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={pid} x="0" y="0" width={W} height={H * 2} patternUnits="userSpaceOnUse">
          {/* === 第1行鳞片 (x=0 开始) === */}
          <g>
            {/* 鳞片弧 */}
            <path
              d={`M ${W * 0.08} ${H * 0.15} C ${W * 0.08} ${H * 0.05}, ${W * 0.92} ${H * 0.05}, ${W * 0.92} ${H * 0.15}`}
              fill="none" stroke={color} strokeWidth="1.2" opacity="0.48"
            />
            {/* 鳞片内弧 */}
            <path
              d={`M ${W * 0.22} ${H * 0.25} C ${W * 0.25} ${H * 0.10}, ${W * 0.75} ${H * 0.10}, ${W * 0.78} ${H * 0.25}`}
              fill="none" stroke={color} strokeWidth="0.7" opacity="0.30"
            />
            {/* 鳞片尖 */}
            <circle cx={W / 2} cy={H * 0.18} r="1.8" fill={goldColor} stroke="none" opacity="0.55" />
          </g>

          {/* === 第1行 火珠（鳞片之间）=== */}
          <g>
            <circle cx={W * 0.02} cy={H * 0.50} r="2.5" fill={fireColor} stroke="none" opacity="0.45" />
            <circle cx={W * 0.02} cy={H * 0.50} r="1.0" fill={goldColor} stroke="none" opacity="0.50" />
            {/* 火苗上 */}
            <path
              d={`M ${W * 0.02} ${H * 0.42} C ${W * 0.04} ${H * 0.32}, ${W * 0.06} ${H * 0.32}, ${W * 0.06} ${H * 0.42}`}
              fill={fireColor} stroke="none" opacity="0.30"
            />
          </g>

          {/* === 第2行鳞片 (x=W/2 偏移开始) === */}
          <g transform={`translate(${W / 2}, ${H})`}>
            <path
              d={`M ${W * 0.08} ${H * 0.15} C ${W * 0.08} ${H * 0.05}, ${W * 0.92} ${H * 0.05}, ${W * 0.92} ${H * 0.15}`}
              fill="none" stroke={color} strokeWidth="1.2" opacity="0.48"
            />
            <path
              d={`M ${W * 0.22} ${H * 0.25} C ${W * 0.25} ${H * 0.10}, ${W * 0.75} ${H * 0.10}, ${W * 0.78} ${H * 0.25}`}
              fill="none" stroke={color} strokeWidth="0.7" opacity="0.30"
            />
            <circle cx={W / 2} cy={H * 0.18} r="1.8" fill={goldColor} stroke="none" opacity="0.55" />
          </g>

          {/* === 第2行 火珠 === */}
          <g transform={`translate(${W / 2}, ${H})`}>
            <circle cx={W * 0.02} cy={H * 0.50} r="2.5" fill={fireColor} stroke="none" opacity="0.45" />
            <circle cx={W * 0.02} cy={H * 0.50} r="1.0" fill={goldColor} stroke="none" opacity="0.50" />
            <path
              d={`M ${W * 0.02} ${H * 0.42} C ${W * 0.04} ${H * 0.32}, ${W * 0.06} ${H * 0.32}, ${W * 0.06} ${H * 0.42}`}
              fill={fireColor} stroke="none" opacity="0.30"
            />
          </g>

          {/* 云须 — 横穿鳞片底部 */}
          <path
            d={`M 0 ${H * 1.35} C ${W * 0.3} ${H * 1.25}, ${W * 0.7} ${H * 1.45}, ${W} ${H * 1.35}`}
            fill="none" stroke={goldColor} strokeWidth="0.7" opacity="0.28" strokeLinecap="round"
          />
          <path
            d={`M ${-W / 2} ${H * 1.75} C ${W * 0.1} ${H * 1.65}, ${W * 0.6} ${H * 1.85}, ${W + W / 2} ${H * 1.75}`}
            fill="none" stroke={color} strokeWidth="0.5" opacity="0.22" strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${pid})`} opacity={opacity} />
    </svg>
  )
}
