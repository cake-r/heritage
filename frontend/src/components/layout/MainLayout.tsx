import { useState, useCallback, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Layout, Grid } from 'antd'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import Header from './Header'
import { useApp } from '../../contexts/AppContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCompanion } from '../../contexts/CompanionContext'
import CompanionFloatButton from '../companion/CompanionFloatButton'
import CompanionDrawer from '../companion/CompanionDrawer'

const { Content, Sider } = Layout
const { useBreakpoint } = Grid

// 统一页面过渡动效
const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

export default function MainLayout() {
  const { sidebarCollapsed } = useApp()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = !screens.md // < 768px

  // Mobile: use Drawer; Desktop: use inline Sider
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const { checkForSuggestions } = useCompanion()

  const handleNavigate = useCallback(() => {
    // Close mobile drawer on navigation
    if (isMobile) setMobileDrawerOpen(false)
  }, [isMobile])

  // 页面切换时触发伴游建议检查
  useEffect(() => {
    if (isAuthenticated) {
      checkForSuggestions(location.pathname)
    }
  }, [location.pathname, isAuthenticated, checkForSuggestions])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={sidebarCollapsed}
          trigger={null}
          width={220}
          collapsedWidth={64}
          style={{
            background: `linear-gradient(180deg, var(--color-deep) 0%, #2A2520 100%)`,
            borderRight: `1px solid rgba(196, 162, 101, 0.15)`,
          }}
        >
          <Sidebar collapsed={sidebarCollapsed} onNavigate={handleNavigate} />
        </Sider>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Sidebar
          mobile
          open={mobileDrawerOpen}
          collapsed={false}
          onClose={() => setMobileDrawerOpen(false)}
          onNavigate={handleNavigate}
        />
      )}

      <Layout>
        <Header
          isMobile={isMobile}
          onMobileMenuClick={() => setMobileDrawerOpen(true)}
        />
        <Content
          style={{
            padding: isMobile ? 12 : 24,
            background: 'var(--color-paper)',
            minHeight: `calc(100vh - 64px)`,
            transition: `background var(--duration-normal) var(--ease-out)`,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={pageTransition.initial}
              animate={pageTransition.animate}
              exit={pageTransition.exit}
              transition={{
                duration: 0.2,
                ease: [0.16, 1, 0.3, 1], // --ease-out
              }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>

          {/* AI 智能伴游 (仅认证用户) */}
          {isAuthenticated && (
            <>
              <CompanionFloatButton />
              <CompanionDrawer />
            </>
          )}
        </Content>
      </Layout>

    </Layout>
  )
}
