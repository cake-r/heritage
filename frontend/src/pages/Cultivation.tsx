/** 非遗修习之路 — 游戏化学习旅程主页面 */

import { useEffect, useState, Component } from 'react'
import { Card, Typography, Progress, Row, Col, Button, Empty, Spin, Grid, message, Tooltip } from 'antd'
import { TrophyOutlined, FireOutlined, ClockCircleOutlined, CheckCircleFilled, RightOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { TreeChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

import { useCultivation } from '../contexts/CultivationContext'
import { useTheme } from '../contexts/ThemeContext'
import type { SkillTreeProgress } from '../services/cultivation'

// 模块级 echarts 注册 — 若失败则静默降级
try {
  echarts.use([TreeChart, TooltipComponent, CanvasRenderer])
} catch (e) {
  console.warn('ECharts 组件注册失败:', e)
}

// ECharts 安全包装 — 捕获图表渲染错误
class SafeChart extends Component<{ option: any; style?: React.CSSProperties }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Empty
          description="技能树图表暂时不可用"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: 40 }}
        />
      )
    }
    return (
      <ReactEChartsCore
        echarts={echarts}
        option={this.props.option}
        style={this.props.style}
        notMerge
        lazyUpdate
      />
    )
  }
}

const { Title, Text, Paragraph } = Typography
const { useBreakpoint } = Grid

// ECharts 硬编码色板 — light/dark
const CHART_COLORS_LIGHT = ['#B8463A', '#C4A265', '#4A8C5C', '#5B7FA0', '#6B5F52', '#C49A3C']
const CHART_COLORS_DARK = ['#D4726A', '#E0C68A', '#6BAE7C', '#7BA0C0', '#8B7F72', '#D4AA5C']

const TREE_ICONS: Record<string, string> = {
  '鉴宝': '🔍', '创作': '🎨', '问道': '💬', '修复': '🔧', '博学': '📚', '行旅': '🌏',
}

const MODULE_LABELS: Record<string, string> = {
  recognition: '智能识别', generation: '文创生成', chat: '传承人对话',
  restoration: '文物修复', exhibition: '数字展厅', knowledge_graph: '文化图谱',
  workshop: '技艺工坊',
}

const MODULE_ROUTES: Record<string, string> = {
  recognition: '/recognition', generation: '/creative-studio', chat: '/workshop',
  restoration: '/restoration', exhibition: '/exhibition', knowledge_graph: '/knowledge-graph',
  workshop: '/workshop',
}

export default function Cultivation() {
  const { status, quests, weeklyChallenge, loading, refreshQuests, completeQuest, xpAnimation } = useCultivation()
  const { theme } = useTheme()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [completing, setCompleting] = useState<number | null>(null)

  const chartColors = theme === 'dark' ? CHART_COLORS_DARK : CHART_COLORS_LIGHT

  // 构建 ECharts 技能树数据
  const getTreeOption = () => {
    if (!status?.skill_trees) return {}

    const children = status.skill_trees.map((tree: SkillTreeProgress, idx: number) => ({
      name: `${TREE_ICONS[tree.tree_name] || '📋'} ${tree.label}`,
      value: tree.current,
      itemStyle: {
        color: chartColors[idx],
        borderColor: chartColors[idx],
      },
      children: Array.from({ length: 5 }).map((_, levelIdx) => {
        const unlocked = tree.level > levelIdx + 1 || (tree.level === levelIdx + 1 && tree.percentage >= (levelIdx) * 20)
        const thresholds = [5, 10, 20, 50, 100]
        return {
          name: unlocked ? `Lv.${levelIdx + 1} ${tree.label.replace('之路', '')}` : '🔒 未解锁',
          value: unlocked ? (levelIdx + 1) * 20 : 0,
          itemStyle: {
            color: unlocked ? chartColors[idx] : '#999',
            borderColor: unlocked ? chartColors[idx] : '#999',
            borderType: unlocked ? 'solid' : 'dashed',
          },
        }
      }),
    }))

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `${params.name}<br/>进度: ${params.value}`
        },
      },
      series: [{
        type: 'tree',
        data: [{
          name: '非遗修习之路',
          children,
        }],
        top: '5%',
        left: '8%',
        bottom: '5%',
        right: '8%',
        symbolSize: 10,
        orient: 'LR',
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 11,
          color: theme === 'dark' ? '#DED9D0' : '#2C241A',
        },
        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left',
            fontSize: 'var(--text-xs)',
          },
        },
        expandAndCollapse: true,
        animationDuration: 550,
        animationDurationUpdate: 750,
      }],
    }
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!status) {
    return <Empty description="加载修习数据失败" style={{ padding: 80 }} />
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? 16 : 32 }}>
      {/* ================================================================ */}
      {/* 段位横幅 — 5个段位：初窥门径(0) → 略有小成(100) → 融会贯通(300) → 炉火纯青(800) → 一代宗师(2000) */}
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
          {/* 装饰光晕 */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(196,162,101,0.12) 0%, transparent 70%)',
          }} />

          <Row align="middle" gutter={[16, 16]} style={{ position: 'relative', zIndex: 1 }}>
            <Col xs={24} md={16}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 56 }}>
                  {['🥉', '🥈', '🥇', '💎', '👑'][status.rank_index] || '🥉'}
                </span>
                <div>
                  <Title level={2} style={{
                    margin: 0,
                    color: 'var(--color-gold)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: 4,
                    fontSize: isMobile ? 24 : 32,
                  }}>
                    {status.rank}
                  </Title>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-sm)' }}>
                    累计修为 {status.xp} XP
                    {status.xp_to_next > 0 && ` · 距离下一段位还需 ${status.xp_to_next} XP`}
                  </Text>
                </div>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div style={{ textAlign: 'center' }}>
                <Progress
                  type="circle"
                  percent={status.xp_to_next > 0
                    ? Math.round(((status.xp - [0, 100, 300, 800, 2000][status.rank_index]) /
                        ([0, 100, 300, 800, 2000][status.rank_index + 1] - [0, 100, 300, 800, 2000][status.rank_index])) * 100)
                    : 100}
                  size={100}
                  strokeColor={{
                    '0%': '#C4A265',
                    '100%': '#B8463A',
                  }}
                  trailColor="rgba(255,255,255,0.1)"
                  format={pct => `${pct}%`}
                  strokeWidth={8}
                />
              </div>
            </Col>
          </Row>
        </Card>
      </motion.div>

      <Row gutter={[24, 24]}>
        {/* ================================================================ */}
        {/* 技能树图表 (左侧 / 全宽移动端)                                     */}
        {/* ================================================================ */}
        <Col xs={24} lg={14}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card
              title={
                <span style={{ fontFamily: 'var(--font-display)', letterSpacing: 2 }}>
                  <Tooltip title="六艺对应非遗六大技能方向：识·创·联·教·纹·述，每个方向通过任务获得经验值（XP）提升">🌳 六艺技能树</Tooltip>
                </span>
              }
              style={{
                borderRadius: 'var(--radius-lg)',
                marginBottom: 24,
              }}
            >
              <SafeChart
                option={getTreeOption()}
                style={{ height: 400 }}
              />

              {/* 技能树迷你进度 */}
              <Row gutter={[8, 8]} style={{ marginTop: 16 }}>
                {status.skill_trees.map(tree => (
                  <Col xs={12} sm={8} md={4} key={tree.tree_name}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 24 }}>{tree.icon}</span>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginBottom: 4 }}>
                        {tree.label}
                      </div>
                      <Progress
                        percent={tree.percentage}
                        size="small"
                        strokeColor={chartColors[status.skill_trees.indexOf(tree) % chartColors.length]}
                        format={() => `Lv.${tree.level}`}
                        style={{ maxWidth: 80, margin: '0 auto' }}
                      />
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </motion.div>
        </Col>

        {/* ================================================================ */}
        {/* 每日任务 + 每周挑战 (右侧)                                         */}
        {/* ================================================================ */}
        <Col xs={24} lg={10}>
          {/* 每日任务 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FireOutlined style={{ color: 'var(--color-vermilion)' }} />
                  <span style={{ fontFamily: 'var(--font-display)', letterSpacing: 2 }}>今日任务</span>
                </div>
              }
              style={{ borderRadius: 'var(--radius-lg)', marginBottom: 24 }}
            >
              {quests.length === 0 ? (
                <Empty description="今日暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {quests.map(quest => {
                    const isCompleted = quest.status === 'completed'
                    return (
                      <div
                        key={quest.id}
                        onClick={() => {
                          if (!isCompleted) handleComplete(quest.id)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: isCompleted
                            ? '1px solid var(--color-border-light)'
                            : '1px solid var(--color-gold-light)',
                          background: isCompleted
                            ? 'var(--color-paper)'
                            : 'linear-gradient(135deg, rgba(196,162,101,0.06), rgba(184,70,58,0.04))',
                          cursor: isCompleted ? 'default' : 'pointer',
                          opacity: isCompleted ? 0.6 : 1,
                          transition: 'all 0.2s',
                        }}
                      >
                        <span style={{ fontSize: 22, flexShrink: 0 }}>
                          {isCompleted ? <CheckCircleFilled style={{ color: 'var(--color-success)' }} /> : quest.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text strong style={{
                            fontSize: 'var(--text-sm)',
                            color: isCompleted ? 'var(--color-ink-secondary)' : 'var(--color-ink)',
                            display: 'block',
                            textDecoration: isCompleted ? 'line-through' : 'none',
                          }}>
                            {quest.title}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
                            {quest.description}
                          </Text>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span style={{
                              fontSize: 'var(--text-xs)',
                              background: 'var(--color-vermilion)',
                              color: '#fff',
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}>
                              +{quest.xp_reward} XP
                            </span>
                            <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
                              {MODULE_LABELS[quest.module] || quest.module}
                            </Text>
                          </div>
                        </div>
                        {!isCompleted && (
                          <Button
                            size="small"
                            type="primary"
                            loading={completing === quest.id}
                            style={{
                              flexShrink: 0,
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 'var(--text-xs)',
                            }}
                          >
                            完成
                          </Button>
                        )}
                      </div>
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
                    <TrophyOutlined style={{ color: 'var(--color-gold)' }} />
                    <span style={{ fontFamily: 'var(--font-display)', letterSpacing: 2 }}>每周挑战</span>
                  </div>
                }
                style={{
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: 24,
                  border: '1px solid var(--color-gold-light)',
                }}
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
                  <Text type="secondary" style={{ fontSize: 'var(--text-sm)' }}>
                    {weeklyChallenge.description}
                  </Text>
                </div>

                <Progress
                  percent={Math.round((weeklyChallenge.tasks_completed / weeklyChallenge.tasks_total) * 100)}
                  strokeColor="var(--color-gold)"
                  format={() => `${weeklyChallenge.tasks_completed}/${weeklyChallenge.tasks_total}`}
                />

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 12,
                }}>
                  <span style={{ fontSize: 24 }}>{weeklyChallenge.reward_stamp_icon}</span>
                  <div>
                    <Text strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
                      {weeklyChallenge.reward_stamp_name}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
                      <ClockCircleOutlined /> 截止 {weeklyChallenge.expires_at}
                    </Text>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </Col>
      </Row>
    </div>
  )
}
