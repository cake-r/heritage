/** 段位晋升庆祝弹窗 — 全屏遮罩 + 粒子动画 + 过渡效果 */

import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCultivation } from '../../contexts/CultivationContext'

const RANK_ICONS = ['🥉', '🥈', '🥇', '💎', '👑']

export default function RankUpCelebration() {
  const { rankUpCelebration, dismissRankUp } = useCultivation()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Canvas 粒子系统
  const animateParticles = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#C4A265', '#B8463A', '#4A8C5C', '#C9A96E', '#E8B84B']
    interface Particle { x: number; y: number; vx: number; vy: number; size: number; color: string; life: number; maxLife: number }
    const particles: Particle[] = []

    // 初始爆发 100 个粒子
    for (let i = 0; i < 100; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 6
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        maxLife: 80 + Math.random() * 60,
      })
    }

    let frame = 0
    const maxFrames = 150

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      frame++

      for (const p of particles) {
        p.x += p.vx
        p.vy += 0.05 // 重力
        p.y += p.vy
        p.life = 1 - (frame / p.maxLife)

        if (p.life > 0) {
          ctx.globalAlpha = p.life * 0.8
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (frame < maxFrames) {
        requestAnimationFrame(draw)
      }
    }

    requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    if (rankUpCelebration) {
      // 延迟触发粒子，等弹窗动画开始
      const timer = setTimeout(animateParticles, 300)
      // 自动关闭
      const dismiss = setTimeout(dismissRankUp, 5000)
      return () => { clearTimeout(timer); clearTimeout(dismiss) }
    }
  }, [rankUpCelebration, animateParticles, dismissRankUp])

  return (
    <AnimatePresence>
      {rankUpCelebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 11000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            cursor: 'pointer',
          }}
          onClick={dismissRankUp}
        >
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          />

          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.15 }}
            style={{
              background: 'linear-gradient(145deg, #1E1B18, #2A2520)',
              border: '2px solid var(--color-gold)',
              borderRadius: 20,
              padding: '48px 56px',
              textAlign: 'center',
              boxShadow: '0 0 60px rgba(196,162,101,0.3), 0 20px 60px rgba(0,0,0,0.5)',
              maxWidth: 420,
              position: 'relative',
              zIndex: 1,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 晋升文字 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.4 }}
              style={{ fontSize: 64, marginBottom: 16 }}
            >
              👑
            </motion.div>

            <div style={{
              fontSize: 'var(--text-sm)', color: 'var(--color-gold)',
              letterSpacing: 4, marginBottom: 8,
            }}>
              🎉 恭喜晋升
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 16, marginBottom: 8,
            }}>
              <span style={{
                fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.5)',
                textDecoration: 'line-through',
              }}>
                {rankUpCelebration.oldRank}
              </span>
              <span style={{ color: 'var(--color-gold)', fontSize: 24 }}>→</span>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 12, delay: 0.6 }}
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: 'var(--color-gold)',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: 4,
                }}
              >
                {rankUpCelebration.newRank}
              </motion.span>
            </div>

            <div style={{
              fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.4)',
              marginTop: 20,
            }}>
              点击任意处关闭
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
