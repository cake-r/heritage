interface WindowLatticePatternProps {
  opacity?: number
  color?: string
  accentColor?: string
  size?: number
}

/**
 * 菱花窗格纹 — 苏州园林花窗灵感
 *
 * 菱形网格为骨，交点上绽四瓣海棠小花，间以十字星
 * 疏密有致，留白得当，像透过花窗看庭院
 * 专为"智能识别"页面设计——框景取物、洞察纹样
 */
export default function WindowLatticePattern({
  opacity = 0.22,
  color = 'var(--color-ink-secondary)',
  accentColor = 'var(--color-vermilion)',
  size = 100,
}: WindowLatticePatternProps) {
  const half = size / 2
  const pad = size * 0.08
  const patternId = 'window-lattice'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        {/* 四瓣海棠小花 */}
        <g id="wl-blossom">
          {[0, 90, 180, 270].map((angle) => (
            <ellipse
              key={angle}
              cx="0" cy="-5"
              rx="2.5" ry="4"
              fill={accentColor}
              stroke="none"
              opacity="0.45"
              transform={`rotate(${angle})`}
            />
          ))}
          <circle cx="0" cy="0" r="1.5" fill={color} stroke="none" opacity="0.5" />
        </g>

        {/* 十字星点 */}
        <g id="wl-star">
          <line x1="-3" y1="0" x2="3" y2="0" stroke={color} strokeWidth="0.7" opacity="0.45" />
          <line x1="0" y1="-3" x2="0" y2="3" stroke={color} strokeWidth="0.7" opacity="0.45" />
          <circle cx="0" cy="0" r="1.2" fill={color} stroke="none" opacity="0.5" />
        </g>

        <pattern id={patternId} x="0" y="0" width={size} height={size} patternUnits="userSpaceOnUse">
          {/* 菱格骨架 — 主十字 */}
          <line x1={half} y1={0} x2={half} y2={size} stroke={color} strokeWidth="0.8" opacity="0.35" />
          <line x1={0} y1={half} x2={size} y2={half} stroke={color} strokeWidth="0.8" opacity="0.35" />

          {/* 菱格骨架 — 对角交叉 */}
          <line x1={0} y1={0} x2={size} y2={size} stroke={color} strokeWidth="0.6" opacity="0.25" />
          <line x1={size} y1={0} x2={0} y2={size} stroke={color} strokeWidth="0.6" opacity="0.25" />

          {/* 内缩菱形 */}
          <rect
            x={half - half * 0.55} y={half - half * 0.55}
            width={half * 1.1} height={half * 1.1}
            rx="1"
            stroke={color} strokeWidth="0.9" fill="none"
            opacity="0.4"
            transform={`rotate(45, ${half}, ${half})`}
          />

          {/* 外扩菱形 */}
          <rect
            x={half - half * 0.82} y={half - half * 0.82}
            width={half * 1.64} height={half * 1.64}
            rx="1"
            stroke={color} strokeWidth="0.6" fill="none"
            opacity="0.25"
            transform={`rotate(45, ${half}, ${half})`}
          />

          {/* 中心：海棠花 */}
          <use href="#wl-blossom" x={half} y={half} />

          {/* 边中点：十字星 */}
          <use href="#wl-star" x={half} y={pad} />
          <use href="#wl-star" x={half} y={size - pad} />
          <use href="#wl-star" x={pad} y={half} />
          <use href="#wl-star" x={size - pad} y={half} />

          {/* 四角小圆点 */}
          <circle cx={pad} cy={pad} r="2" fill={color} stroke="none" opacity="0.3" />
          <circle cx={size - pad} cy={pad} r="2" fill={color} stroke="none" opacity="0.3" />
          <circle cx={pad} cy={size - pad} r="2" fill={color} stroke="none" opacity="0.3" />
          <circle cx={size - pad} cy={size - pad} r="2" fill={color} stroke="none" opacity="0.3" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} opacity={opacity} />
    </svg>
  )
}
