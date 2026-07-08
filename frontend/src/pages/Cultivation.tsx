/** 非遗修习之路 — 游戏化学习旅程主页面（v2 重设计） */

import { useState } from 'react'
import { Card, Typography, Progress, Row, Col, Button, Empty, Spin, Grid, message, Tag } from 'antd'
import {
  Trophy, Flame, Clock, CheckCircle,
  Loader2,
} from 'lucide-react'
import { motion } from 'framer-motion'

import { useCultivation } from '../contexts/CultivationContext'
import { useTheme } from '../contexts/ThemeContext'
import SkillRadarChart from '../components/cultivation/SkillRadarChart'
import SkillProgressCard, { TREE_COLORS } from '../components/cultivation/SkillProgressCard'
import StreakFlame from '../components/cultivation/StreakFlame'
import type { DailyQuest } from '../services/cultivation'
import { StepBrocadePattern } from '../components/decoration'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

const MODULE_LABELS: Record<string, string> = {
  recognition: '智能识别', generation: '文创生成', chat: '传承人对话',
  restoration: '文物修复', exhibition: '数字展厅', knowledge_graph: '文化图谱',
  workshop: '技艺工坊',
}

// 需要手动完成的任务条件类型（不可追踪）
const MANUAL_CONDITIONS = new Set([
  'voice_playback', 'heatmap_view', 'graph_explore', 'technique_view',
  'sunburst_drill', 'timeline_view', 'choropleth_view', 'verification_view',
  '', // 没有 condition_type 的任务也支持手动完成
])

function isAutoTrackable(quest: DailyQuest): boolean {
  return !!quest.condition_type && !MANUAL_CONDITIONS.has(quest.condition_type)
}

export default function Cultivation() {
  const {
    status, quests, weeklyChallenge, streak, loading,
    completeQuest, triggerXpAnimation,
  } = useCultivation()
  const { theme } = useTheme()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [completing, setCompleting] = useState<number | null>(null)

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{ textAlign: 'center', padding: 120 }}
      >
        <Spin size="large" />
      </motion.div>
    )
  }

  if (!status) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Empty description="加载修习数据失败" style={{ padding: 80 }} />
      </motion.div>
    )
  }

  const handleComplete = async (questId: number) => {
    setCompleting(questId)
    try {
      const result = await completeQuest(questId)
      if (result.new_rank) {
        message.success(`🎉 恭喜晋升为「${result.new_rank}」！`)
      } else {
        message.success(`+${result.xp_gained} XP`)
      }
    } catch (err: any) {
      message.error(err?.message || '任务完成失败')
    } finally {
      setCompleting(null)
    }
  }

  // 段位阈值
  const RANK_THRESHOLDS = [0, 100, 300, 800, 2000]
  const RANK_EMOJIS = ['🥉', '🥈', '🥇', '💎', '👑']
  const rankPercent = status.xp_to_next > 0
    ? Math.round(((status.xp - RANK_THRESHOLDS[status.rank_index]) /
        (RANK_THRESHOLDS[status.rank_index + 1] - RANK_THRESHOLDS[status.rank_index])) * 100)
    : 100

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <StepBrocadePattern opacity={0.22} />
      </div>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? 16 : 32, position: 'relative', zIndex: 1 }}>
      {/* ================================================================ */}
      {/* 段位横幅 */}
      {/* ================================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card
          style={{
            borderRadius: 'var(--radius-lg)',
            marginBottom: 24,
            background: 'linear-gradient(135deg, var(--color-deep) 0%, #2A2520 100%)',
            border: '1px solid var(--color-gold-light)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(196,162,101,0.12) 0%, transparent 70%)',
          }} />

          <Row align="middle" gutter={[16, 16]} style={{ position: 'relative', zIndex: 1 }}>
            <Col xs={24} md={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{
                  animation: 'floatPulse 2s ease-in-out infinite',
                  boxShadow: '0 0 20px rgba(196,162,101,0.2)',
                  borderRadius: '50%',
                  width: 80,
                  height: 80,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 56 }}>
                    {RANK_EMOJIS[status.rank_index] || '🥉'}
                  </span>
                </div>
                <div>
                  <Title level={2} style={{
                    margin: 0,
                    color: 'var(--color-gold)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: 4,
                    fontSize: isMobile ? 26 : 34,
                  }}>
                    {status.rank}
                  </Title>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17 }}>
                    累计修为 {status.xp} XP
                    {status.xp_to_next > 0 && ` · 距离下一段位还需 ${status.xp_to_next} XP`}
                  </Text>
                </div>
              </div>
            </Col>
            <Col xs={24} md={10} style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                <Progress
                  type="circle"
                  percent={rankPercent}
                  size={80}
                  strokeColor={{ '0%': '#C4A265', '100%': '#B8463A' }}
                  trailColor="rgba(255,255,255,0.1)"
                  format={pct => `${pct}%`}
                  strokeWidth={8}
                />
                {streak && (
                  <div>
                    <StreakFlame
                      streakDays={streak.streak_days}
                      longestStreak={streak.longest_streak}
                      bonusActive={streak.streak_bonus_active}
                    />
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card>
      </motion.div>

      <Row gutter={[24, 24]}>
        {/* ================================================================ */}
        {/* 左栏: 雷达图 + 技能卡片 */}
        {/* ================================================================ */}
        <Col xs={24} lg={14}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* 雷达图 */}
            <Card
              title={
                <span style={{ fontFamily: 'var(--font-display)', letterSpacing: 2, fontSize: 20 }}>
                  🕸 六艺技能总览
                </span>
              }
              style={{ borderRadius: 'var(--radius-lg)', marginBottom: 16 }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <SkillRadarChart
                skillTrees={status.skill_trees}
                darkMode={theme === 'dark'}
              />
            </Card>

            {/* 技能进度卡片 3×2 网格 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: 12,
              marginBottom: 24,
            }}>
              {status.skill_trees.map(tree => (
                <SkillProgressCard key={tree.tree_name} tree={tree} />
              ))}
            </div>
          </motion.div>
        </Col>

        {/* ================================================================ */}
        {/* 右栏: 今日任务 + 每周挑战 */}
        {/* ================================================================ */}
        <Col xs={24} lg={10}>
          {/* 今日任务 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Flame style={{ color: 'var(--color-vermilion)' }} />
                  <span style={{ fontFamily: 'var(--font-display)', letterSpacing: 2 }}>今日任务</span>
                  {streak && streak.streak_bonus_active && (
                    <Tag color="gold" style={{ fontSize: 12, marginLeft: 4 }}>
                      连胜加成 +{streak.streak_days >= 7 ? '25' : '10'}%
                    </Tag>
                  )}
                </div>
              }
              style={{ borderRadius: 'var(--radius-lg)', marginBottom: 24 }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              {quests.length === 0 ? (
                <Empty description="今日暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {quests.map((quest, index) => {
                    const isCompleted = quest.status === 'completed'
                    const auto = isAutoTrackable(quest)
                    const progressPct = quest.condition_threshold > 0
                      ? Math.round((quest.condition_progress / quest.condition_threshold) * 100)
                      : 0

                    return (
                      <motion.div
                        key={quest.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.06 }}
                      >
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: isCompleted
                            ? '1px solid var(--color-border-light)'
                            : '1px solid var(--color-gold-light)',
                          background: isCompleted
                            ? 'var(--color-paper)'
                            : 'linear-gradient(135deg, rgba(196,162,101,0.04), rgba(184,70,58,0.03))',
                          opacity: isCompleted ? 0.55 : 1,
                          transition: 'all 0.3s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>
                            {isCompleted
                              ? <CheckCircle style={{ color: 'var(--color-success)' }} className="animate-check-bounce" />
                              : (quest.icon || '📋')
                            }
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text strong style={{
                              fontSize: 17,
                              display: 'block',
                              textDecoration: isCompleted ? 'line-through' : 'none',
                              color: isCompleted ? 'var(--color-ink-secondary)' : 'var(--color-ink)',
                            }}>
                              {quest.title}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 16, display: 'block' }}>
                              {quest.description}
                            </Text>

                            {/* 进度条（可追踪任务） */}
                            {!isCompleted && auto && quest.condition_threshold > 0 && (
                              <div style={{ marginTop: 6 }}>
                                <Progress
                                  percent={Math.min(progressPct, 100)}
                                  size="small"
                                  strokeColor={progressPct >= 100 ? 'var(--color-success)' : TREE_COLORS[quest.skill_tree] || '#B8463A'}
                                  format={() => `${quest.condition_progress}/${quest.condition_threshold}`}
                                  style={{ marginBottom: 0 }}
                                />
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <span style={{
                                fontSize: 16,
                                background: 'var(--color-vermilion)',
                                color: '#fff',
                                padding: '1px 6px',
                                borderRadius: 4,
                              }}>
                                +{quest.xp_reward} XP
                              </span>
                              <Text type="secondary" style={{ fontSize: 16 }}>
                                {MODULE_LABELS[quest.module] || quest.module}
                              </Text>
                              {auto && !isCompleted && (
                                <Loader2 style={{ fontSize: 14, color: 'var(--color-ink-secondary)', marginLeft: 'auto' }} />
                              )}
                            </div>
                          </div>

                          {/* 手动完成按钮（仅不可追踪任务） */}
                          {!isCompleted && !auto && (
                            <Button
                              size="small"
                              type="primary"
                              loading={completing === quest.id}
                              style={{
                                flexShrink: 0, borderRadius: 'var(--radius-sm)',
                                fontSize: 16,
                              }}
                              onClick={() => handleComplete(quest.id)}
                            >
                              完成
                            </Button>
                          )}
                        </div>
                      </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </Card>
          </motion.div>

          {/* 每周挑战 */}
          {weeklyChallenge && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Trophy style={{ color: 'var(--color-gold)' }} />
                    <span style={{ fontFamily: 'var(--font-display)', letterSpacing: 2 }}>每周挑战</span>
                  </div>
                }
                style={{
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: 24,
                  border: '1px solid var(--color-gold-light)',
                }}
                styles={{ body: { padding: '16px' } }}
              >
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 40 }}>{weeklyChallenge.reward_stamp_icon}</span>
                  <Title level={4} style={{
                    margin: '8px 0 4px',
                    fontFamily: 'var(--font-display)',
                    color: 'var(--color-gold)',
                    letterSpacing: 2,
                  }}>
                    {weeklyChallenge.theme}
                  </Title>
                  <Text type="secondary" style={{ fontSize: 17 }}>
                    {weeklyChallenge.description}
                  </Text>
                </div>

                <Progress
                  percent={Math.round((weeklyChallenge.tasks_completed / weeklyChallenge.tasks_total) * 100)}
                  strokeColor="var(--color-gold)"
                  format={() => `${weeklyChallenge.tasks_completed}/${weeklyChallenge.tasks_total}`}
                />

                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8, marginTop: 12,
                }}>
                  <span style={{ fontSize: 24 }}>{weeklyChallenge.reward_stamp_icon}</span>
                  <div>
                    <Text strong style={{ fontSize: 17, color: 'var(--color-ink)' }}>
                      {weeklyChallenge.reward_stamp_name}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 16 }}>
                      <Clock /> 截止 {weeklyChallenge.expires_at}
                    </Text>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </Col>
      </Row>
    </div>
    </>
  )
}
