import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Typography, Statistic, Space, Button, Grid, Skeleton, Tag } from 'antd'
import {
  CameraOutlined, PictureOutlined, MessageOutlined,
  BankOutlined, NodeIndexOutlined, RightOutlined,
  ArrowDownOutlined, TrophyOutlined, FireOutlined,
  GiftOutlined,
} from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getStatistics, type UserStatistics } from '../services/user'
import { getPassportStatus, type PassportStatus } from '../services/passport'
import { getRecommendationFeed, type RecommendationItem } from '../services/recommendation'
import RecommendationCard from '../components/recommendation/RecommendationCard'
import { normalizeImageUrl } from '../utils/imageUrl'

const { Title, Text, Paragraph } = Typography
const { useBreakpoint } = Grid

// ===== 功能模块配置 =====
const modules = [
  {
    key: 'recognition',
    icon: <CameraOutlined style={{ fontSize: 40 }} />,
    title: '智能识别与讲解',
    desc: '上传非遗图片，AI 智能识别品类并生成文化讲解',
    color: 'var(--color-vermilion)',
  },
  {
    key: 'creative-studio',
    icon: <PictureOutlined style={{ fontSize: 40 }} />,
    title: 'AI 文创生成',
    desc: '文生图 / 图生图，融合国风元素的创意设计',
    color: 'var(--color-gold)',
  },
  {
    key: 'virtual-inheritor',
    icon: <MessageOutlined style={{ fontSize: 40 }} />,
    title: '传承人对话',
    desc: '与 AI 非遗传承人沉浸式对话交流',
    color: 'var(--color-info)',
  },
  {
    key: 'exhibition',
    icon: <BankOutlined style={{ fontSize: 40 }} />,
    title: '数字展厅',
    desc: '浏览 50+ 国家级非遗图文资料',
    color: 'var(--color-success)',
  },
]

// ===== 装饰元素：中式分隔线 =====
function OrnamentDivider() {
  return (
    <div style={{ textAlign: 'center', margin: '32px 0 24px' }} aria-hidden="true">
      <span style={{ color: 'var(--color-gold)', fontSize: 20, letterSpacing: 12, opacity: 0.6 }}>
        ◆ ◇ ◆
      </span>
    </div>
  )
}

// ===== 滚动提示（Hero 底部） =====
function ScrollHint() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.5, duration: 0.8 }}
      style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1 }}
      aria-hidden="true"
    >
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
      >
        <ArrowDownOutlined style={{ color: 'var(--color-gold)', fontSize: 20, opacity: 0.6 }} />
      </motion.div>
    </motion.div>
  )
}

// ================================================================
// 主页面组件
// ================================================================
export default function Home() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { theme } = useTheme()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [stats, setStats] = useState<UserStatistics | null>(null)
  const [itemsCount, setItemsCount] = useState<number>(0)
  const [passportStatus, setPassportStatus] = useState<PassportStatus | null>(null)
  const [dailyItem, setDailyItem] = useState<any>(null)
  const [publicItems, setPublicItems] = useState<any[]>([])
  const [feedItems, setFeedItems] = useState<RecommendationItem[]>([])
  const [feedStatus, setFeedStatus] = useState<string>('cold_start')
  const [feedLoading, setFeedLoading] = useState(false)

  // ===== 数据加载 =====
  useEffect(() => {
    // 展览总数
    import('../services/exhibition').then(({ getItems }) => {
      getItems({ page_size: 1 })
        .then(data => setItemsCount(data.total))
        .catch(() => setItemsCount(50))
    })
    // 每日发现 + 公开展示：获取藏品
    import('../services/exhibition').then(({ getItems }) => {
      getItems({ page_size: 20 })
        .then(data => {
          if (data.items?.length > 0) {
            const pool = data.items
            // 随机选 1 件作为每日发现
            const randomIdx = Math.floor(Math.random() * Math.min(pool.length, 20))
            setDailyItem(pool[randomIdx])
            // 随机取最多 4 件用于公开展示
            const shuffled = [...pool].sort(() => Math.random() - 0.5)
            setPublicItems(shuffled.slice(0, 4))
          }
        })
        .catch(() => { /* 静默降级 */ })
    })
    if (isAuthenticated) {
      getStatistics()
        .then(setStats)
        .catch(() => { /* 静默降级 */ })
      // 护照概览
      getPassportStatus()
        .then(setPassportStatus)
        .catch(() => { /* 静默降级 */ })
      // 个性化推荐流
      setFeedLoading(true)
      getRecommendationFeed(1, 8)
        .then(data => {
          setFeedItems(data.items)
          setFeedStatus(data.profile_status)
        })
        .catch(() => { /* 静默降级 */ })
        .finally(() => setFeedLoading(false))
    }
  }, [isAuthenticated])

  return (
    <div>
      {/* ================================================================ */}
      {/* Hero — 数字文博风                                                */}
      {/* ================================================================ */}
      <div
        className="hero-section"
        style={{
          borderRadius: 'var(--radius-lg)',
          padding: isMobile ? '48px 20px 40px' : '60px 32px 48px',
          marginBottom: 32,
          textAlign: 'center',
          background: theme === 'dark'
            ? 'linear-gradient(165deg, var(--color-deep) 0%, #2A2520 45%, #1E1B18 100%)'
            : 'linear-gradient(165deg, #1E1B18 0%, #2A2420 45%, #1E1B18 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 装饰圆 — 柔和背光 */}
        <div style={{
          position: 'absolute', top: -60, right: -50,
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,162,101,0.10) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: -30,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(184,70,58,0.08) 0%, transparent 70%)',
        }} />

        {/* 中式纹样装饰条 */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: isMobile ? 200 : 300, height: 2,
          background: 'linear-gradient(90deg, transparent, var(--color-gold), transparent)',
          opacity: 0.5,
        }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          {/* 小标题（衬线体） */}
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-gold)',
            letterSpacing: 6,
            textTransform: 'uppercase',
            marginBottom: 12,
            opacity: 0.8,
          }}>
            非物质文化遗产 · 数字交互平台
          </div>

          {/* 大标题 */}
          <Title
            level={1}
            style={{
              color: 'var(--color-gold)',
              fontSize: isMobile ? 28 : 44,
              letterSpacing: isMobile ? 4 : 8,
              marginBottom: 16,
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              lineHeight: 'var(--leading-tight)',
            }}
          >
            非遗数字交互
            <br style={{ display: isMobile ? 'block' : 'none' }} />
            与文创生成
          </Title>

          {/* 副标题 */}
          <Paragraph
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: isMobile ? 15 : 18,
              maxWidth: 640,
              margin: '0 auto 36px',
              lineHeight: 1.8,
            }}
          >
            基于多模态大模型，融合计算机视觉、自然语言处理与 AIGC 技术，
            打造集「识别 · 学习 · 创作 · 对话 · 浏览」于一体的沉浸式非遗文化体验平台
          </Paragraph>

          {/* 统计数字 — 暖金色 */}
          <Row
            gutter={isMobile ? 16 : 48}
            justify="center"
            style={{ marginBottom: 32 }}
          >
            <Col>
              <Statistic
                value={itemsCount}
                suffix="+"
                title={<span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>非遗藏品</span>}
                styles={{
                  content: {
                    color: '#C4A265',
                    fontSize: isMobile ? 24 : 30,
                    fontWeight: 500,
                  },
                }}
              />
            </Col>
            <Col>
              <Statistic
                value={10}
                title={<span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>风格模板</span>}
                styles={{
                  content: {
                    color: '#C4A265',
                    fontSize: isMobile ? 24 : 30,
                    fontWeight: 500,
                  },
                }}
              />
            </Col>
            <Col>
              <Statistic
                value={5}
                title={<span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--text-sm)' }}>传承人角色</span>}
                styles={{
                  content: {
                    color: '#C4A265',
                    fontSize: isMobile ? 24 : 30,
                    fontWeight: 500,
                  },
                }}
              />
            </Col>
          </Row>

          {/* CTA 按钮组 */}
          <Space size={16} wrap>
            <Button
              type="primary"
              size="large"
              icon={<CameraOutlined />}
              onClick={() => navigate(isAuthenticated ? '/recognition' : '/login')}
              style={{
                height: 48,
                fontSize: 'var(--text-base)',
                borderRadius: 'var(--radius-md)',
                paddingLeft: 28,
                paddingRight: 28,
                fontWeight: 500,
                boxShadow: '0 4px 14px rgba(184, 70, 58, 0.35)',
              }}
            >
              {isAuthenticated ? '开始识别' : '立即体验'}
            </Button>
            <Button
              size="large"
              icon={<FireOutlined />}
              onClick={() => navigate(isAuthenticated ? '/story-mode' : '/login')}
              style={{
                height: 48,
                fontSize: 'var(--text-base)',
                borderRadius: 'var(--radius-md)',
                paddingLeft: 28,
                paddingRight: 28,
                fontWeight: 500,
                background: 'linear-gradient(135deg, #C4A265, #B8463A)',
                border: 'none',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(196, 162, 101, 0.45)',
              }}
            >
              ✨ 开始探索
            </Button>
            <Button
              size="large"
              ghost
              icon={<NodeIndexOutlined />}
              onClick={() => navigate('/knowledge-graph')}
              style={{
                height: 48,
                fontSize: 'var(--text-base)',
                borderRadius: 'var(--radius-md)',
                paddingLeft: 28,
                paddingRight: 28,
                color: 'var(--color-gold)',
                borderColor: 'var(--color-gold)',
              }}
            >
              探索文化图谱
            </Button>
          </Space>
        </motion.div>

        <ScrollHint />
      </div>

      {/* ================================================================ */}
      {/* 热门遗产（未认证用户）— Hero 下方直接展示非遗内容                        */}
      {/* ================================================================ */}
      {!isAuthenticated && publicItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ marginBottom: 24 }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FireOutlined style={{ fontSize: 20, color: 'var(--color-vermilion)' }} />
              <Text strong style={{ fontSize: 'var(--text-lg)', color: 'var(--color-ink)', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>
                热门非遗藏品
              </Text>
            </div>
            <Button
              type="link"
              icon={<RightOutlined />}
              onClick={() => navigate('/exhibition')}
              style={{ color: 'var(--color-vermilion)', fontSize: 'var(--text-sm)' }}
            >
              浏览全部
            </Button>
          </div>

          <Row gutter={[16, 16]}>
            {/* 随机展示 4 件藏品 */}
            {publicItems.map((item: any, i: number) => {
              if (!item) return null
              return (
                <Col xs={24} sm={12} lg={6} key={item.id || i}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                  >
                    <Card
                      hoverable
                      onClick={() => navigate(`/exhibition?id=${item.id}`)}
                      style={{
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border-light)',
                        height: '100%',
                      }}
                      cover={
                        item.image_url ? (
                          <div style={{ height: 140, overflow: 'hidden' }}>
                            <img
                              src={normalizeImageUrl(item.image_url)}
                              alt={item.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              loading="lazy"
                            />
                          </div>
                        ) : undefined
                      }
                      styles={{ body: { padding: '12px 14px' } }}
                    >
                      <Text strong style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: 4 }}>
                        {item.name}
                      </Text>
                      <Space size={4} wrap>
                        {item.category && (
                          <Tag style={{ fontSize: 'var(--text-xs)', margin: 0 }}>{item.category}</Tag>
                        )}
                        {item.era && (
                          <Tag style={{ fontSize: 'var(--text-xs)', margin: 0, color: 'var(--color-ink-secondary)' }}>{item.era}</Tag>
                        )}
                      </Space>
                    </Card>
                  </motion.div>
                </Col>
              )
            })}
          </Row>
        </motion.div>
      )}

      {/* ================================================================ */}
      {/* 个性化推荐流（认证用户）— 替代静态欢迎卡片                              */}
      {/* ================================================================ */}
      {isAuthenticated && user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ marginBottom: 24 }}
        >
          {/* 推荐流标题 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GiftOutlined style={{ fontSize: 20, color: 'var(--color-vermilion)' }} />
              <Text strong style={{ fontSize: 'var(--text-lg)', color: 'var(--color-ink)', fontFamily: 'var(--font-display)', letterSpacing: 2 }}>
                为你推荐
              </Text>
              {feedStatus === 'cold_start' && (
                <Tag style={{
                  background: 'var(--color-gold-light)',
                  color: 'var(--color-ink)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                }}>
                  再互动 {Math.max(0, 5 - (stats?.recognition_count || 0) - (stats?.generation_count || 0) - (stats?.chat_count || 0))} 次开启个性化推荐
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 'var(--text-sm)' }}>
              欢迎回来，{user.nickname || user.username}
            </Text>
          </div>

          {/* 推荐卡片网格 */}
          {feedLoading ? (
            <Row gutter={[16, 16]}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Col xs={24} sm={12} lg={6} key={i}>
                  <Card style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <Skeleton.Image style={{ width: '100%', height: 140 }} active />
                    <Skeleton active paragraph={{ rows: 2 }} style={{ padding: '12px 16px' }} />
                  </Card>
                </Col>
              ))}
            </Row>
          ) : feedItems.length > 0 ? (
            <Row gutter={[16, 16]}>
              {feedItems.map((item, i) => (
                <Col xs={24} sm={12} lg={6} key={`${item.item_type}-${item.id}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    style={{ height: '100%' }}
                  >
                    <RecommendationCard item={item} />
                  </motion.div>
                </Col>
              ))}
            </Row>
          ) : (
            /* 无推荐时的回退 — 快速统计概览 */
            stats && (
              <Card
                style={{
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--gray-200)',
                  boxShadow: 'var(--shadow-sm)',
                }}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <Text strong style={{ fontSize: 'var(--text-lg)' }}>
                      欢迎回来，{user.nickname || user.username}
                    </Text>
                    <br />
                    <Text type="secondary">以下是你的活动概览</Text>
                  </div>
                  <Space size={isMobile ? 16 : 40} wrap>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 'var(--text-xl)', color: 'var(--color-vermilion)', display: 'block' }}>
                        {stats.recognition_count}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>识别记录</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 'var(--text-xl)', color: 'var(--color-gold)', display: 'block' }}>
                        {stats.generation_count}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>生成作品</Text>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <Text strong style={{ fontSize: 'var(--text-xl)', color: 'var(--color-info)', display: 'block' }}>
                        {stats.favorite_count}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>收藏</Text>
                    </div>
                  </Space>
                </div>
              </Card>
            )
          )}
        </motion.div>
      )}

      {/* ================================================================ */}
      {/* A. 护照概览微件（仅认证用户）                                      */}
      {/* ================================================================ */}
      {isAuthenticated && passportStatus && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{ marginBottom: 24 }}
        >
          <Card
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <TrophyOutlined style={{ fontSize: 28, color: 'var(--color-gold)' }} />
                <div>
                  <Text strong style={{ fontSize: 'var(--text-md)', color: 'var(--color-ink)' }}>
                    数字文博护照
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
                    已收集 {passportStatus.earned_count}/{passportStatus.total_stamps} 枚印章 · 完成度 {passportStatus.completion_percentage}%
                  </Text>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {passportStatus.last_earned.slice(0, 3).map(stamp => (
                  <span key={stamp.type} style={{ fontSize: 24 }} title={stamp.name}>{stamp.icon}</span>
                ))}
                {passportStatus.last_earned.length === 0 && (
                  <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>开始探索以收集印章</Text>
                )}
              </div>
              <Button
                type="link"
                icon={<RightOutlined />}
                onClick={() => navigate('/passport')}
                style={{ color: 'var(--color-gold)', fontWeight: 500 }}
              >
                查看完整护照
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ================================================================ */}
      {/* B. 每日发现                                                       */}
      {/* ================================================================ */}
      {dailyItem && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          style={{ marginBottom: 24 }}
        >
          <Card
            hoverable
            onClick={() => navigate(`/exhibition?id=${dailyItem.id}&type=${dailyItem.item_type || 'heritage'}`)}
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-light)',
              boxShadow: 'var(--shadow-sm)',
              overflow: 'hidden',
            }}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 140 }}>
              {/* 左侧图片 */}
              <div style={{
                width: isMobile ? '100%' : 200,
                minHeight: isMobile ? 160 : 140,
                background: dailyItem.images?.[0]
                  ? `url(${normalizeImageUrl(dailyItem.images[0])}) center/cover no-repeat`
                  : 'linear-gradient(135deg, var(--color-paper), var(--color-border-light))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {!dailyItem.images?.[0] && (
                  <BankOutlined style={{ fontSize: 40, color: 'var(--color-border-medium)' }} />
                )}
              </div>
              {/* 右侧内容 */}
              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: '#fff',
                    background: 'var(--color-gold)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 500,
                  }}>
                    AI 精选
                  </span>
                  <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>每日发现</Text>
                </div>
                <Text strong style={{ fontSize: 'var(--text-md)', color: 'var(--color-ink)', marginBottom: 4 }}>
                  {dailyItem.name || dailyItem.title}
                </Text>
                <Text type="secondary" style={{ fontSize: 'var(--text-sm)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {dailyItem.description?.slice(0, 120) || '探索这件精美的非遗藏品...'}
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
                    查看详情 <RightOutlined style={{ fontSize: 'var(--text-xs)' }} />
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ================================================================ */}
      {/* C. 修习概览卡片（仅认证用户）                                       */}
      {/* ================================================================ */}
      {isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{ marginBottom: 24 }}
        >
          <Card
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-gold-light)',
              boxShadow: 'var(--shadow-sm)',
              background: 'linear-gradient(135deg, rgba(196,162,101,0.04), rgba(184,70,58,0.02))',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <TrophyOutlined style={{ fontSize: 24, color: 'var(--color-gold)' }} />
                <div>
                  <Text strong style={{ fontSize: 'var(--text-md)', color: 'var(--color-ink)' }}>
                    非遗修习之路
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
                    完成每日任务，积累修为，晋升段位
                  </Text>
                </div>
              </div>
              <Button
                type="primary"
                ghost
                icon={<RightOutlined />}
                onClick={() => navigate('/cultivation')}
                style={{
                  borderColor: 'var(--color-gold)',
                  color: 'var(--color-gold)',
                  fontWeight: 500,
                }}
              >
                查看修习之路
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ================================================================ */}
      {/* D. 旅程进度（仅认证用户）                                          */}
      {/* ================================================================ */}
      {isAuthenticated && stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          style={{ marginBottom: 24 }}
        >
          <Card
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-light)',
              boxShadow: 'var(--shadow-sm)',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <FireOutlined style={{ color: 'var(--color-vermilion)', fontSize: 18 }} />
              <Text strong style={{ fontSize: 'var(--text-md)', color: 'var(--color-ink)' }}>非遗探索旅程</Text>
            </div>
            <Row gutter={[16, 12]}>
              {[
                { label: '智能识别', count: stats.recognition_count, color: '#B8463A', max: 10 },
                { label: '文创生成', count: stats.generation_count, color: '#C4A265', max: 20 },
                { label: '对话交流', count: stats.chat_count, color: '#4A7FB5', max: 10 },
                { label: '收藏', count: stats.favorite_count, color: '#C4A265', max: 30 },
                { label: '修复', count: stats.restoration_count, color: '#6B5F52', max: 5 },
                { label: '印章', count: stats.passport_stamp_count, color: '#C4A265', max: 18 },
              ].map(mod => (
                <Col xs={12} sm={8} md={4} key={mod.label}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: 'var(--text-lg)',
                      fontWeight: 700,
                      color: mod.color,
                    }}>
                      {mod.count}
                    </div>
                    <div style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-ink-secondary)',
                      marginBottom: 4,
                    }}>
                      {mod.label}
                    </div>
                    <div style={{
                      height: 4,
                      background: 'var(--color-border-light)',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.min(100, (mod.count / mod.max) * 100)}%`,
                        height: '100%',
                        background: mod.color,
                        borderRadius: 2,
                        transition: 'width var(--duration-slow) var(--ease-out)',
                      }} />
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </motion.div>
      )}

      {/* ================================================================ */}
      {/* 核心功能卡片                                                     */}
      {/* ================================================================ */}
      <OrnamentDivider />
      <div style={{ marginBottom: 32 }}>
        <Title
          level={3}
          style={{
            textAlign: 'center',
            marginBottom: 8,
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            color: 'var(--color-ink)',
            letterSpacing: 3,
          }}
        >
          核心功能
        </Title>
        <Paragraph
          type="secondary"
          style={{ textAlign: 'center', marginBottom: 32, fontSize: 'var(--text-base)' }}
        >
          五大模块，一站式非遗文化体验
        </Paragraph>

        <Row gutter={[24, 24]}>
          {modules.map((mod, i) => (
            <Col xs={24} sm={12} lg={6} key={mod.key}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%' }}
              >
                <Card
                  hoverable
                  onClick={() => navigate(`/${mod.key}`)}
                  style={{
                    textAlign: 'center',
                    borderRadius: 'var(--radius-lg)',
                    height: '100%',
                    border: '1px solid var(--gray-200)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: `box-shadow var(--duration-normal) var(--ease-out), transform var(--duration-normal) var(--ease-out)`,
                  }}
                  styles={{ body: { padding: '24px 18px' } }}
                  // Card hover effect handled by CSS custom property on parent
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Icon + decorative ring */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: `${mod.color}10`,
                    marginBottom: 16,
                    position: 'relative',
                  }}>
                    <div style={{ color: mod.color }}>{mod.icon}</div>
                  </div>

                  <Title level={4} style={{ fontSize: 'var(--text-md)', marginBottom: 8, color: 'var(--color-ink)' }}>
                    {mod.title}
                  </Title>
                  <Paragraph type="secondary" style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', marginBottom: 16 }}>
                    {mod.desc}
                  </Paragraph>
                  <Button
                    type="link"
                    icon={<RightOutlined />}
                    style={{ color: mod.color, fontWeight: 500 }}
                  >
                    了解更多
                  </Button>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>
      </div>

      {/* ================================================================ */}
      {/* 底部 — 对比度达标                                                 */}
      {/* ================================================================ */}
      <div
        style={{
          textAlign: 'center',
          padding: "28px 16px",
          borderTop: '1px solid var(--gray-200)',
        }}
      >
        <Paragraph
          style={{
            maxWidth: 520,
            margin: '0 auto',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-secondary)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          🏮 非遗数字交互与文创生成系统 · 基于多模态大模型 · 融合 CV / NLP / AIGC 技术
          <br />
          致力于非物质文化遗产的数字化传承
        </Paragraph>
        <div style={{ marginTop: 16 }}>
          <Space size={16}>
            <Button
              type="link"
              icon={<NodeIndexOutlined />}
              onClick={() => navigate('/knowledge-graph')}
              style={{ color: 'var(--color-gold)' }}
            >
              文化图谱
            </Button>
            <Button
              type="link"
              icon={<BankOutlined />}
              onClick={() => navigate('/exhibition')}
              style={{ color: 'var(--color-gold)' }}
            >
              数字展厅
            </Button>
          </Space>
        </div>
      </div>
    </div>
  )
}
