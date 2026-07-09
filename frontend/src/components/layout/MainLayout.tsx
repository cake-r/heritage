import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
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
import { BrocadePattern } from '../decoration'
import { useNavigationDirection, type NavDirection } from '../../hooks/useNavigationDirection'

const OnboardingGuide = lazy(() => import('../onboarding/OnboardingGuide'))
import { isOnboardingShown } from '../onboarding/OnboardingGuide'

// ===== 侧边栏浮金粒子 =====
const SIDEBAR_PARTICLE_COUNT = 25

function SidebarGoldParticles({ collapsed }: { collapsed: boolean }) {
  const particles = useMemo(() =>
    Array.from({ length: SIDEBAR_PARTICLE_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      bottom: Math.random() * 100,
      size: 2 + Math.random() * 5,
      delay: Math.random() * 8,
      duration: 3 + Math.random() * 6,
      opacity: 0.15 + Math.random() * 0.4,
    })),
  [])

  // 收起时降低粒子数量
  const visibleParticles = collapsed ? particles.slice(0, 8) : particles

  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1,
    }}>
      {visibleParticles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            bottom: `${p.bottom}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(196,162,101,${p.opacity}) 0%, transparent 70%)`,
            boxShadow: `0 0 ${p.size * 3}px rgba(196,162,101,${p.opacity * 0.6})`,
            animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

const { Content, Sider } = Layout
const { useBreakpoint } = Grid

// ── 方向性页面过渡（纯 GPU 属性：x + opacity） ──
const SLIDE_DISTANCE = 50 // px，滑动距离
const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] }

const slideVariants: Record<NavDirection, {
  initial: Record<string, number>
  animate: Record<string, number>
  exit: Record<string, number>
}> = {
  forward: {
    initial: { x: SLIDE_DISTANCE, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -SLIDE_DISTANCE, opacity: 0 },
  },
  back: {
    initial: { x: -SLIDE_DISTANCE, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: SLIDE_DISTANCE, opacity: 0 },
  },
  same: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
}

export default function MainLayout() {
  const { sidebarCollapsed } = useApp()
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = !screens.md // < 768px
  const navDirection = useNavigationDirection(location.pathname)

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
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
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
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 织锦暗纹 — 极低透明度金色 */}
          <BrocadePattern
            opacity={0.08}
            color="var(--color-gold)"
            size={sidebarCollapsed ? 40 : 56}
          />
          {/* 浮金粒子 */}
          <SidebarGoldParticles collapsed={sidebarCollapsed} />
          {/* 鎏金渐变右边线 */}
          <div aria-hidden="true" style={{
            position: 'absolute',
            top: 0, bottom: 0, right: 0,
            width: 2,
            background: `linear-gradient(180deg,
              transparent 0%,
              var(--color-gold) 15%,
              var(--color-vermilion) 50%,
              var(--color-gold) 85%,
              transparent 100%)`,
            zIndex: 1,
          }} />
          <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
            <Sidebar collapsed={sidebarCollapsed} onNavigate={handleNavigate} />
          </div>
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

      <Layout style={{ overflow: 'hidden' }}>
        <Header
          isMobile={isMobile}
          onMobileMenuClick={() => setMobileDrawerOpen(true)}
        />
        <Content
          style={{
            padding: isMobile ? 12 : 16,
            background: 'var(--color-paper)',
            minHeight: `calc(100vh - 64px)`,
            overflowY: 'auto',
            transition: `background var(--duration-normal) var(--ease-out)`,
          }}
        >
          <AnimatePresence mode="popLayout">
            <motion.div
              key={location.pathname}
              initial={slideVariants[navDirection].initial}
              animate={slideVariants[navDirection].animate}
              exit={slideVariants[navDirection].exit}
              transition={TRANSITION}
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
