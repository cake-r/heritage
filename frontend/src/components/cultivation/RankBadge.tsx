/** Header 段位徽章 — 显示段位图标 + 紧凑 XP 进度条 */

import { Progress } from 'antd'
import { Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCultivation } from '../../contexts/CultivationContext'

const RANK_ICONS: Record<number, string> = {
  0: '🥉',
  1: '🥈',
  2: '🥇',
  3: '💎',
  4: '👑',
}

export default function RankBadge() {
  const navigate = useNavigate()
  const { status } = useCultivation()

  if (!status) return null

  const icon = RANK_ICONS[status.rank_index] || '🥉'
  const xpProgress = status.xp_to_next > 0
    ? Math.round(((status.xp - (status.xp_to_next > 0 ? status.xp - (status.xp % 100) : 0)) / Math.max(1, status.xp + status.xp_to_next)) * 100)
    : 100

  // XP thresholds for ranks
  const thresholds = [0, 100, 300, 800, 2000]
  const currentThreshold = thresholds[status.rank_index] || 0
  const nextThreshold = thresholds[status.rank_index + 1] || currentThreshold + 1
  const progressPct = Math.round(((status.xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100)

  return (
    <div
      onClick={() => navigate('/cultivation')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        padding: '4px 10px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(196, 162, 101, 0.08)',
        border: '1px solid rgba(196, 162, 101, 0.2)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196, 162, 101, 0.15)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(196, 162, 101, 0.08)' }}
      title={`${status.rank} · ${status.xp} XP`}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 64 }}>
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--color-gold)',
          lineHeight: 1.2,
        }}>
          {status.rank}
        </span>
        <Progress
          percent={progressPct}
          size="small"
          showInfo={false}
          strokeColor="var(--color-gold)"
          trailColor="rgba(196, 162, 101, 0.15)"
          style={{ margin: 0, lineHeight: 1 }}
        />
      </div>
    </div>
  )
}
