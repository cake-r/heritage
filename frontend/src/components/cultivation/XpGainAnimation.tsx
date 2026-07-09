/** 增强版 XP 获得动画 — 梯度金色文字 + 浮动粒子效果 */

import { motion, AnimatePresence } from 'framer-motion'
import { useCultivation } from '../../contexts/CultivationContext'
import { TREE_ICONS } from './SkillProgressCard'
import { Icon } from '../../config/icons'

export default function XpGainAnimation() {
  const { xpAnimation } = useCultivation()

  return (
    <AnimatePresence>
      {xpAnimation?.show && (
        <motion.div
          key="xp-gain"
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: 1, y: -60, scale: 1.2 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            position: 'fixed',
            zIndex: 9999,
            pointerEvents: 'none',
            top: '50%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* 技能图标 */}
          {xpAnimation.skillTree && (
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <Icon name={TREE_ICONS[xpAnimation.skillTree] || 'star'} size={24} />
            </span>
          )}

          {/* XP 数字 — 金色渐变 */}
          <span style={{
            fontSize: 32,
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            background: 'linear-gradient(180deg, #FFD700 0%, #C4A265 50%, #B8463A 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 20px rgba(196,162,101,0.3)',
            letterSpacing: 1,
          }}>
            +{xpAnimation.amount} XP
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
