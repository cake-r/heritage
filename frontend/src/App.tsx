import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Skeleton } from 'antd'
import { motion } from 'framer-motion'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/common/ProtectedRoute'

// 公共页面 — 同步加载（首屏关键路径）
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'

// 需登录页面 — 懒加载
const Recognition = lazy(() => import('./pages/Recognition'))
const CreativeStudio = lazy(() => import('./pages/CreativeStudio'))
const Workshop = lazy(() => import('./pages/Workshop'))
const ExhibitionHall = lazy(() => import('./pages/ExhibitionHall'))
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'))
const UserCenter = lazy(() => import('./pages/UserCenter'))
const CustomInheritorWizard = lazy(() => import('./pages/CustomInheritorWizard'))
const DigitalRestoration = lazy(() => import('./pages/DigitalRestoration'))
const CollaborativeRestoration = lazy(() => import('./pages/CollaborativeRestoration'))
const PatternEngine = lazy(() => import('./pages/PatternEngine'))
const Passport = lazy(() => import('./pages/Passport'))
const StoryMode = lazy(() => import('./pages/StoryMode'))
const Cultivation = lazy(() => import('./pages/Cultivation'))
const SearchResults = lazy(() => import('./pages/SearchResults'))
const ExhibitionDetail = lazy(() => import('./pages/ExhibitionDetail'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Admin pages — 懒加载
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminContentReview = lazy(() => import('./pages/admin/ContentReview'))
const AdminUserManagement = lazy(() => import('./pages/admin/UserManagement'))
const AdminTaskMonitor = lazy(() => import('./pages/admin/TaskMonitor'))
const AdminCostDashboard = lazy(() => import('./pages/admin/CostDashboard'))
const AdminConfigPanel = lazy(() => import('./pages/admin/ConfigPanel'))
const AdminDataCockpit = lazy(() => import('./pages/admin/DataCockpit'))
const AdminPromptManager = lazy(() => import('./pages/admin/PromptManager'))

function PageLoader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: 24,
        padding: 40,
      }}
    >
      {/* 模拟页面布局骨架 */}
      <Skeleton.Input active size="large" style={{ width: 280, height: 40, borderRadius: 8 }} />
      <Skeleton active paragraph={{ rows: 1 }} style={{ width: 400 }} />
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ width: 200 }}>
            <Skeleton.Image active style={{ width: 200, height: 140, borderRadius: 12 }} />
            <Skeleton active paragraph={{ rows: 2 }} style={{ marginTop: 8 }} />
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/exhibition" element={
          <Suspense fallback={<PageLoader />}><ExhibitionHall /></Suspense>
        } />
        <Route path="/knowledge-graph" element={
          <Suspense fallback={<PageLoader />}><KnowledgeGraph /></Suspense>
        } />
        <Route path="/search" element={
          <Suspense fallback={<PageLoader />}><SearchResults /></Suspense>
        } />
        <Route path="/exhibition/:id" element={
          <Suspense fallback={<PageLoader />}><ExhibitionDetail /></Suspense>
        } />

        {/* 404 页面 */}
        <Route path="*" element={
          <Suspense fallback={<PageLoader />}><NotFound /></Suspense>
        } />

        {/* 需登录 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/recognition" element={
            <Suspense fallback={<PageLoader />}><Recognition /></Suspense>
          } />
          <Route path="/creative-studio" element={
            <Suspense fallback={<PageLoader />}><CreativeStudio /></Suspense>
          } />
          <Route path="/workshop" element={
            <Suspense fallback={<PageLoader />}><Workshop /></Suspense>
          } />
          <Route path="/workshop/wizard" element={
            <Suspense fallback={<PageLoader />}><CustomInheritorWizard /></Suspense>
          } />
          <Route path="/restoration" element={
            <Suspense fallback={<PageLoader />}><DigitalRestoration /></Suspense>
          } />
          <Route path="/restoration-workbench" element={
            <Suspense fallback={<PageLoader />}><CollaborativeRestoration /></Suspense>
          } />
          <Route path="/pattern-engine" element={
            <Suspense fallback={<PageLoader />}><PatternEngine /></Suspense>
          } />
          <Route path="/passport" element={
            <Suspense fallback={<PageLoader />}><Passport /></Suspense>
          } />
          <Route path="/story-mode" element={
            <Suspense fallback={<PageLoader />}><StoryMode /></Suspense>
          } />
          <Route path="/cultivation" element={
            <Suspense fallback={<PageLoader />}><Cultivation /></Suspense>
          } />
          <Route path="/virtual-inheritor" element={
            <Suspense fallback={<PageLoader />}><Workshop /></Suspense>
          } />
          <Route path="/user-center/:tab?" element={
            <Suspense fallback={<PageLoader />}><UserCenter /></Suspense>
          } />

          {/* 管理后台 */}
          <Route path="/admin" element={
            <Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>
          } />
          <Route path="/admin/content" element={
            <Suspense fallback={<PageLoader />}><AdminContentReview /></Suspense>
          } />
          <Route path="/admin/users" element={
            <Suspense fallback={<PageLoader />}><AdminUserManagement /></Suspense>
          } />
          <Route path="/admin/tasks" element={
            <Suspense fallback={<PageLoader />}><AdminTaskMonitor /></Suspense>
          } />
          <Route path="/admin/costs" element={
            <Suspense fallback={<PageLoader />}><AdminCostDashboard /></Suspense>
          } />
          <Route path="/admin/config" element={
            <Suspense fallback={<PageLoader />}><AdminConfigPanel /></Suspense>
          } />
          <Route path="/admin/cockpit" element={
            <Suspense fallback={<PageLoader />}><AdminDataCockpit /></Suspense>
          } />
          <Route path="/admin/prompts" element={
            <Suspense fallback={<PageLoader />}><AdminPromptManager /></Suspense>
          } />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
