interface MedallionPatternProps {
  opacity?: number
  color?: string
  accentColor?: string
  size?: number
}

/**
 * 团花纹 — 唐代联珠团窠纹 + 宝相花纹的几何演绎
 *
 * 圆形团花在网格中四方连续，以同心圆为骨，十二瓣小花为饰
 * 团花之间以小菱格/联珠桥连接，形成"满地团花"的织锦效果
 * 专为"文创生成"页面——团花=圆满生成，联珠=创意串联
 */
export default function MedallionPattern({
  opacity = 0.20,
  color = 'var(--color-ink-secondary)',
  accentColor = 'var(--color-vermilion)',
  size = 140,
}: MedallionPatternProps) {
  const half = size / 2
  const patternId = 'medallion'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        {/* 中心团花 */}
        <g id="md-center">
          {/* 外圈 — 联珠环 */}
          <circle cx={half} cy={half} r={half * 0.68} fill="none" stroke={color} strokeWidth="1.3" opacity="0.55" />
          <circle cx={half} cy={half} r={half * 0.60} fill="none" stroke={color} strokeWidth="0.6" opacity="0.35"
            strokeDasharray="3 3" />
          {/* 中圈 */}
          <circle cx={half} cy={half} r={half * 0.42} fill="none" stroke={color} strokeWidth="1.0" opacity="0.5" />
          {/* 花蕊圈 */}
          <circle cx={half} cy={half} r={half * 0.16} fill="none" stroke={color} strokeWidth="0.9" opacity="0.45" />
          <circle cx={half} cy={half} r={half * 0.06} fill={color} stroke="none" opacity="0.4" />
          {/* 十二瓣放射小花 */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * 30 * Math.PI) / 180
            const cx = half + Math.cos(angle) * half * 0.29
            const cy = half + Math.sin(angle) * half * 0.29
            return (
              <ellipse
                key={i}
                cx={cx} cy={cy}
                rx={5} ry={2.5}
                fill={i % 3 === 0 ? accentColor : color}
                stroke="none"
                opacity={i % 3 === 0 ? 0.55 : 0.4}
                transform={`rotate(${i * 30}, ${cx}, ${cy})`}
              />
            )
          })}
        </g>

        {/* 边中半团花 — 与相邻 tile 拼接成完整团花 */}
        {['top', 'bottom', 'left', 'right'].map((pos) => {
          const x = pos === 'left' ? 0 : pos === 'right' ? size : half
          const y = pos === 'top' ? 0 : pos === 'bottom' ? size : half
          return (
            <g key={pos}>
              <circle cx={x} cy={y} r={half * 0.48} fill="none" stroke={color} strokeWidth="1.2" opacity="0.45" />
              <circle cx={x} cy={y} r={half * 0.38} fill="none" stroke={color} strokeWidth="0.7" opacity="0.35" />
              <circle cx={x} cy={y} r={half * 0.10} fill="none" stroke={color} strokeWidth="0.8" opacity="0.4" />
              <circle cx={x} cy={y} r={half * 0.04} fill={color} stroke="none" opacity="0.35" />
              {Array.from({ length: 8 }, (_, i) => {
                const angle = (i * 45 * Math.PI) / 180
                const px = x + Math.cos(angle) * half * 0.24
                const py = y + Math.sin(angle) * half * 0.24
                return (
                  <ellipse key={i} cx={px} cy={py} rx={3} ry={1.5}
                    fill={color} stroke="none" opacity={0.35}
                    transform={`rotate(${i * 45}, ${px}, ${py})`} />
                )
              })}
            </g>
          )
        })}

        {/* 对角四分之一团花 */}
        {[
          [0, 0], [size, 0], [0, size], [size, size],
        ].map(([cx, cy], i) => (
          <g key={`corner-${i}`}>
            <circle cx={cx} cy={cy} r={half * 0.32} fill="none" stroke={color} strokeWidth="1.0" opacity="0.4" />
            <circle cx={cx} cy={cy} r={half * 0.06} fill={color} stroke="none" opacity="0.3" />
          </g>
        ))}

        {/* 菱形连接桥 — 团花之间的过渡 */}
        <g stroke={color} fill="none" opacity="0.3">
          <rect x={half - 8} y={half - 8} width={16} height={16} rx="1"
            strokeWidth="0.7" transform={`rotate(45, ${half}, ${half})`} />
          <rect x={half - 4} y={half - 4} width={8} height={8} rx="1"
            strokeWidth="0.5" transform={`rotate(45, ${half}, ${half})`} fill={color} opacity="0.2" />
        </g>

        <pattern id={patternId} x="0" y="0" width={size} height={size} patternUnits="userSpaceOnUse">
          <use href="#md-center" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} opacity={opacity} />
    </svg>
  )
}
