interface Props {
  opacity?: number
  color?: string
  accentColor?: string
}

/**
 * 行云纹 — 数字护照页
 *
 * 两条 S 形云气带横向流淌，首尾 Y 对齐保证无缝连续
 * 每 tile 内含两个完整波长，波峰波谷各缀云头螺旋
 * 星标散落如旅途驿站
 */
export default function JourneyCloudPattern({
  opacity = 0.22,
  color = 'var(--color-ink-secondary)',
  accentColor = 'var(--color-gold)',
}: Props) {
  const W = 240
  const H = 120
  const pid = 'journey-cloud'

  // 上带基准 Y
  const y1 = H * 0.30
  // 下带基准 Y
  const y2 = H * 0.74
  // 波幅
  const amp = H * 0.20

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={pid} x="0" y="0" width={W} height={H} patternUnits="userSpaceOnUse">
          {/* ===== 上排云气带 ===== */}
          {/* S 形主曲线 — 两个完整波，首尾 Y 相同 = 无缝连续 */}
          <path
            d={`M 0 ${y1}
                C ${W * 0.15} ${y1 - amp}, ${W * 0.15} ${y1 + amp}, ${W * 0.25} ${y1}
                C ${W * 0.35} ${y1 - amp}, ${W * 0.40} ${y1 - amp * 0.6}, ${W * 0.50} ${y1}
                C ${W * 0.60} ${y1 + amp * 0.6}, ${W * 0.65} ${y1 + amp}, ${W * 0.75} ${y1}
                C ${W * 0.85} ${y1 - amp}, ${W * 0.85} ${y1 + amp}, ${W} ${y1}`}
            fill="none" stroke={color} strokeWidth="1.6" opacity="0.48" strokeLinecap="round"
          />

          {/* 上带云头 — 波峰/波谷处 */}
          {[
            { cx: W * 0.10, cy: y1 - amp * 0.55 },   // 上行起点附近
            { cx: W * 0.20, cy: y1 + amp * 0.60 },   // 波谷
            { cx: W * 0.40, cy: y1 - amp * 0.30 },   // 小波峰
            { cx: W * 0.65, cy: y1 + amp * 0.55 },   // 波谷
            { cx: W * 0.78, cy: y1 - amp * 0.50 },   // 波峰
            { cx: W * 0.90, cy: y1 + amp * 0.25 },   // 尾声
          ].map((p, i) => (
            <g key={`cu-${i}`}>
              <ellipse cx={p.cx} cy={p.cy} rx="8" ry="5.5" fill="none" stroke={color} strokeWidth="1.2" opacity="0.50" />
              <ellipse cx={p.cx} cy={p.cy} rx="4" ry="2.8" fill="none" stroke={color} strokeWidth="0.8" opacity="0.38" />
              <circle cx={p.cx} cy={p.cy} r="1.4" fill={color} stroke="none" opacity="0.45" />
            </g>
          ))}

          {/* ===== 下排云气带（与上排反向相位，产生交织感）===== */}
          <path
            d={`M 0 ${y2}
                C ${W * 0.15} ${y2 + amp}, ${W * 0.15} ${y2 - amp}, ${W * 0.25} ${y2}
                C ${W * 0.35} ${y2 + amp}, ${W * 0.40} ${y2 + amp * 0.6}, ${W * 0.50} ${y2}
                C ${W * 0.60} ${y2 - amp * 0.6}, ${W * 0.65} ${y2 - amp}, ${W * 0.75} ${y2}
                C ${W * 0.85} ${y2 + amp}, ${W * 0.85} ${y2 - amp}, ${W} ${y2}`}
            fill="none" stroke={color} strokeWidth="1.6" opacity="0.48" strokeLinecap="round"
          />

          {/* 下带云头 */}
          {[
            { cx: W * 0.08, cy: y2 + amp * 0.50 },
            { cx: W * 0.22, cy: y2 - amp * 0.55 },
            { cx: W * 0.42, cy: y2 + amp * 0.35 },
            { cx: W * 0.62, cy: y2 - amp * 0.50 },
            { cx: W * 0.80, cy: y2 + amp * 0.55 },
          ].map((p, i) => (
            <g key={`cd-${i}`}>
              <ellipse cx={p.cx} cy={p.cy} rx="7.5" ry="5" fill="none" stroke={color} strokeWidth="1.2" opacity="0.50" />
              <ellipse cx={p.cx} cy={p.cy} rx="3.8" ry="2.5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.38" />
              <circle cx={p.cx} cy={p.cy} r="1.3" fill={color} stroke="none" opacity="0.45" />
            </g>
          ))}

          {/* ===== 星标 — 旅途驿站 ===== */}
          {[
            [W * 0.05, y1 - amp * 0.8], [W * 0.30, y1],
            [W * 0.55, y1 - amp * 0.3], [W * 0.85, y1 - amp * 0.7],
            [W * 0.15, y2], [W * 0.38, y2 - amp * 0.7],
            [W * 0.68, y2 + amp * 0.3], [W * 0.92, y2],
          ].map(([cx, cy], i) => (
            <g key={`st-${i}`}>
              <circle cx={cx} cy={cy} r="2.2" fill={accentColor} stroke="none" opacity="0.52" />
              <line x1={Number(cx) - 4.5} y1={cy} x2={Number(cx) + 4.5} y2={cy}
                stroke={accentColor} strokeWidth="0.6" opacity="0.32" />
              <line x1={cx} y1={Number(cy) - 4.5} x2={cx} y2={Number(cy) + 4.5}
                stroke={accentColor} strokeWidth="0.6" opacity="0.32" />
            </g>
          ))}

          {/* 飘带短须 */}
          {[W * 0.32, W * 0.58, W * 0.23, W * 0.72].map((cx, i) => {
            const cy = i < 2 ? y1 : y2
            const dir = i % 2 === 0 ? 1 : -1
            return (
              <path key={`fr-${i}`}
                d={`M ${cx} ${cy} C ${cx + 6} ${cy + dir * 10}, ${cx + 10} ${cy + dir * 8}, ${cx + 12} ${cy + dir * 3}`}
                fill="none" stroke={color} strokeWidth="0.7" opacity="0.30" strokeLinecap="round"
              />
            )
          })}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${pid})`} opacity={opacity} />
    </svg>
  )
}
