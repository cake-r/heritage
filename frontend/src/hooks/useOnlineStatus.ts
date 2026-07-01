/** 离线检测 Hook — 断网时自动提示 */

import { useEffect, useState, useCallback } from 'react'
import { message } from 'antd'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      message.success('网络已恢复')
    }
    const handleOffline = () => {
      setIsOnline(false)
      message.warning('网络连接已断开，部分功能不可用')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

/** 包装函数：仅在线时执行 */
export function useWhenOnline(fn: (...args: any[]) => any) {
  const isOnline = useOnlineStatus()
  return useCallback((...args: any[]) => {
    if (!isOnline) {
      message.warning('当前无网络连接，请联网后重试')
      return
    }
    return fn(...args)
  }, [isOnline, fn])
}
