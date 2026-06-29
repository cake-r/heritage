import { Routes, Route } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/common/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Recognition from './pages/Recognition'
import CreativeStudio from './pages/CreativeStudio'
import Workshop from './pages/Workshop'
import ExhibitionHall from './pages/ExhibitionHall'
import KnowledgeGraph from './pages/KnowledgeGraph'
import UserCenter from './pages/UserCenter'
import CustomInheritorWizard from './pages/CustomInheritorWizard'
import DigitalRestoration from './pages/DigitalRestoration'
import Passport from './pages/Passport'
import Cultivation from './pages/Cultivation'
import NotFound from './pages/NotFound'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/exhibition" element={<ExhibitionHall />} />
        <Route path="/knowledge-graph" element={<KnowledgeGraph />} />

        {/* 404 页面 */}
        <Route path="*" element={<NotFound />} />

        {/* 需登录 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/recognition" element={<Recognition />} />
          <Route path="/creative-studio" element={<CreativeStudio />} />
          <Route path="/workshop" element={<Workshop />} />
          <Route path="/workshop/wizard" element={<CustomInheritorWizard />} />
          <Route path="/restoration" element={<DigitalRestoration />} />
          <Route path="/passport" element={<Passport />} />
          <Route path="/cultivation" element={<Cultivation />} />
          <Route path="/virtual-inheritor" element={<Workshop />} />
          <Route path="/user-center/:tab?" element={<UserCenter />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
