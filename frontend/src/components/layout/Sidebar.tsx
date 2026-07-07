import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, Drawer } from 'antd'
import {
  Camera,
  Image,
  MessageCircle,
  Building2,
  GitGraph,
  User,
  Home,
  Wrench,
  IdCard,
  Trophy,
  Settings,
} from 'lucide-react'

interface Props {
  collapsed?: boolean
  mobile?: boolean
  open?: boolean
  onClose?: () => void
  onNavigate?: () => void
}

function getMenuItems(): Array<{ key: string; icon: React.ReactNode; label: string }> {
  const items = [
    { key: '/', icon: <Home size={18} />, label: '首页' },
    { key: '/recognition', icon: <Camera size={18} />, label: '智能识别' },
    { key: '/creative-studio', icon: <Image size={18} />, label: '文创生成' },
    { key: '/workshop', icon: <MessageCircle size={18} />, label: '技艺工坊' },
    { key: '/restoration', icon: <Wrench size={18} />, label: '文物修复' },
    { key: '/exhibition', icon: <Building2 size={18} />, label: '数字展厅' },
    { key: '/knowledge-graph', icon: <GitGraph size={18} />, label: '文化图谱' },
    { key: '/passport', icon: <IdCard size={18} />, label: '数字护照' },
    { key: '/cultivation', icon: <Trophy size={18} />, label: '修习之路' },
    { key: '/user-center', icon: <User size={18} />, label: '个人中心' },
  ]

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role === 'admin') {
      items.push({ key: '/admin', icon: <Settings size={18} />, label: '管理后台' })
    }
  } catch {
    // ignore
  }

  return items
}

export default function Sidebar({ collapsed, mobile, open, onClose, onNavigate }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = getMenuItems()

  const selectedKey = '/' + (location.pathname.split('/')[1] || '')

  const handleMenuClick = (key: string) => {
    navigate(key)
    onNavigate?.()
  }

  const logoContent = (
    <div
      style={{
        padding: collapsed && !mobile ? '20px 8px' : '20px 24px 16px',
        textAlign: 'center',
        color: 'var(--color-gold)',
        fontSize: collapsed && !mobile ? 16 : 20,
        fontWeight: 700,
        letterSpacing: collapsed && !mobile ? 0 : 3,
        fontFamily: 'var(--font-display)',
        borderBottom: '1px solid rgba(196, 162, 101, 0.15)',
        marginBottom: 8,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        transition: 'all var(--duration-normal) var(--ease-out)',
      }}
    >
      {collapsed && !mobile ? '🏮' : '🏮 非遗文创'}
    </div>
  )

  const menuContent = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[selectedKey]}
      items={menuItems}
      onClick={({ key }) => handleMenuClick(key)}
      style={{
        background: 'transparent',
        borderRight: 'none',
        fontSize: 'var(--text-base)',
      }}
      inlineCollapsed={collapsed && !mobile}
    />
  )

  // Mobile: wrap in Drawer
  if (mobile) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        placement="left"
        width={240}
        styles={{
          body: { padding: 0, background: 'var(--color-deep)' },
          header: { display: 'none' },
        }}
      >
        <div style={{
          background: `linear-gradient(180deg, var(--color-deep) 0%, #2A2520 100%)`,
          minHeight: '100vh',
        }}>
          {logoContent}
          {menuContent}
        </div>
      </Drawer>
    )
  }

  // Desktop: inline
  return (
    <div style={{ padding: '16px 0', height: '100%' }}>
      {logoContent}
      {menuContent}
    </div>
  )
}
