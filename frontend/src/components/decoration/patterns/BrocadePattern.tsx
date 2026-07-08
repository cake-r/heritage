interface BrocadePatternProps {
  opacity?: number
  color?: string
  /** 图案大小，默认 60px（越小越密） */
  size?: number
}

/**
 * 织锦纹 — 参考宋锦/蜀锦四方连续几何纹样
 *
 * 以菱形+方胜+龟背为骨架，点缀小花，形成"满地锦"效果
 * 适合作为页面基底暗纹，有传统织物触感
 *
 * 设计参考：
 * - 宋代八达晕锦（几何骨架 + 花卉填充）
 * - 蜀錦方胜纹（菱形连锁）
 * - 织锦缎满地花纹（密集小单元四方连续）
 */
export default function BrocadePattern({
  opacity = 0.18,
  color = 'var(--color-ink-secondary)',
  size = 56,
}: BrocadePatternProps) {
  const half = size / 2
  const q = size / 4
  const patternId = 'brocade-pattern'

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
        {/* 单元菱形 */}
        <g id="brocade-diamond">
          {/* 主菱形骨架 */}
          <polygon
            points={`${half},${q} ${size - q},${half} ${half},${size - q} ${q},${half}`}
            fill="none"
            stroke={color}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* 内菱形 */}
          <polygon
            points={`${half},${q + 6} ${size - q - 6},${half} ${half},${size - q - 6} ${q + 6},${half}`}
            fill="none"
            stroke={color}
            strokeWidth="0.8"
            strokeLinejoin="round"
            opacity="0.6"
          />
          {/* 四角小点 — 方胜纹特征 */}
          <circle cx={q} cy={half} r="2" fill={color} stroke="none" opacity="0.5" />
          <circle cx={size - q} cy={half} r="2" fill={color} stroke="none" opacity="0.5" />
          <circle cx={half} cy={q} r="2" fill={color} stroke="none" opacity="0.5" />
          <circle cx={half} cy={size - q} r="2" fill={color} stroke="none" opacity="0.5" />
          {/* 中心小花 — 四瓣 */}
          <circle cx={half} cy={half} r="3" fill={color} stroke="none" opacity="0.35" />
          <circle cx={half - 3} cy={half} r="1.8" fill={color} stroke="none" opacity="0.28" />
          <circle cx={half + 3} cy={half} r="1.8" fill={color} stroke="none" opacity="0.28" />
          <circle cx={half} cy={half - 3} r="1.8" fill={color} stroke="none" opacity="0.28" />
          <circle cx={half} cy={half + 3} r="1.8" fill={color} stroke="none" opacity="0.28" />
        </g>

        {/* 连接线 — 十字交叉，连成满铺 */}
        <g id="brocade-connector">
          <line x1={half} y1={0} x2={half} y2={q} stroke={color} strokeWidth="0.7" opacity="0.4" />
          <line x1={half} y1={size - q} x2={half} y2={size} stroke={color} strokeWidth="0.7" opacity="0.4" />
          <line x1={0} y1={half} x2={q} y2={half} stroke={color} strokeWidth="0.7" opacity="0.4" />
          <line x1={size - q} y1={half} x2={size} y2={half} stroke={color} strokeWidth="0.7" opacity="0.4" />
        </g>

        <pattern
          id={patternId}
          x="0"
          y="0"
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
        >
          <use href="#brocade-connector" />
          <use href="#brocade-diamond" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
