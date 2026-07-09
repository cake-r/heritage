/** 任务自动完成通知 — 固定右上角的 Toast 通知栈 */

import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle } from 'lucide-react'
import { useCultivation } from '../../contexts/CultivationContext'
import { Grid } from 'antd'
import { TREE_ICONS } from './SkillProgressCard'
import { Icon } from '../../config/icons'

const { useBreakpoint } = Grid

export default function AchievementToast() {
  const { notifications, dismissNotification } = useCultivation()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  return (
    <div style={{
      position: 'fixed',
      top: isMobile ? 16 : 80,
      right: isMobile ? 16 : 24,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
      maxWidth: isMobile ? 'calc(100vw - 32px)' : 360,
    }}>
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.quest_id}
            initial={{ x: 300, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 300, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{ pointerEvents: 'auto' }}
            onClick={() => dismissNotification(n.quest_id)}
          >
            <div style={{
              background: 'linear-gradient(135deg, rgba(30,27,24,0.95), rgba(42,37,32,0.95))',
              border: '1px solid rgba(196,162,101,0.3)',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(196,162,101,0.1)',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}>
              {/* 技能图标 */}
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(196,162,101,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>
                <Icon name={TREE_ICONS[n.skill_tree] || 'clipboard-list'} size={20} />
              </div>

              {/* 内容 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.6)',
                  marginBottom: 2,
                }}>
                  <CheckCircle size={16} /> 任务完成
                </div>
                <div style={{
                  fontSize: 'var(--text-sm)',
                  color: '#fff',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {n.title}
                </div>
              </div>

              {/* XP */}
              <div style={{
                flexShrink: 0,
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-gold)',
                fontFamily: 'var(--font-display)',
              }}>
                +{n.xp_gained}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
