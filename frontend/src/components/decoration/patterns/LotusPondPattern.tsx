interface LotusPondPatternProps {
  opacity?: number
  color?: string
  accentColor?: string
  bloomColor?: string
  /** 单元格大小，默认 120 */
  cellSize?: number
}

/**
 * 莲池水纹 — 个人中心页
 *
 * 一方莲池，清净自省。中心八瓣莲花 + 三重涟漪 + 飘散花瓣 + 边中半苞。
 * 借鉴 DragonScalePattern 的三色层次法：ink 骨架、gold 花瓣、vermilion 花蕊/散瓣。
 * 纯直接绘制，边中半苞与邻格共享形成完整小花。
 *
 * 设计参考：
 * - 宋代莲池水禽纹（定窑/景德镇）
 * - 明清缠枝莲纹（青花 + 斗彩）
 * - 江南园林花街铺地（莲花 + 涟漪组合）
 */
export default function LotusPondPattern({
  opacity = 0.22,
  color = 'var(--color-ink-secondary)',
  accentColor = 'var(--color-gold)',
  bloomColor = 'var(--color-vermilion)',
  cellSize = 120,
}: LotusPondPatternProps) {
  const S = cellSize
  const H = S / 2
  const pid = 'lotus-pond'

  // 花瓣参数
  const petalLen = 18       // 椭圆半长轴
  const petalWid = 6.5      // 椭圆半短轴
  const petalBaseR = 6      // 花瓣距中心距离

  // 涟漪半径
  const rippleRadii = [S * 0.33, S * 0.22, S * 0.12] // ~40, ~26, ~14

  // 8 个花瓣的角度（从正上方顺时针）
  const petalAngles = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 - Math.PI / 2)

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
          {/* ===== 三重涟漪 ===== */}
          {rippleRadii.map((r, i) => (
            <circle
              key={`ripple-${i}`}
              cx={H}
              cy={H}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={i === 0 ? 1.0 : i === 1 ? 0.8 : 0.6}
              opacity={0.40 - i * 0.08}
            />
          ))}

          {/* ===== 中心八瓣莲花 ===== */}
          {petalAngles.map((angle, i) => {
            const cx = H + Math.cos(angle) * (petalBaseR + petalLen)
            const cy = H + Math.sin(angle) * (petalBaseR + petalLen)
            return (
              <ellipse
                key={`petal-${i}`}
                cx={cx}
                cy={cy}
                rx={petalLen}
                ry={petalWid}
                fill="none"
                stroke={accentColor}
                strokeWidth="1.1"
                opacity="0.45"
                transform={`rotate(${(angle * 180) / Math.PI + 90}, ${cx}, ${cy})`}
              />
            )
          })}

          {/* 花瓣间细线 — 连接相邻花瓣形成完整花型 */}
          {petalAngles.map((angle, i) => {
            const nextAngle = petalAngles[(i + 1) % 8]
            const x1 = H + Math.cos(angle) * (petalBaseR + 2)
            const y1 = H + Math.sin(angle) * (petalBaseR + 2)
            const x2 = H + Math.cos(nextAngle) * (petalBaseR + 2)
            const y2 = H + Math.sin(nextAngle) * (petalBaseR + 2)
            return (
              <line
                key={`pl-${i}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={accentColor}
                strokeWidth="0.5"
                opacity="0.25"
              />
            )
          })}

          {/* 花蕊 — vermilion 圆心 + 金点环绕 */}
          <circle cx={H} cy={H} r="3.5" fill={bloomColor} stroke="none" opacity="0.52" />
          <circle cx={H} cy={H} r="1.5" fill={accentColor} stroke="none" opacity="0.55" />
          {/* 蕊周 4 个小金点 */}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
            <circle
              key={`stamen-${i}`}
              cx={H + Math.cos(a) * 5}
              cy={H + Math.sin(a) * 5}
              r="1.2"
              fill={accentColor}
              stroke="none"
              opacity="0.42"
            />
          ))}

          {/* ===== 四角漂浮小叶 ===== */}
          {[
            [S * 0.18, S * 0.18],
            [S * 0.82, S * 0.18],
            [S * 0.18, S * 0.82],
            [S * 0.82, S * 0.82],
          ].map(([cx, cy], i) => (
            <g key={`leaf-${i}`}>
              <ellipse
                cx={cx} cy={cy}
                rx="7" ry="3.5"
                fill="none"
                stroke={color}
                strokeWidth="0.7"
                opacity="0.30"
                transform={`rotate(${45 + i * 90}, ${cx}, ${cy})`}
              />
              {/* 叶脉 */}
              <line
                x1={Number(cx) - 5} y1={cy}
                x2={Number(cx) + 5} y2={cy}
                stroke={color} strokeWidth="0.4" opacity="0.20"
                transform={`rotate(${45 + i * 90}, ${cx}, ${cy})`}
              />
            </g>
          ))}

          {/* ===== 散落花瓣 — 漂浮在涟漪区域 ===== */}
          {[
            [H - 25, H - 20, -30],
            [H + 22, H - 15, 15],
            [H - 18, H + 22, 60],
            [H + 27, H + 18, -45],
            [H - 8, H - 32, 10],
            [H + 10, H + 30, -20],
          ].map(([cx, cy, rot], i) => (
            <ellipse
              key={`drift-${i}`}
              cx={cx} cy={cy}
              rx="5" ry="2.2"
              fill={bloomColor}
              stroke="none"
              opacity={0.30 + (i % 3) * 0.06}
              transform={`rotate(${rot}, ${cx}, ${cy})`}
            />
          ))}

          {/* ===== 边中半苞 — 与邻格共享形成完整小花 ===== */}
          {[
            [H, S * 0.05, 0],     // 上边中点
            [H, S * 0.95, 0],     // 下边中点
            [S * 0.05, H, 0],     // 左边中点
            [S * 0.95, H, 0],     // 右边中点
          ].map(([cx, cy], i) => {
            const baseAngle = i < 2 ? 0 : Math.PI / 2
            return (
              <g key={`bud-${i}`}>
                {/* 半苞 — 3 片小花瓣扇开 */}
                {[-0.35, 0, 0.35].map((offset, j) => {
                  const a = baseAngle + offset
                  const px = Number(cx) + Math.cos(a) * 7
                  const py = Number(cy) + Math.sin(a) * 7
                  return (
                    <ellipse
                      key={`bp-${i}-${j}`}
                      cx={px} cy={py}
                      rx="6.5" ry="2.8"
                      fill="none"
                      stroke={accentColor}
                      strokeWidth="0.7"
                      opacity="0.32"
                      transform={`rotate(${(a * 180) / Math.PI + 90}, ${px}, ${py})`}
                    />
                  )
                })}
                {/* 小蕊点 */}
                <circle cx={cx} cy={cy} r="1.6" fill={bloomColor} stroke="none" opacity="0.38" />
              </g>
            )
          })}

          {/* ===== 细茎连线 — 从中心莲座向四角延伸 ===== */}
          {[
            [H, H, S * 0.15, S * 0.15],
            [H, H, S * 0.85, S * 0.15],
            [H, H, S * 0.15, S * 0.85],
            [H, H, S * 0.85, S * 0.85],
          ].map(([x1, y1, x2, y2], i) => (
            <path
              key={`stem-${i}`}
              d={`M ${x1} ${y1} C ${(Number(x1) + Number(x2)) / 2} ${y1}, ${(Number(x1) + Number(x2)) / 2} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth="0.6"
              opacity="0.22"
              strokeLinecap="round"
            />
          ))}

          {/* ===== 细节点缀 — 涟漪上的微光点 ===== */}
          {[
            [H + rippleRadii[0] * 0.7, H + rippleRadii[0] * 0.7],
            [H - rippleRadii[0] * 0.5, H + rippleRadii[0] * 0.5],
            [H + rippleRadii[1] * 0.8, H - rippleRadii[1] * 0.3],
          ].map(([cx, cy], i) => (
            <circle
              key={`spark-${i}`}
              cx={cx} cy={cy}
              r="1.0"
              fill={accentColor}
              stroke="none"
              opacity="0.35"
            />
          ))}
        </pattern>
      </defs>

      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${pid})`} opacity={opacity} />
    </svg>
  )
}
