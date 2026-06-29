import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface FilterState {
  region: string | null
  era: string | null
  drilledCategory: string | null
}

interface FilterContextValue extends FilterState {
  setRegion: (region: string | null) => void
  setEra: (era: string | null) => void
  setDrilledCategory: (cat: string | null) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  activeTags: { key: string; label: string; onClose: () => void }[]
}

const FilterContext = createContext<FilterContextValue | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<string | null>(null)
  const [era, setEraState] = useState<string | null>(null)
  const [drilledCategory, setDrilledCategoryState] = useState<string | null>(null)

  const setRegion = useCallback((r: string | null) => setRegionState(r), [])
  const setEra = useCallback((e: string | null) => setEraState(e), [])
  const setDrilledCategory = useCallback((c: string | null) => setDrilledCategoryState(c), [])
  const clearFilters = useCallback(() => {
    setRegionState(null)
    setEraState(null)
  }, [])

  const hasActiveFilters = region !== null || era !== null

  const activeTags = []
  if (region) {
    activeTags.push({
      key: 'region',
      label: region,
      onClose: () => setRegionState(null),
    })
  }
  if (era) {
    activeTags.push({
      key: 'era',
      label: era,
      onClose: () => setEraState(null),
    })
  }

  return (
    <FilterContext.Provider value={{ region, era, drilledCategory, setRegion, setEra, setDrilledCategory, clearFilters, hasActiveFilters, activeTags }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) {
    throw new Error('useFilters must be used within <FilterProvider>')
  }
  return ctx
}
