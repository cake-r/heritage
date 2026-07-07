import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Layout, Grid } from 'antd'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import Header from './Header'
import { useApp } from '../../contexts/AppContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCompanion } from '../../contexts/CompanionContext'
import { useCultivation } from '../../contexts/CultivationContext'
import CompanionFloatButton from '../companion/CompanionFloatButton'
import CompanionDrawer from '../companion/CompanionDrawer'
import AchievementToast from '../cultivation/AchievementToast'
import RankUpCelebration from '../cultivation/RankUpCelebration'

const OnboardingGuide = lazy(() => import('../onboarding/OnboardingGuide'))
import { isOnboardingShown } from '../onboarding/OnboardingGuide'

const { Content, Sider } = Layout
const { useBreakpoint } = Grid

// 统一页面过渡动效 — 国风优雅过渡
const pageTransition = {
  initial: { opacity: 0, y: 24, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -16, filter: 'blur(4px)' },
}

export default function MainLayout() {
  const { sidebarCollapsed } = useApp()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = !screens.md // < 768px

  // Mobile: use Drawer; Desktop: use inline Sider
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const { checkForSuggestions, notifyAction } = useCompanion()
  const { refreshStatus, refreshQuests, checkForAutoCompletions } = useCultivation()

  // 首次登录引导
  const [showOnboarding, setShowOnboarding] = useState(false)
  useEffect(() => {
    if (isAuthenticated && !isOnboardingShown()) {
      // 延迟 1s 等页面渲染完毕
      const t = setTimeout(() => setShowOnboarding(true), 1000)
      return () => clearTimeout(t)
    }
  }, [isAuthenticated])

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

  // 停留触发：同一页面停留 45s 且无对话历史时重新触发
  useEffect(() => {
    if (!isAuthenticated) return
    const timer = setTimeout(() => {
      checkForSuggestions(location.pathname, 'prolonged_stay')
    }, 45_000)
    return () => clearTimeout(timer)
  }, [location.pathname, isAuthenticated, checkForSuggestions])

  // 监听跨页面操作完成事件 (companion)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (isAuthenticated && e.detail?.action) {
        notifyAction(location.pathname, e.detail.action)
      }
    }
    window.addEventListener('companion:action', handler as EventListener)
    return () => window.removeEventListener('companion:action', handler as EventListener)
  }, [isAuthenticated, location.pathname, notifyAction])

  // 修习之路初始化：登录后拉取状态 + 监听 cultivation:check 事件
  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([refreshStatus(), refreshQuests()])
    }
  }, [isAuthenticated, refreshStatus, refreshQuests])

  useEffect(() => {
    const handler = () => {
      if (isAuthenticated) checkForAutoCompletions()
    }
    window.addEventListener('cultivation:check', handler)
    return () => window.removeEventListener('cultivation:check', handler)
  }, [isAuthenticated, checkForAutoCompletions])

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
            padding: isMobile ? 12 : 16,
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
                duration: 0.35,
                ease: [0.16, 1, 0.3, 1], // --ease-out
              }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>

          {/* AI 智能伴游 (仅认证用户) */}
          {isAuthenticated && (
            <>
              <AchievementToast />
              <RankUpCelebration />
              <CompanionFloatButton />
              <CompanionDrawer />
              {showOnboarding && (
                <Suspense fallback={null}>
                  <OnboardingGuide
                    open={showOnboarding}
                    onClose={() => setShowOnboarding(false)}
                  />
                </Suspense>
              )}
            </>
          )}
        </Content>
      </Layout>

    </Layout>
  )
}
