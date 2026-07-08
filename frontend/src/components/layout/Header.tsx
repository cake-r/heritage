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
import { MeanderPattern } from '../decoration'

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
    { key: 'profile', icon: <User size={25} />, label: '个人中心', onClick: () => navigate('/user-center') },
    { key: 'logout', icon: <LogOut size={25} />, label: '退出登录', onClick: logout },
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
          height: 64,
          transition: 'background var(--duration-normal) var(--ease-out)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          gap: isMobile ? 8 : 16,
          overflow: 'hidden',
          borderBottom: 'none',
        }}
      >
        {/* 极淡织锦暗纹 */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        }}>
          <MeanderPattern opacity={0.25} color="#C4A265" mode="band" cellSize={40} />
        </div>

        {/* 鎏金渐变底线 */}
        <div aria-hidden="true" style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 2,
          background: `linear-gradient(90deg,
            transparent 0%,
            var(--color-gold) 15%,
            var(--color-vermilion) 50%,
            var(--color-gold) 85%,
            transparent 100%)`,
          zIndex: 1,
        }} />

        {/* 内容层 — 覆盖在装饰上方 */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', height: '100%',
        }}>
          {/* ======== 左侧：侧栏切换 + 品牌 ======== */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isMobile ? (
            <Button
              type="text"
              icon={<Menu size={25} />}
              onClick={onMobileMenuClick}
              aria-label="打开菜单"
            />
          ) : (
            <Button
              type="text"
              icon={sidebarCollapsed ? <PanelLeftOpen size={25} /> : <PanelLeftClose size={25} />}
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
            icon={<Search size={25} />}
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
            icon={theme === 'dark' ? <Sun size={25} /> : <Moon size={25} />}
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
              <Button type="text" icon={<User size={25} />}>
                {!isMobile && (user?.nickname || user?.username)}
              </Button>
            </Dropdown>
          ) : (
            <Button
              type="primary"
              icon={<LogIn size={25} />}
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
        </div>
      </AntHeader>

      {/* 全局搜索命令面板 */}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
