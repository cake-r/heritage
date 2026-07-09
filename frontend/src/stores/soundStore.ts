/** 音效开关 — Zustand Store，localStorage 持久化 */

import { create } from 'zustand'

const STORAGE_KEY = 'ich-sound-enabled'

function loadFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw !== null ? raw === 'true' : true // 默认开启
  } catch {
    return true
  }
}

function saveToStorage(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled))
  } catch { /* ignore */ }
}

interface SoundState {
  soundEnabled: boolean
  toggleSound: () => void
  setSoundEnabled: (v: boolean) => void
}

export const useSoundStore = create<SoundState>((set, get) => ({
  soundEnabled: loadFromStorage(),

  toggleSound: () => {
    const next = !get().soundEnabled
    saveToStorage(next)
    set({ soundEnabled: next })
  },

  setSoundEnabled: (v: boolean) => {
    saveToStorage(v)
    set({ soundEnabled: v })
  },
}))

/** 供事件监听器等非 React 上下文调用 */
export const getSoundEnabled = () => useSoundStore.getState().soundEnabled
