import { createContext, useContext, useState, type ReactNode } from 'react'

interface AppState {
  mockMode: boolean
  sidebarCollapsed: boolean
  setMockMode: (v: boolean) => void
  toggleSidebar: () => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [mockMode, setMockMode] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = () => setSidebarCollapsed(v => !v)

  return (
    <AppContext.Provider value={{ mockMode, sidebarCollapsed, setMockMode, toggleSidebar }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
