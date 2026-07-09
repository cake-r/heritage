import { useState, useCallback, type MouseEvent } from 'react'

interface Ripple {
  id: number
  x: number
  y: number
}

let _nextId = 0

/**
 * 鎏金涟漪点击反馈 Hook
 * 返回 ripples 数组和 onMouseDown handler，在容器上绑定即可
 *
 * 用法:
 *   const { ripples, bindRipple } = useRipple()
 *   return <div {...bindRipple} style={{ position: 'relative', overflow: 'hidden' }}>
 *     {ripples.map(r => <RippleDot key={r.id} ... />)}
 *     <button>点我</button>
 *   </div>
 */
export function useRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([])

  const onMouseDown = useCallback((e: MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const id = _nextId++
    const ripple: Ripple = {
      id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    setRipples(prev => [...prev, ripple])

    // 600ms 后自动移除
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id))
    }, 600)
  }, [])

  // 返回绑定对象，方便直接展开到容器上
  const bindRipple = { onMouseDown }

  return { ripples, bindRipple } as const
}

/**
 * 单个涟漪圆点组件
 * 放在容器内部，ripples.map 渲染
 */
export function RippleDot({ x, y }: { x: number; y: number }) {
  return (
    <span
      style={{
        position: 'absolute',
        left: x - 20,
        top: y - 20,
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(196,162,101,0.5) 0%, rgba(196,162,101,0) 70%)',
        pointerEvents: 'none',
        animation: 'rippleExpand 0.5s ease-out forwards',
        zIndex: 9999,
      }}
    />
  )
}
