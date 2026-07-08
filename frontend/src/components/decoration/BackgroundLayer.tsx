import type { ReactNode, CSSProperties } from 'react'

interface BackgroundLayerProps {
  children?: ReactNode
  /** 底层纹样组件 */
  pattern?: ReactNode
  /** 额外的 CSS 背景（如渐变、纯色） */
  baseBg?: string
  /** 混合模式 */
  blendMode?: CSSProperties['mixBlendMode']
  /** 容器 className */
  className?: string
  /** 容器 style */
  style?: CSSProperties
}

/**
 * 背景纹样层容器
 *
 * 用法：
 * ```tsx
 * <BackgroundLayer pattern={<CloudPattern opacity={0.03} />} baseBg="var(--color-paper-white)">
 *   <YourContent />
 * </BackgroundLayer>
 * ```
 *
 * pattern 作为绝对定位的 SVG 层覆盖在 baseBg 之上、内容之下
 */
export default function BackgroundLayer({
  children,
  pattern,
  baseBg,
  blendMode,
  className,
  style,
}: BackgroundLayerProps) {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        background: baseBg,
        ...style,
      }}
    >
      {/* 纹样层 */}
      {pattern && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            mixBlendMode: blendMode,
            pointerEvents: 'none',
            zIndex: 0,
          }}
          aria-hidden="true"
        >
          {pattern}
        </div>
      )}
      {/* 内容层 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
