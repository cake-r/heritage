/** 通知中心 Zustand Store — 全局通知状态管理 */

import { create } from 'zustand'

export interface AppNotification {
  id: string
  type: 'achievement' | 'stamp' | 'rank_up' | 'quest' | 'system'
  title: string
  description: string
  icon: string       // emoji
  route?: string     // 点击跳转
  read: boolean
  created_at: number // timestamp
}

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  /** 添加一条通知 */
  push: (n: Omit<AppNotification, 'id' | 'read' | 'created_at'>) => void
  /** 标记单条已读 */
  markRead: (id: string) => void
  /** 全部已读 */
  markAllRead: () => void
  /** 清除已读 */
  clearRead: () => void
}

const STORAGE_KEY = 'app_notifications'
const MAX_NOTIFICATIONS = 50

function loadFromStorage(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(notifications: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)))
  } catch { /* ignore */ }
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: loadFromStorage(),
  unreadCount: loadFromStorage().filter(n => !n.read).length,

  push: (n) => {
    const notification: AppNotification = {
      ...n,
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      read: false,
      created_at: Date.now(),
    }
    set((state) => {
      const updated = [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS)
      saveToStorage(updated)
      return { notifications: updated, unreadCount: updated.filter(x => !x.read).length }
    })
  },

  markRead: (id) => {
    set((state) => {
      const updated = state.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      )
      saveToStorage(updated)
      return { notifications: updated, unreadCount: updated.filter(x => !x.read).length }
    })
  },

  markAllRead: () => {
    set((state) => {
      const updated = state.notifications.map(n => ({ ...n, read: true }))
      saveToStorage(updated)
      return { notifications: updated, unreadCount: 0 }
    })
  },

  clearRead: () => {
    set((state) => {
      const updated = state.notifications.filter(n => !n.read)
      saveToStorage(updated)
      return { notifications: updated, unreadCount: updated.length }
    })
  },
}))

/** 便捷函数：从组件外部推送通知 */
export function pushNotification(n: Omit<AppNotification, 'id' | 'read' | 'created_at'>) {
  useNotificationStore.getState().push(n)
}

/** 初始化全局通知事件监听（在 main.tsx 中调用一次） */
export function initNotificationListener() {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail && detail.title) {
      pushNotification({
        type: detail.type || 'system',
        title: detail.title,
        description: detail.description || '',
        icon: detail.icon || 'pin',
        route: detail.route,
      })
    }
  }
  window.addEventListener('notification:push', handler)
}

