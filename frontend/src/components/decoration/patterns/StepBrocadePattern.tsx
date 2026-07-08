interface Props {
  opacity?: number
  color?: string
  accentColor?: string
}

/**
 * 步步锦纹 — 修习之路页
 *
 * 参考：传统建筑窗棂"步步锦"样式——嵌套矩形逐层内缩，寓意步步高升
 * 中心如意云头，四角方胜星，工整雅致
 */
export default function StepBrocadePattern({
  opacity = 0.22,
  color = 'var(--color-ink-secondary)',
  accentColor = 'var(--color-gold)',
}: Props) {
  const S = 84
  const H = S / 2
  const pid = 'step-brocade'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={pid} x="0" y="0" width={S} height={S} patternUnits="userSpaceOnUse">
          {/* 十字骨架 */}
          <line x1={H} y1={0} x2={H} y2={S} stroke={color} strokeWidth="0.9" opacity="0.27" />
          <line x1={0} y1={H} x2={S} y2={H} stroke={color} strokeWidth="0.9" opacity="0.27" />

          {/* 步步锦 — 对齐一角（左上角）的嵌套矩形 */}
          {[0, 1, 2].map((i) => {
            const inset = S * 0.12 + i * S * 0.12
            const w = S - inset * 2
            const o = i === 0 ? 0.45 : i === 1 ? 0.32 : 0.20
            const sw = i === 0 ? 1.2 : 0.7
            return (
              <rect key={`n-${i}`} x={inset} y={inset} width={w} height={w} rx="2"
                stroke={color} strokeWidth={sw} fill="none" opacity={o} />
            )
          })}

          {/* 中心如意云头 */}
          <ellipse cx={H} cy={H} rx="10" ry="7" fill="none" stroke={accentColor} strokeWidth="1.2" opacity="0.48" />
          <ellipse cx={H} cy={H} rx="5" ry="3.5" fill="none" stroke={accentColor} strokeWidth="0.7" opacity="0.35" />
          <circle cx={H} cy={H} r="1.6" fill={accentColor} stroke="none" opacity="0.50" />
          {/* 云头小卷 */}
          <path d={`M ${H + 6} ${H - 3} C ${H + 12} ${H - 10}, ${H + 16} ${H - 6}, ${H + 13} ${H - 2}`}
            fill="none" stroke={accentColor} strokeWidth="0.8" opacity="0.35" />
          <path d={`M ${H - 6} ${H + 3} C ${H - 12} ${H + 10}, ${H - 16} ${H + 6}, ${H - 13} ${H + 2}`}
            fill="none" stroke={accentColor} strokeWidth="0.8" opacity="0.35" />

          {/* 四角方胜星 */}
          {[[S * 0.12, S * 0.12], [S - S * 0.12, S * 0.12],
            [S * 0.12, S - S * 0.12], [S - S * 0.12, S - S * 0.12],
          ].map(([cx, cy], i) => (
            <g key={`fs-${i}`}>
              <rect x={Number(cx) - 3.5} y={Number(cy) - 3.5} width="7" height="7" rx="1"
                stroke={color} strokeWidth="0.9" fill="none" opacity="0.38"
                transform={`rotate(45, ${cx}, ${cy})`} />
              <circle cx={cx} cy={cy} r="1.2" fill={accentColor} stroke="none" opacity="0.35" />
            </g>
          ))}

          {/* 边中点饰点 */}
          {[[H, S * 0.08], [H, S - S * 0.08], [S * 0.08, H], [S - S * 0.08, H]].map(([cx, cy], i) => (
            <circle key={`ed-${i}`} cx={cx} cy={cy} r="1.6" fill={accentColor} stroke="none" opacity="0.32" />
          ))}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${pid})`} opacity={opacity} />
    </svg>
  )
}
