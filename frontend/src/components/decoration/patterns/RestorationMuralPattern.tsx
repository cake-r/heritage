interface Props {
  opacity?: number
  color?: string
  goldColor?: string
}

/**
 * 金缮菱纹 — 修复页纹样
 *
 * 菱形骨架 + 金缮交叉线 + 铆钉圆点
 * 灵感：金缮修复（裂痕描金）+ 传统补丁绣（菱格缝缀）
 * 纯直接绘制，不用 <use>，保证可靠渲染
 */
export default function RestorationMuralPattern({
  opacity = 0.22,
  color = 'var(--color-ink-secondary)',
  goldColor = 'var(--color-gold)',
}: Props) {
  const S = 80 // 单元格
  const H = S / 2
  const Q = S / 4
  const pid = 'rest-p'

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
          <line x1={H} y1={0} x2={H} y2={S} stroke={color} strokeWidth="1.0" opacity="0.35" />
          <line x1={0} y1={H} x2={S} y2={H} stroke={color} strokeWidth="1.0" opacity="0.35" />

          {/* 对角交叉 — 金缮修复线 */}
          <line x1={0} y1={0} x2={S} y2={S} stroke={goldColor} strokeWidth="1.6" opacity="0.55" />
          <line x1={S} y1={0} x2={0} y2={S} stroke={goldColor} strokeWidth="1.6" opacity="0.55" />

          {/* 内缩菱形 — 修补缝线 */}
          <rect x={H - H * 0.55} y={H - H * 0.55} width={H * 1.1} height={H * 1.1} rx="2"
            stroke={color} strokeWidth="1.4" fill="none" opacity="0.50"
            transform={`rotate(45, ${H}, ${H})`} />

          {/* 外扩菱形 — 缝线外圈 */}
          <rect x={H - H * 0.78} y={H - H * 0.78} width={H * 1.56} height={H * 1.56} rx="2"
            stroke={color} strokeWidth="0.8" fill="none" opacity="0.30"
            transform={`rotate(45, ${H}, ${H})`} />

          {/* 铆钉点 — 四边中点（金缮铆钉） */}
          {[[H, 4], [H, S - 4], [4, H], [S - 4, H]].map(([cx, cy], i) => (
            <circle key={`m-${i}`} cx={cx} cy={cy} r="3" fill={goldColor} stroke="none" opacity="0.60" />
          ))}
          {/* 铆钉内芯 */}
          {[[H, 4], [H, S - 4], [4, H], [S - 4, H]].map(([cx, cy], i) => (
            <circle key={`mi-${i}`} cx={cx} cy={cy} r="1.2" fill={color} stroke="none" opacity="0.50" />
          ))}

          {/* 对角线金粉微粒 */}
          {[
            [Q, Q], [S - Q, Q], [Q, S - Q], [S - Q, S - Q],
            [H, Q], [H, S - Q], [Q, H], [S - Q, H],
          ].map(([cx, cy], i) => (
            <circle key={`gd-${i}`} cx={cx} cy={cy} r="1.6" fill={goldColor} stroke="none" opacity="0.45" />
          ))}

          {/* 四角装饰小菱 */}
          {[[4, 4], [S - 4, 4], [4, S - 4], [S - 4, S - 4]].map(([cx, cy], i) => (
            <rect key={`sd-${i}`} x={cx - 3} y={cy - 3} width="6" height="6" rx="1"
              stroke={color} strokeWidth="0.8" fill="none" opacity="0.35"
              transform={`rotate(45, ${cx}, ${cy})`} />
          ))}
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${pid})`} opacity={opacity} />
    </svg>
  )
}
