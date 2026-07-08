interface Props {
  opacity?: number
  color?: string
  accentColor?: string
}

/**
 * 经纬星图纹 — 文化图谱页
 *
 * 灵感：古代星图/舆图 + 织锦经纬线 + 知识图谱节点
 * 横竖经纬骨架 + 对角斜线 + 交点星芒节点 = 知识坐标网络
 * 纯直接绘制
 */
export default function StarChartPattern({
  opacity = 0.22,
  color = 'var(--color-ink-secondary)',
  accentColor = 'var(--color-gold)',
}: Props) {
  const S = 72
  const H = S / 2
  const pid = 'star-chart'

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
          {/* 经纬骨架 */}
          <line x1={H} y1={0} x2={H} y2={S} stroke={color} strokeWidth="0.9" opacity="0.30" />
          <line x1={0} y1={H} x2={S} y2={H} stroke={color} strokeWidth="0.9" opacity="0.30" />

          {/* 对角斜线 — 知识连线 */}
          <line x1={0} y1={0} x2={S} y2={S} stroke={color} strokeWidth="0.6" opacity="0.22" />
          <line x1={S} y1={0} x2={0} y2={S} stroke={color} strokeWidth="0.6" opacity="0.22" />

          {/* 中心节点 — 星芒 */}
          <circle cx={H} cy={H} r="4" fill={accentColor} stroke="none" opacity="0.55" />
          <circle cx={H} cy={H} r="1.6" fill={color} stroke="none" opacity="0.50" />
          {/* 十字星芒线 */}
          <line x1={H - 7} y1={H} x2={H + 7} y2={H} stroke={accentColor} strokeWidth="0.8" opacity="0.35" />
          <line x1={H} y1={H - 7} x2={H} y2={H + 7} stroke={accentColor} strokeWidth="0.8" opacity="0.35" />

          {/* 边节点 — 小星（与邻格共享形成完整星） */}
          {[[H, 0], [H, S], [0, H], [S, H]].map(([cx, cy], i) => (
            <g key={`sn-${i}`}>
              <circle cx={cx} cy={cy} r="2.5" fill={accentColor} stroke="none" opacity="0.40" />
              <line x1={Number(cx) - 5} y1={cy} x2={Number(cx) + 5} y2={cy} stroke={accentColor} strokeWidth="0.6" opacity="0.25" />
              <line x1={cx} y1={Number(cy) - 5} x2={cx} y2={Number(cy) + 5} stroke={accentColor} strokeWidth="0.6" opacity="0.25" />
            </g>
          ))}

          {/* 四角小星 */}
          {[[0, 0], [S, 0], [0, S], [S, S]].map(([cx, cy], i) => (
            <g key={`sc-${i}`}>
              <circle cx={cx} cy={cy} r="1.6" fill={accentColor} stroke="none" opacity="0.30" />
              <line x1={Number(cx) - 3} y1={cy} x2={Number(cx) + 3} y2={cy} stroke={accentColor} strokeWidth="0.5" opacity="0.20" />
              <line x1={cx} y1={Number(cy) - 3} x2={cx} y2={Number(cy) + 3} stroke={accentColor} strokeWidth="0.5" opacity="0.20" />
            </g>
          ))}

          {/* 子午线细圈 — 四象限各一个小圆 */}
          {[
            [H / 2, H / 2], [H + H / 2, H / 2],
            [H / 2, H + H / 2], [H + H / 2, H + H / 2],
          ].map(([cx, cy], i) => (
            <circle key={`q-${i}`} cx={cx} cy={cy} r="6" fill="none" stroke={color} strokeWidth="0.6" opacity="0.25" />
          ))}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${pid})`} opacity={opacity} />
    </svg>
  )
}
