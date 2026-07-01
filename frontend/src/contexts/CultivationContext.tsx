/** 非遗修习之路全局状态 — 已迁移至 Zustand store，此文件为向后兼容重导出 */

export { useCultivationStore, useCultivation } from '../stores/cultivationStore'

// Zustand 无需 Provider；保留空壳以兼容旧 main.tsx 中的 JSX 嵌套
import type { ReactNode } from 'react'
export function CultivationProvider({ children }: { children: ReactNode }) {
  return children as any
}
