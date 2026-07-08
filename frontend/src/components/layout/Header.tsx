import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout, Button, Dropdown, Space, Tag } from 'antd'
import {
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  User,
  LogOut,
  LogIn,
  Sun,
  Moon,
  Search,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useApp } from '../../contexts/AppContext'
import { useTheme } from '../../contexts/ThemeContext'
import RankBadge from '../cultivation/RankBadge'
import XpGainAnimation from '../cultivation/XpGainAnimation'
import Breadcrumb from './Breadcrumb'
import CommandPalette from './CommandPalette'
import NotificationCenter from './NotificationCenter'

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

  const [searchOpen, setSearchOpen] = useState(false)

  // 全局快捷键 Ctrl+K 打开搜索
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setSearchOpen(prev => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const userMenuItems = [
    { key: 'profile', icon: <User size={18} />, label: '个人中心', onClick: () => navigate('/user-center') },
    { key: 'logout', icon: <LogOut size={18} />, label: '退出登录', onClick: logout },
  ]

  return (
    <>
      <AntHeader
        style={{
          background: 'var(--color-paper-white)',
          padding: isMobile ? '0 12px' : '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--gray-100)',
          height: 64,
          boxShadow: 'var(--shadow-sm)',
          transition: 'background var(--duration-normal) var(--ease-out)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          gap: isMobile ? 8 : 16,
        }}
      >
        {/* ======== 左侧：侧栏切换 + 品牌 ======== */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isMobile ? (
            <Button
              type="text"
              icon={<Menu size={20} />}
              onClick={onMobileMenuClick}
              aria-label="打开菜单"
            />
          ) : (
            <Button
              type="text"
              icon={sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            />
          )}
          {/* 品牌标识 — 侧栏收起时显示 */}
          {!isMobile && sidebarCollapsed && (
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-md)',
              color: 'var(--color-ink)',
              fontWeight: 600,
              letterSpacing: 2,
              whiteSpace: 'nowrap',
            }}>
              🏮 非遗
            </span>
          )}
        </div>

        {/* ======== 中间：面包屑导航 ======== */}
        {!isMobile && (
          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <Breadcrumb />
          </div>
        )}

        {/* ======== 右侧：操作区 ======== */}
        <Space size={isMobile ? 4 : 'middle'} style={{ flexShrink: 0 }}>
          {/* 全局搜索 */}
          <Button
            type="text"
            icon={<Search size={18} />}
            onClick={() => setSearchOpen(true)}
            aria-label="全局搜索 (Ctrl+K)"
            title="全局搜索 (Ctrl+K)"
          />

          {/* 通知中心（仅认证用户） */}
          {isAuthenticated && <NotificationCenter />}

          {/* 修习段位 */}
          {isAuthenticated && <RankBadge />}

          {/* 暗亮模式切换 */}
          <Button
            type="text"
            icon={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
            title={theme === 'dark' ? '亮色模式' : '暗色模式'}
          />

          {mockMode && (
            <Tag color="warning" style={{ margin: 0, fontSize: 'var(--text-xs)' }}>
              离线演示
            </Tag>
          )}

          {isAuthenticated ? (
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button type="text" icon={<User size={18} />}>
                {!isMobile && (user?.nickname || user?.username)}
              </Button>
            </Dropdown>
          ) : (
            <Button
              type="primary"
              icon={<LogIn size={18} />}
              onClick={() => navigate('/login')}
              style={{
                background: 'var(--color-vermilion)',
                borderColor: 'var(--color-vermilion)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {!isMobile && '登录'}
            </Button>
          )}
        </Space>

        {/* XP 获得动画 */}
        <XpGainAnimation />
      </AntHeader>

      {/* 全局搜索命令面板 */}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
