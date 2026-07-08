interface LoomGridPatternProps {
  opacity?: number
  color?: string
  accentColor?: string
  /** 单元格大小，默认 80 */
  cellSize?: number
}

/**
 * 经纬格纹 — 管理后台页
 *
 * 织机经纬交织，如数据行列表格。双重方框 + 对角编织线 + 菱形节点 + 中心菱花。
 * 借鉴 StarChartPattern 的边节点共享策略 + StepBrocadePattern 的嵌套矩形层次。
 * 加入微妙曲线软化几何感，避免"冷冰图表"印象。
 * 纯直接绘制，ink 骨架 + gold 节点。
 *
 * 设计参考：
 * - 汉代织锦经纬线
 * - 宋式锦地纹（几何骨架 + 金属节点）
 * - 营造法式彩画纹样（规矩 + 菱花组合）
 */
export default function LoomGridPattern({
  opacity = 0.20,
  color = 'var(--color-ink-secondary)',
  accentColor = 'var(--color-gold)',
  cellSize = 80,
}: LoomGridPatternProps) {
  const S = cellSize
  const H = S / 2
  const pad1 = S * 0.05   // 外框边距 ~4px
  const pad2 = S * 0.15   // 内框边距 ~12px
  const pid = 'loom-grid'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={pid} x="0" y="0" width={S} height={S} patternUnits="userSpaceOnUse">
          {/* ===== 外方框 — 第一层 ===== */}
          <rect
            x={pad1} y={pad1}
            width={S - pad1 * 2}
            height={S - pad1 * 2}
            rx="1"
            fill="none"
            stroke={color}
            strokeWidth="1.2"
            opacity="0.38"
          />

          {/* ===== 内方框 — 第二层（嵌套层次感）===== */}
          <rect
            x={pad2} y={pad2}
            width={S - pad2 * 2}
            height={S - pad2 * 2}
            rx="1"
            fill="none"
            stroke={color}
            strokeWidth="0.7"
            opacity="0.26"
          />

          {/* ===== 十字经纬线 ===== */}
          <line x1={H} y1={0} x2={H} y2={S} stroke={color} strokeWidth="0.6" opacity="0.22" />
          <line x1={0} y1={H} x2={S} y2={H} stroke={color} strokeWidth="0.6" opacity="0.22" />

          {/* ===== 对角编织线 — 微妙曲线避免"冷冰图表"感 ===== */}
          <path
            d={`M ${pad1} ${pad1} Q ${H} ${H} ${S - pad1} ${S - pad1}`}
            fill="none" stroke={accentColor} strokeWidth="0.7" opacity="0.28"
          />
          <path
            d={`M ${S - pad1} ${pad1} Q ${H} ${H} ${pad1} ${S - pad1}`}
            fill="none" stroke={accentColor} strokeWidth="0.7" opacity="0.28"
          />

          {/* ===== 对角线与内框交点 — 菱形节点（4 个）===== */}
          {[
            [pad2, pad2],
            [S - pad2, pad2],
            [pad2, S - pad2],
            [S - pad2, S - pad2],
          ].map(([cx, cy], i) => (
            <g key={`diamond-${i}`}>
              <rect
                x={Number(cx) - 3} y={Number(cy) - 3}
                width="6" height="6" rx="1"
                fill={accentColor}
                stroke="none"
                opacity="0.45"
                transform={`rotate(45, ${cx}, ${cy})`}
              />
              {/* 微光晕 */}
              <circle cx={cx} cy={cy} r="4" fill={accentColor} stroke="none" opacity="0.15" />
            </g>
          ))}

          {/* ===== 中心菱花 — 嵌套双层菱形 ===== */}
          <rect
            x={H - 10} y={H - 10}
            width="20" height="20" rx="1.5"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.0"
            opacity="0.40"
            transform={`rotate(45, ${H}, ${H})`}
          />
          <rect
            x={H - 6} y={H - 6}
            width="12" height="12" rx="1"
            fill="none"
            stroke={color}
            strokeWidth="0.7"
            opacity="0.30"
            transform={`rotate(45, ${H}, ${H})`}
          />
          {/* 中心金点 */}
          <circle cx={H} cy={H} r="2.5" fill={accentColor} stroke="none" opacity="0.50" />
          <circle cx={H} cy={H} r="4.5" fill={accentColor} stroke="none" opacity="0.14" />

          {/* ===== 边中点铆钉 — 与邻格共享 ===== */}
          {[
            [H, pad1],
            [H, S - pad1],
            [pad1, H],
            [S - pad1, H],
          ].map(([cx, cy], i) => (
            <g key={`edge-dot-${i}`}>
              <circle cx={cx} cy={cy} r="2" fill={accentColor} stroke="none" opacity="0.40" />
              {/* 小十字星芒 */}
              <line
                x1={Number(cx) - 4} y1={cy}
                x2={Number(cx) + 4} y2={cy}
                stroke={accentColor} strokeWidth="0.5" opacity="0.22"
              />
              <line
                x1={cx} y1={Number(cy) - 4}
                x2={cx} y2={Number(cy) + 4}
                stroke={accentColor} strokeWidth="0.5" opacity="0.22"
              />
            </g>
          ))}

          {/* ===== 四角铆钉 ===== */}
          {[
            [pad1, pad1],
            [S - pad1, pad1],
            [pad1, S - pad1],
            [S - pad1, S - pad1],
          ].map(([cx, cy], i) => (
            <circle
              key={`corner-dot-${i}`}
              cx={cx} cy={cy}
              r="1.6"
              fill={color}
              stroke="none"
              opacity="0.42"
            />
          ))}

          {/* ===== 底部刻度标记 — 一行 7 个微竖线（数据表格暗示）===== */}
          {Array.from({ length: 7 }, (_, i) => {
            const tx = S * 0.15 + i * (S * 0.117)
            const ty = S - pad1 + 1
            return (
              <line
                key={`tick-${i}`}
                x1={tx} y1={ty}
                x2={tx} y2={ty + (i % 3 === 0 ? 5 : 3)}
                stroke={color}
                strokeWidth="0.7"
                opacity={0.22}
                strokeLinecap="round"
              />
            )
          })}

          {/* ===== 内框四角小弧 — 软化直角（营造法式彩画元素）===== */}
          {[
            [pad2 + 3, pad2 + 3, 0],
            [S - pad2 - 3, pad2 + 3, 90],
            [pad2 + 3, S - pad2 - 3, -90],
            [S - pad2 - 3, S - pad2 - 3, 180],
          ].map(([cx, cy, rot], i) => (
            <path
              key={`corner-arc-${i}`}
              d={`M ${cx} ${Number(cy) - 4} A 4 4 0 0 1 ${Number(cx) + 4} ${cy}`}
              fill="none"
              stroke={accentColor}
              strokeWidth="0.6"
              opacity="0.28"
              strokeLinecap="round"
              transform={`rotate(${rot}, ${cx}, ${cy})`}
            />
          ))}

          {/* ===== 对角线上散布微点 — 编织感的"针脚" ===== */}
          {[0.22, 0.38, 0.62, 0.78].map((t, i) => {
            const cx = pad1 + t * (S - pad1 * 2)
            return (
              <circle
                key={`stitch-${i}`}
                cx={cx}
                cy={pad1 + t * (S - pad1 * 2)}
                r="0.9"
                fill={accentColor}
                stroke="none"
                opacity="0.32"
              />
            )
          })}
        </pattern>
      </defs>

      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${pid})`} opacity={opacity} />
    </svg>
  )
}
