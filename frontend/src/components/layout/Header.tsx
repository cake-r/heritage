import { useNavigate } from 'react-router-dom'
import { Layout, Button, Dropdown, Space, Tag } from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  UserOutlined,
  LogoutOutlined,
  LoginOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons'
import { useAuth } from '../../contexts/AuthContext'
import { useApp } from '../../contexts/AppContext'
import { useTheme } from '../../contexts/ThemeContext'
import RankBadge from '../cultivation/RankBadge'
import XpGainAnimation from '../cultivation/XpGainAnimation'

const { Header: AntHeader } = Layout

interface Props {
  isMobile?: boolean
  onMobileMenuClick?: () => void
}

export default function Header({ isMobile, onMobileMenuClick }: Props) {
  const { user, isAuthenticated, logout } = useAuth()
  const { sidebarCollapsed, mockMode, toggleSidebar } = useApp()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: '个人中心', onClick: () => navigate('/user-center') },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: logout },
  ]

  return (
    <AntHeader
      style={{
        background: 'var(--color-paper-white)',
        padding: isMobile ? '0 16px' : '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--gray-100)',
        height: 64,
        boxShadow: 'var(--shadow-sm)',
        transition: `background var(--duration-normal) var(--ease-out)`,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left: Menu toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isMobile ? (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onMobileMenuClick}
            aria-label="打开菜单"
          />
        ) : (
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          />
        )}
        {/* Brand mark when sidebar is collapsed on desktop */}
        {!isMobile && sidebarCollapsed && (
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            color: 'var(--color-ink)',
            fontWeight: 600,
            letterSpacing: 2,
          }}>
            🏮 非遗
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <Space size="middle">
        {/* 修习之路段位徽章 */}
        {isAuthenticated && <RankBadge />}

        {/* Dark mode toggle */}
        <Button
          type="text"
          icon={theme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
          title={theme === 'dark' ? '亮色模式' : '暗色模式'}
        />

        {mockMode && (
          <Tag color="warning" style={{ margin: 0 }}>
            离线演示
          </Tag>
        )}

        {isAuthenticated ? (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />}>
              {!isMobile && (user?.nickname || user?.username)}
            </Button>
          </Dropdown>
        ) : (
          <Button
            type="primary"
            icon={<LoginOutlined />}
            onClick={() => navigate('/login')}
            style={{
              background: 'var(--color-vermilion)',
              borderColor: 'var(--color-vermilion)',
            }}
          >
            {!isMobile && '登录'}
          </Button>
        )}
      </Space>
      {/* XP 获得动画 */}
      <XpGainAnimation />
    </AntHeader>
  )
}
