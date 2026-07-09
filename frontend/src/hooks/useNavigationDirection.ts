import { useEffect, useRef, useState } from 'react'

export type NavDirection = 'forward' | 'back' | 'same'

/**
 * 根据新旧路径的段数变化，判断导航方向：
 *  forward — 深入（段数增加），新页从右滑入
 *  back    — 返回（段数减少），新页从左滑入
 *  same    — 同级切换，交叉淡入淡出
 */
function getDepth(path: string): number {
  return path.split('/').filter(Boolean).length
}

export function useNavigationDirection(pathname: string): NavDirection {
  const prevPathname = useRef(pathname)
  const [direction, setDirection] = useState<NavDirection>('same')

  useEffect(() => {
    const prev = prevPathname.current
    if (prev === pathname) return

    const prevDepth = getDepth(prev)
    const newDepth = getDepth(pathname)

    if (newDepth > prevDepth) setDirection('forward')
    else if (newDepth < prevDepth) setDirection('back')
    else setDirection('same')

    prevPathname.current = pathname
  }, [pathname])

  return direction
}
