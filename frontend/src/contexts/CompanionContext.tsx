/** AI 智能伴游全局状态 — 已迁移至 Zustand store，此文件为向后兼容重导出 */

export { useCompanionStore, useCompanion } from '../stores/companionStore'

// Zustand 无需 Provider；保留空壳以兼容旧 main.tsx 中的 JSX 嵌套
import type { ReactNode } from 'react'
export function CompanionProvider({ children }: { children: ReactNode }) {
  return children as any
}
