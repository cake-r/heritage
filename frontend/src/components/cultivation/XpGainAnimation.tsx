/** XP 获得动画 — "+{amount} XP" 上浮缩放淡出 */

import { motion, AnimatePresence } from 'framer-motion'
import { useCultivation } from '../../contexts/CultivationContext'

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
          }}
        >
          <span style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--color-gold)',
            fontFamily: 'var(--font-display)',
            textShadow: '0 2px 8px rgba(196, 162, 101, 0.4)',
            letterSpacing: 2,
          }}>
            +{xpAnimation.amount} XP
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
