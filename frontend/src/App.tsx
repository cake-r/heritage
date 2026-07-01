import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Spin } from 'antd'
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
const Passport = lazy(() => import('./pages/Passport'))
const Cultivation = lazy(() => import('./pages/Cultivation'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Admin pages — 懒加载
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminContentReview = lazy(() => import('./pages/admin/ContentReview'))
const AdminUserManagement = lazy(() => import('./pages/admin/UserManagement'))
const AdminTaskMonitor = lazy(() => import('./pages/admin/TaskMonitor'))
const AdminCostDashboard = lazy(() => import('./pages/admin/CostDashboard'))
const AdminConfigPanel = lazy(() => import('./pages/admin/ConfigPanel'))

function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
    }}>
      <Spin size="large" tip="加载中..." />
    </div>
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
          <Route path="/passport" element={
            <Suspense fallback={<PageLoader />}><Passport /></Suspense>
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
        </Route>
      </Route>
    </Routes>
  )
}

export default App
