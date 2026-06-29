import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, Drawer } from 'antd'
import {
  CameraOutlined,
  PictureOutlined,
  MessageOutlined,
  BankOutlined,
  NodeIndexOutlined,
  UserOutlined,
  HomeOutlined,
  ToolOutlined,
  IdcardOutlined,
  TrophyOutlined,
} from '@ant-design/icons'

interface Props {
  collapsed?: boolean
  mobile?: boolean
  open?: boolean
  onClose?: () => void
  onNavigate?: () => void
}

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/recognition', icon: <CameraOutlined />, label: '智能识别' },
  { key: '/creative-studio', icon: <PictureOutlined />, label: '文创生成' },
  { key: '/workshop', icon: <MessageOutlined />, label: '技艺工坊' },
  { key: '/restoration', icon: <ToolOutlined />, label: '文物修复' },
  { key: '/exhibition', icon: <BankOutlined />, label: '数字展厅' },
  { key: '/knowledge-graph', icon: <NodeIndexOutlined />, label: '文化图谱' },
  { key: '/passport', icon: <IdcardOutlined />, label: '数字护照' },
  { key: '/cultivation', icon: <TrophyOutlined />, label: '修习之路' },
  { key: '/user-center', icon: <UserOutlined />, label: '个人中心' },
]

export default function Sidebar({ collapsed, mobile, open, onClose, onNavigate }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

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
