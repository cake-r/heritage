/** 全局应用状态 — Zustand store (替代 AppContext) */

import { create } from 'zustand'

interface AppState {
  mockMode: boolean
  sidebarCollapsed: boolean
  setMockMode: (v: boolean) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()((set) => ({
  mockMode: false,
  sidebarCollapsed: false,
  setMockMode: (v) => set({ mockMode: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

/** @deprecated 使用 useAppStore 替代，保留别名以兼容现有导入 */
export const useApp = useAppStore
