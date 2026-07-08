import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'
import { ThemeProvider } from './contexts/ThemeContext'
import ErrorBoundary from './components/common/ErrorBoundary'
import './styles/tokens.css'
import './styles/globals.css'

// 东方新古典 · 数字文博风 — Ant Design 主题
// 所有色值来自 tokens.css，hex fallback 兼容不支持 CSS 变量的旧浏览器
const theme = {
  token: {
    // 品牌色
    colorPrimary: '#B8463A',           // --color-vermilion
    colorInfo: '#5B7FA0',             // --color-info
    colorSuccess: '#4A8C5C',          // --color-success
    colorWarning: '#C49A3C',          // --color-warning
    colorError: '#C5533B',            // --color-error

    // 文字
    colorTextBase: '#2C241A',         // --color-ink
    colorTextSecondary: '#6B5F52',    // --color-ink-secondary

    // 背景
    colorBgBase: '#FFFDF9',           // --color-paper-white
    colorBgLayout: '#F7F4ED',         // --color-paper

    // 字体（提升基准为 18px）
    fontSize: 18,
    fontFamily: `'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,

    // 形状
    borderRadius: 8,                  // --radius-md
    borderRadiusLG: 14,               // --radius-lg
    borderRadiusSM: 4,                // --radius-sm

    // 间距
    paddingContentHorizontal: 24,
  },
  components: {
    Menu: {
      darkItemBg: '#1E1B18',           // --color-deep
      darkItemSelectedBg: '#2A2520',   // --color-deep-light
      darkItemColor: '#DED9D0',        // --gray-200
      darkItemSelectedColor: '#C4A265',// --color-gold
    },
    Card: {
      boxShadow: '0 1px 3px rgba(30, 27, 24, 0.06)',
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
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider theme={theme} locale={zhCN}>
        <ThemeProvider>
          <AppProvider>
            <AuthProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </AuthProvider>
          </AppProvider>
        </ThemeProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
