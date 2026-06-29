/** 数字文博护照页面 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Empty, Progress, Card, Button, Tag, Tooltip, Row, Col } from 'antd'
import {
  ReloadOutlined,
  RightOutlined,
  CrownOutlined,
  StarOutlined,
  FireOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import {
  getPassportStatus,
  listEarnedStamps,
  type PassportStatus,
  type EarnedStamp,
} from '../../services/passport'

// 22枚印章的完整定义（含未获得时的占位信息）
const ALL_STAMPS_DEF: Record<string, { icon: string; name: string; description: string; rarity: string; module: string }> = {
  first_recognition: { icon: '🔍', name: '初识非遗', description: '完成第一次图像识别', rarity: 'common', module: 'recognition' },
  category_explorer: { icon: '🧭', name: '品类探索者', description: '识别过5种不同品类的非遗项目', rarity: 'rare', module: 'recognition' },
  master_observer: { icon: '🔬', name: '鉴宝大师', description: '单次识别置信度达到95%以上', rarity: 'epic', module: 'recognition' },
  first_creation: { icon: '🎨', name: '初试文创', description: '完成第一次AI文创作品生成', rarity: 'common', module: 'generation' },
  style_collector: { icon: '🎭', name: '风格收藏家', description: '使用过5种以上不同的创作风格', rarity: 'rare', module: 'generation' },
  prolific_creator: { icon: '🏭', name: '多产创作者', description: '累计生成20件以上文创作品', rarity: 'epic', module: 'generation' },
  first_dialogue: { icon: '💬', name: '初会话知音', description: '与非遗传承人完成第一次对话', rarity: 'common', module: 'workshop' },
  tool_master: { icon: '🛠️', name: '工具大师', description: '使用过全部4种工具', rarity: 'rare', module: 'workshop' },
  deep_conversationalist: { icon: '📜', name: '深谈知己', description: '与传承人累计对话超过100条', rarity: 'epic', module: 'workshop' },
  first_visit: { icon: '🏛️', name: '初探展馆', description: '首次浏览数字展厅', rarity: 'common', module: 'exhibition' },
  category_collector: { icon: '📚', name: '品类藏家', description: '浏览过8种以上不同品类的藏品', rarity: 'rare', module: 'exhibition' },
  century_witness: { icon: '👁️', name: '千年见证', description: '收藏30件以上的藏品或作品', rarity: 'epic', module: 'exhibition' },
  graph_explorer: { icon: '🗺️', name: '图谱探险家', description: '首次探索文化知识图谱', rarity: 'common', module: 'knowledge_graph' },
  region_explorer: { icon: '🌏', name: '地域游历者', description: '探索过5个以上不同省份的非遗分布', rarity: 'rare', module: 'knowledge_graph' },
  technique_scholar: { icon: '🎓', name: '技法学士', description: '深入了解10种以上非遗技法', rarity: 'epic', module: 'knowledge_graph' },
  first_restoration: { icon: '💎', name: '初试修复', description: '完成第一次文物数字修复', rarity: 'common', module: 'restoration' },
  master_restorer: { icon: '⚒️', name: '修复大师', description: '累计完成5次以上文物修复', rarity: 'rare', module: 'restoration' },
  perfectionist: { icon: '⭐', name: '至臻修复', description: '修复质量评分达到90分以上', rarity: 'epic', module: 'restoration' },
}

const RARITY_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  common: { color: '#6B5F52', bg: '#F5F2EC', label: '普通', icon: <StarOutlined /> },
  rare: { color: '#4A7FB5', bg: '#EEF4FA', label: '稀有', icon: <FireOutlined /> },
  epic: { color: '#C4A265', bg: '#FDF8EF', label: '传说', icon: <CrownOutlined /> },
}

const MODULE_LABELS: Record<string, string> = {
  recognition: '智能识别',
  generation: '文创生成',
  workshop: '技艺工坊',
  exhibition: '数字展厅',
  knowledge_graph: '文化图谱',
  restoration: '文物修复',
}

export default function PassportPage() {
  const [status, setStatus] = useState<PassportStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await getPassportStatus()
      setStatus(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // 从后端获取真正的已获得列表
  const [allEarned, setAllEarned] = useState<EarnedStamp[]>([])

  useEffect(() => {
    if (status) {
      listEarnedStamps().then(setAllEarned).catch(() => setAllEarned([]))
    }
  }, [status?.earned_count])

  const earnedTypeSet = new Set(allEarned.map((s: EarnedStamp) => s.type))
  const stampMap = new Map(allEarned.map((s: EarnedStamp) => [s.type, s]))

  // loading
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="加载护照数据..." />
      </div>
    )
  }

  // error
  if (error || !status) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Empty description="加载失败">
          <Button icon={<ReloadOutlined />} onClick={loadStatus}>重试</Button>
        </Empty>
      </div>
    )
  }

  // empty (new user with 0 stamps)
  const isEmpty = status.earned_count === 0

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      {/* 标题区域 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 40 }}
      >
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-2xl)',
          color: 'var(--color-ink)',
          marginBottom: 8,
          letterSpacing: 2,
        }}>
          🏮 数字文博护照
        </h1>
        <p style={{ color: 'var(--color-ink-secondary)', fontSize: 'var(--text-sm)' }}>
          探索非遗世界，集齐所有印章，成为真正的文化守护者
        </p>
      </motion.div>

      {/* 完成度圆环 + 稀有度统计 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ marginBottom: 40 }}
      >
        <Row gutter={24} align="middle">
          <Col xs={24} md={10} style={{ textAlign: 'center' }}>
            <Progress
              type="circle"
              percent={status.completion_percentage}
              size={180}
              strokeColor={{
                '0%': '#C4A265',
                '100%': '#B8463A',
              }}
              format={(pct) => (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {pct?.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-ink-secondary)' }}>
                    {status.earned_count}/{status.total_stamps}
                  </div>
                </div>
              )}
            />
          </Col>
          <Col xs={24} md={14}>
            <Row gutter={[12, 12]}>
              <Col span={8}>
                <Card size="small" styles={{ body: { padding: '16px', textAlign: 'center' } }}>
                  <div style={{ fontSize: 24, color: RARITY_CONFIG.common.color, marginBottom: 4 }}>
                    <StarOutlined />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {status.common_count}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-ink-secondary)' }}>普通印章</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" styles={{ body: { padding: '16px', textAlign: 'center' } }}>
                  <div style={{ fontSize: 24, color: RARITY_CONFIG.rare.color, marginBottom: 4 }}>
                    <FireOutlined />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {status.rare_count}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-ink-secondary)' }}>稀有印章</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" styles={{ body: { padding: '16px', textAlign: 'center' } }}>
                  <div style={{ fontSize: 24, color: RARITY_CONFIG.epic.color, marginBottom: 4 }}>
                    <CrownOutlined />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {status.epic_count}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-ink-secondary)' }}>传说印章</div>
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </motion.div>

      {/* 空状态引导 */}
      {isEmpty && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ textAlign: 'center', marginBottom: 40 }}
        >
          <Empty description="尚无印章，开始你的非遗探索之旅吧！">
            <Button type="primary" icon={<RightOutlined />} onClick={() => navigate('/recognition')}>
              去识别第一件非遗
            </Button>
          </Empty>
        </motion.div>
      )}

      {/* 印章网格 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-lg)',
          color: 'var(--color-ink)',
          marginBottom: 20,
          paddingBottom: 8,
          borderBottom: '2px solid var(--color-border-light)',
        }}>
          印章收集册
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 16,
        }}>
          {Object.entries(ALL_STAMPS_DEF).map(([type, def], idx) => {
            const earned = stampMap.get(type)
            const isEarned = earnedTypeSet.has(type)

            return (
              <Tooltip
                key={type}
                title={
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{def.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{def.description}</div>
                    {isEarned && earned && (
                      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>
                        获得于 {new Date(earned.earned_at).toLocaleDateString('zh-CN')}
                      </div>
                    )}
                    {!isEarned && (
                      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.6 }}>
                        来自: {MODULE_LABELS[def.module] || def.module}
                      </div>
                    )}
                  </div>
                }
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: idx * 0.03 }}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    cursor: 'default',
                    border: isEarned
                      ? `2px solid ${RARITY_CONFIG[def.rarity]?.color || '#C4A265'}`
                      : '2px dashed var(--color-border-medium)',
                    background: isEarned
                      ? (RARITY_CONFIG[def.rarity]?.bg || '#FDF8EF')
                      : 'var(--color-paper)',
                    opacity: isEarned ? 1 : 0.45,
                    transition: 'all var(--duration-normal) var(--ease-out)',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 28, filter: isEarned ? 'none' : 'grayscale(100%)' }}>
                    {def.icon}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: isEarned ? 'var(--color-ink)' : 'var(--color-ink-tertiary)',
                    fontWeight: 500,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}>
                    {def.name}
                  </span>
                  {isEarned && (
                    <Tag
                      color={RARITY_CONFIG[def.rarity]?.color}
                      style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', margin: 0 }}
                    >
                      {RARITY_CONFIG[def.rarity]?.label}
                    </Tag>
                  )}
                  {/* earned glow effect */}
                  {isEarned && def.rarity === 'epic' && (
                    <div style={{
                      position: 'absolute',
                      inset: -4,
                      borderRadius: 16,
                      background: `linear-gradient(135deg, rgba(196,162,101,0.3), transparent, rgba(196,162,101,0.3))`,
                      filter: 'blur(8px)',
                      zIndex: -1,
                    }} />
                  )}
                </motion.div>
              </Tooltip>
            )
          })}
        </div>
      </motion.div>

      {/* 最近获得 */}
      {status.last_earned.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{ marginTop: 40 }}
        >
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            color: 'var(--color-ink)',
            marginBottom: 16,
          }}>
            最近获得
          </h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {status.last_earned.slice(0, 5).map((stamp: EarnedStamp) => (
              <Card
                key={stamp.type}
                size="small"
                styles={{ body: { padding: '12px 16px' } }}
                style={{
                  borderColor: RARITY_CONFIG[stamp.rarity]?.color,
                  background: RARITY_CONFIG[stamp.rarity]?.bg,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{stamp.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-ink)' }}>
                      {stamp.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-ink-secondary)' }}>
                      {new Date(stamp.earned_at).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <Tag color={RARITY_CONFIG[stamp.rarity]?.color}>
                    {RARITY_CONFIG[stamp.rarity]?.label}
                  </Tag>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
