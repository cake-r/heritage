import { useNavigate, useLocation } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Drawer, Tooltip } from 'antd'
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
import { BrocadePattern } from '../decoration'
import { Icon } from '../../config/icons'

interface Props {
  collapsed?: boolean
  mobile?: boolean
  open?: boolean
  onClose?: () => void
  onNavigate?: () => void
}

function getMenuItems(): Array<{ key: string; icon: React.ReactNode; label: string }> {
  const items = [
    { key: '/', icon: <Home size={20} />, label: '首页' },
    { key: '/recognition', icon: <Camera size={20} />, label: '智能识别' },
    { key: '/creative-studio', icon: <Image size={20} />, label: '文创生成' },
    { key: '/workshop', icon: <MessageCircle size={20} />, label: '技艺工坊' },
    { key: '/restoration', icon: <Wrench size={20} />, label: '文物修复' },
    { key: '/exhibition', icon: <Building2 size={20} />, label: '数字展厅' },
    { key: '/knowledge-graph', icon: <GitGraph size={20} />, label: '文化图谱' },
    { key: '/passport', icon: <IdCard size={20} />, label: '数字护照' },
    { key: '/cultivation', icon: <Trophy size={20} />, label: '修习之路' },
    { key: '/user-center', icon: <User size={20} />, label: '个人中心' },
  ]

  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.role === 'admin') {
      items.push({ key: '/admin', icon: <Settings size={20} />, label: '管理后台' })
    }
  } catch {
    // ignore
  }

  return items
}

// ===== 金点分隔线 =====
function GoldDotDivider() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: 6,
      padding: '6px 0',
      opacity: 0.3,
    }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: 'var(--color-gold)',
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  )
}

// ===== 水墨渐变菜单项 =====
interface InkMenuItemProps {
  icon: React.ReactNode
  label: string
  active: boolean
  collapsed: boolean
  onClick: () => void
}

function InkMenuItem({ icon, label, active, collapsed, onClick }: InkMenuItemProps) {
  const [hovering, setHovering] = useState(false)

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 12,
    padding: collapsed ? '14px 0' : '12px 16px 12px 20px',
    marginBottom: collapsed ? 2 : 6,
    cursor: 'pointer',
    borderRadius: collapsed ? '8px' : '0 8px 8px 0',
    marginRight: collapsed ? 8 : 12,
    marginLeft: collapsed ? 8 : 0,
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    color: active
      ? 'var(--color-gold)'
      : 'rgba(255,255,255,0.65)',
    background: active
      ? 'linear-gradient(90deg, rgba(196,162,101,0.18) 0%, rgba(196,162,101,0.06) 40%, transparent 100%)'
      : 'transparent',
    transform: hovering && !active ? 'translateX(4px)' : 'translateX(0)',
    boxShadow: hovering && !active
      ? '0 0 12px rgba(196,162,101,0.15)'
      : 'none',
    fontFamily: collapsed ? undefined : 'var(--font-display)',
    fontSize: collapsed ? undefined : 18,
    letterSpacing: collapsed ? undefined : 1,
    justifyContent: collapsed ? 'center' : 'flex-start',
    userSelect: 'none',
  }

  // 选中态左边线
  const activeBar = active && !collapsed && (
    <div style={{
      position: 'absolute',
      left: 0,
      top: '20%',
      bottom: '20%',
      width: 2,
      background: 'var(--color-gold)',
      borderRadius: '0 2px 2px 0',
    }} />
  )

  const content = (
    <div
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {activeBar}
      <span style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'color 0.3s',
        color: active ? 'var(--color-gold)' : undefined,
      }}>
        {icon}
      </span>
      {!collapsed && (
        <span style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: active ? 600 : 400,
          transition: 'font-weight 0.3s',
        }}>
          {label}
        </span>
      )}
    </div>
  )

  // 折叠态：包裹 Tooltip
  if (collapsed) {
    return (
      <Tooltip title={label} placement="right" color="#C4A265">
        {content}
      </Tooltip>
    )
  }

  return content
}

// ===== 移动端侧边栏浮金粒子 =====
const MOBILE_PARTICLE_COUNT = 20

function MobileSidebarParticles() {
  const particles = useMemo(() =>
    Array.from({ length: MOBILE_PARTICLE_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      bottom: Math.random() * 100,
      size: 2 + Math.random() * 5,
      delay: Math.random() * 8,
      duration: 3 + Math.random() * 6,
      opacity: 0.15 + Math.random() * 0.4,
    })),
  [])

  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 1,
    }}>
      {particles.map(p => (
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

export default function Sidebar({ collapsed, mobile, open, onClose, onNavigate }: Props) {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = getMenuItems()

  const selectedKey = '/' + (location.pathname.split('/')[1] || '')

  const handleMenuClick = (key: string) => {
    navigate(key)
    onNavigate?.()
  }

  const sidebarCollapsed = collapsed && !mobile

  const logoContent = (
    <div
      style={{
        padding: sidebarCollapsed ? '20px 8px' : '20px 16px 16px 6px',
        textAlign: 'center',
        color: 'var(--color-gold)',
        fontSize: sidebarCollapsed ? 18 : 35,
        fontWeight: 700,
        letterSpacing: sidebarCollapsed ? 0 : 1,
        fontFamily: 'var(--font-display)',
        borderBottom: '1px solid rgba(196, 162, 101, 0.15)',
        marginBottom: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'clip',
        maxWidth: sidebarCollapsed ? 48 : '100%',
        transition: 'all var(--duration-normal) var(--ease-out)',
      }}
    >
      {sidebarCollapsed ? <Icon name="lantern" size={18} /> : <><Icon name="lantern" size={35} /> 非遗文创</>}
    </div>
  )

  const menuContent = (
    <div style={{ padding: '8px 0' }}>
      {menuItems.map((item, idx) => (
        <div key={item.key}>
          <InkMenuItem
            icon={item.icon}
            label={item.label}
            active={selectedKey === item.key}
            collapsed={sidebarCollapsed}
            onClick={() => handleMenuClick(item.key)}
          />
          {/* 分组分隔：首页后、倒数第二项(个人中心)后 */}
          {(idx === 0 || idx === menuItems.length - 2) && !sidebarCollapsed && (
            <GoldDotDivider />
          )}
        </div>
      ))}
      {sidebarCollapsed && (
        <div style={{ marginTop: 8 }}>
          <GoldDotDivider />
        </div>
      )}
    </div>
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
          position: 'relative',
          overflow: 'hidden',
        }}>
          <BrocadePattern opacity={0.08} color="var(--color-gold)" size={56} />
          <MobileSidebarParticles />
          <div style={{ position: 'relative', zIndex: 2 }}>
            {logoContent}
            {menuContent}
          </div>
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
