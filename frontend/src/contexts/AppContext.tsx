/** 全局应用状态 — 已迁移至 Zustand store，此文件为向后兼容重导出 */

export { useAppStore, useApp } from '../stores/appStore'

// Zustand 无需 Provider；保留空壳以兼容旧 main.tsx 中的 JSX 嵌套
import type { ReactNode } from 'react'
export function AppProvider({ children }: { children: ReactNode }) {
  return children as any
}
