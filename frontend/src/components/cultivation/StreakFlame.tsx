/** 连胜火苗指示器 — CSS 火焰动画 + 天数徽章 */

import { Typography, Tooltip } from 'antd'
import { Flame } from 'lucide-react'

const { Text } = Typography

interface Props {
  streakDays: number
  longestStreak: number
  bonusActive: boolean
}

export default function StreakFlame({ streakDays, longestStreak, bonusActive }: Props) {
  const flameSize = streakDays >= 30 ? 22 : streakDays >= 7 ? 18 : 14
  const flameColor = streakDays >= 30 ? '#FF6B35' : streakDays >= 7 ? '#FFD700' : streakDays >= 3 ? '#FFA500' : '#999'

  return (
    <Tooltip title={longestStreak > 0 ? `最长记录: ${longestStreak} 天` : undefined}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 10px',
        borderRadius: 12,
        background: bonusActive ? 'rgba(255,165,0,0.1)' : 'transparent',
        border: bonusActive ? '1px solid rgba(255,165,0,0.2)' : '1px solid transparent',
      }}>
        {/* CSS 火焰 */}
        <span style={{
          display: 'inline-block',
          fontSize: flameSize,
          animation: streakDays > 0 ? 'flameFlicker 0.8s ease-in-out infinite alternate' : 'none',
          filter: bonusActive ? `drop-shadow(0 0 4px ${flameColor})` : 'none',
        }}>
          <Flame size={flameSize} color={flameColor} />
        </span>

        <Text style={{
          fontSize: 'var(--text-xs)',
          color: bonusActive ? flameColor : 'var(--color-ink-secondary)',
          fontWeight: bonusActive ? 600 : 400,
        }}>
          {streakDays > 0 ? `连续 ${streakDays} 天` : '今日首登'}
        </Text>

        {bonusActive && (
          <span style={{
            fontSize: 10,
            background: flameColor,
            color: '#fff',
            padding: '0 4px',
            borderRadius: 4,
            fontWeight: 700,
          }}>
            +{streakDays >= 7 ? '25' : '10'}%
          </span>
        )}
      </div>

      {/* CSS 火焰闪烁 keyframe */}
      <style>{`
        @keyframes flameFlicker {
          0% { transform: scale(1); }
          100% { transform: scale(1.15); }
        }
      `}</style>
    </Tooltip>
  )
}
