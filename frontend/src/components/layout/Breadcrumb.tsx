/** 面包屑导航 — 居中显示当前页面位置 */

import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Grid } from 'antd'
import { Home, ChevronRight } from 'lucide-react'

const { useBreakpoint } = Grid

// 路由 → 中文名映射
const ROUTE_MAP: Record<string, string> = {
  '/': '首页',
  '/recognition': '智能识别',
  '/creative-studio': '文创生成',
  '/workshop': '技艺工坊',
  '/workshop/wizard': '创建传承人',
  '/restoration': '文物修复',
  '/restoration-workbench': '修复工作台',
  '/exhibition': '数字展厅',
  '/knowledge-graph': '文化图谱',
  '/passport': '数字护照',
  '/cultivation': '修习之路',
  '/pattern-engine': '纹样引擎',
  '/story-mode': '故事模式',
  '/user-center': '个人中心',
  '/user-center/records': '识别记录',
  '/user-center/works': '生成作品',
  '/user-center/chats': '对话历史',
  '/user-center/restoration': '修复记录',
  '/user-center/favorites': '我的收藏',
  '/user-center/settings': '个人设置',
  '/admin': '管理后台',
  '/admin/content': '内容审核',
  '/admin/users': '用户管理',
  '/admin/tasks': '任务监控',
  '/admin/costs': '成本仪表',
  '/admin/config': '系统配置',
  '/admin/cockpit': '数据驾驶舱',
  '/admin/prompts': '提示词管理',
  '/virtual-inheritor': '传承人对话',
}

export default function Breadcrumb() {
  const location = useLocation()
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const crumbs = useMemo(() => {
    const path = location.pathname
    const parts: { label: string; path: string }[] = []

    // 精确匹配
    if (ROUTE_MAP[path] && path !== '/') {
      parts.push({ label: '首页', path: '/' })
      parts.push({ label: ROUTE_MAP[path], path })
      return parts
    }

    // 子路由匹配（如 /user-center/chats）
    const segments = path.split('/').filter(Boolean)
    if (segments.length >= 2) {
      const parentPath = '/' + segments[0]
      if (ROUTE_MAP[path]) {
        parts.push({ label: '首页', path: '/' })
        parts.push({ label: ROUTE_MAP[parentPath] || segments[0], path: parentPath })
        parts.push({ label: ROUTE_MAP[path], path })
        return parts
      }
      // 如 /workshop?persona=xxx
      if (ROUTE_MAP[parentPath]) {
        parts.push({ label: '首页', path: '/' })
        parts.push({ label: ROUTE_MAP[parentPath], path: parentPath })
        return parts
      }
    }

    // 首页本身
    if (path === '/') {
      parts.push({ label: '首页', path: '/' })
      return parts
    }

    // 兜底
    return [{ label: '首页', path: '/' }]
  }, [location.pathname])

  // 移动端仅显示当前页
  if (isMobile && crumbs.length > 0) {
    const last = crumbs[crumbs.length - 1]
    return (
      <span style={{
        fontSize: 'var(--text-sm)',
        fontWeight: 600,
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-display)',
        whiteSpace: 'nowrap',
      }}>
        {last.label}
      </span>
    )
  }

  return (
    <nav aria-label="面包屑导航" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'nowrap',
      overflow: 'hidden',
    }}>
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1
        return (
          <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            {idx > 0 && (
              <ChevronRight size={14} style={{ color: 'var(--color-border-medium)', flexShrink: 0 }} />
            )}
            {idx === 0 && !isLast && (
              <Home size={14} style={{ color: 'var(--color-gold)', flexShrink: 0, marginRight: 2 }} />
            )}
            {isLast ? (
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-gold)',
                fontFamily: 'var(--font-display)',
                letterSpacing: 1,
              }}>
                {crumb.label}
              </span>
            ) : (
              <span
                onClick={() => navigate(crumb.path)}
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-ink-secondary)',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-vermilion)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-secondary)')}
              >
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
