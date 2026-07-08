import React, { useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import { initNotificationListener } from './stores/notificationStore'
import './styles/tokens.css'
import './styles/globals.css'

// 初始化全局通知事件监听（使任何组件可通过 CustomEvent 推送通知）
initNotificationListener()

// Ant Design 主题 Token — 无论亮/暗色，品牌色保持统一
function useAntdTheme() {
  const { theme: mode } = useTheme()
  const isDark = mode === 'dark'

  return useMemo(() => ({
    token: {
      // 品牌色（亮暗通用）
      colorPrimary: '#B8463A',
      colorInfo: '#5B7FA0',
      colorSuccess: '#4A8C5C',
      colorWarning: '#C49A3C',
      colorError: '#C5533B',

      // 字体
      fontSize: 18,
      fontFamily: `'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,

      // 形状
      borderRadius: 8,
      borderRadiusLG: 14,
      borderRadiusSM: 4,

      // 间距
      paddingContentHorizontal: 24,
    },
    components: {
      Menu: {
        darkItemBg: '#1E1B18',
        darkItemSelectedBg: '#2A2520',
        darkItemColor: '#DED9D0',
        darkItemSelectedColor: '#C4A265',
      },
      Card: {
        boxShadow: isDark
          ? '0 1px 3px rgba(0, 0, 0, 0.3)'
          : '0 1px 3px rgba(30, 27, 24, 0.06)',
      },
      Button: {
        borderRadius: 8,
        fontWeight: 500,
      },
      Tag: {
        borderRadiusSM: 4,
      },
      Modal: {
        borderRadiusLG: 20,
      },
    },
  }), [isDark])
}

/** 桥接组件 — 放在 ThemeProvider 内部以读取 useTheme() */
function ThemedConfigProvider({ children }: { children: React.ReactNode }) {
  const theme = useAntdTheme()
  return (
    <ConfigProvider theme={theme} locale={zhCN}>
      {children}
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ThemedConfigProvider>
          <AppProvider>
            <AuthProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </AuthProvider>
          </AppProvider>
        </ThemedConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
