/** 技能进度卡片 — 单条技能树详情 */

import { Card, Progress, Typography, Grid } from 'antd'
import { motion } from 'framer-motion'
import type { SkillTreeProgress } from '../../services/cultivation'

const { Text } = Typography
const { useBreakpoint } = Grid

/** 各技能每级诗意名称 */
const LEVEL_LABELS: Record<string, string[]> = {
  '鉴宝': ['初识器物', '辨识纹样', '通晓年代', '洞察真伪', '一眼千年'],
  '创作': ['初试笔墨', '临摹古法', '融汇创新', '自成风格', '鬼斧神工'],
  '问道': ['初闻道义', '对谈切磋', '明辨是非', '通达古今', '悟道归真'],
  '修复': ['清理浮尘', '修复裂痕', '补全缺失', '重现光彩', '妙手回春'],
  '博学': ['初涉门类', '广览群艺', '融汇贯通', '博古通今', '学贯天人'],
  '行旅': ['初访一省', '穿越南北', '走遍四方', '踏遍神州', '行知天下'],
}

/** 技能颜色 */
export const TREE_COLORS: Record<string, string> = {
  '鉴宝': '#B8463A', '创作': '#C4A265', '问道': '#4A8C5C',
  '修复': '#5B7FA0', '博学': '#6B5F52', '行旅': '#C49A3C',
}

export const TREE_ICONS: Record<string, string> = {
  '鉴宝': '🔍', '创作': '🎨', '问道': '💬',
  '修复': '🔧', '博学': '📚', '行旅': '🌏',
}

interface Props {
  tree: SkillTreeProgress
}

export default function SkillProgressCard({ tree }: Props) {
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const color = TREE_COLORS[tree.tree_name] || '#B8463A'
  const levelLabel = LEVEL_LABELS[tree.tree_name]?.[tree.level - 1] || `Lv.${tree.level}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card
        size="small"
        style={{
          borderRadius: 'var(--radius-md)',
          borderLeft: `3px solid ${color}`,
          transition: 'box-shadow 0.2s',
        }}
        hoverable
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* 图标 */}
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${color}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            {TREE_ICONS[tree.tree_name] || '📋'}
          </div>

          {/* 内容 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'baseline', marginBottom: 4,
            }}>
              <Text strong style={{ fontSize: 'var(--text-sm)' }}>
                {tree.label}
              </Text>
              <Text style={{
                fontSize: 'var(--text-xs)',
                color,
                fontWeight: 600,
                fontFamily: 'var(--font-display)',
              }}>
                Lv.{tree.level}
              </Text>
            </div>

            <Text type="secondary" style={{ fontSize: 'var(--text-xs)', display: 'block', marginBottom: 6 }}>
              {levelLabel}
            </Text>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Progress
                percent={tree.percentage}
                size="small"
                strokeColor={color}
                trailColor="var(--color-border-light)"
                style={{ flex: 1, marginBottom: 0 }}
                showInfo={false}
              />
              <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {tree.current}/{tree.threshold}
              </Text>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
