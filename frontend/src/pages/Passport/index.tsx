/** 数字文博护照页面 — Passport 2.0 */
import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Empty, Progress, Card, Button, Tag, Tooltip, Row, Col, Timeline, message } from 'antd'
import {
  RefreshCw,
  ChevronRight,
  Crown,
  Star,
  Flame,
  Download,
  MapPin,
} from 'lucide-react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts/core'
import {
  getPassportStatus,
  listEarnedStamps,
  fetchTimeline,
  fetchRegions,
  fetchStampConfig,
  type PassportStatus,
  type EarnedStamp,
  type TimelineMilestone,
  type RegionProgress,
  type StampConfig,
} from '../../services/passport'

// ===== 硬编码色值（Canvas 兼容） =====
const INK = '#2C241A'
const INK_SECONDARY = '#6B5F52'
const GOLD = '#C4A265'
const VERMILION = '#B8463A'
const GOLD_LIGHT = '#E8D5B0'
const PAPER = '#FFFDF9'

// 四档地域色阶
const REGION_COLOR_0 = '#F7F4ED'
const REGION_COLOR_LOW = '#E8D5B0'
const REGION_COLOR_MID = '#C4A265'
const REGION_COLOR_HIGH = '#B8463A'

function getRegionColor(value: number): string {
  if (value === 0) return REGION_COLOR_0
  if (value <= 2) return REGION_COLOR_LOW
  if (value <= 5) return REGION_COLOR_MID
  return REGION_COLOR_HIGH
}

const RARITY_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  common: { color: '#6B5F52', bg: '#F5F2EC', label: '普通', icon: <Star /> },
  rare: { color: '#4A7FB5', bg: '#EEF4FA', label: '稀有', icon: <Flame /> },
  epic: { color: '#C4A265', bg: '#FDF8EF', label: '传说', icon: <Crown /> },
}

const MODULE_LABELS: Record<string, string> = {
  recognition: '智能识别',
  generation: '文创生成',
  workshop: '技艺工坊',
  exhibition: '数字展厅',
  knowledge_graph: '文化图谱',
  restoration: '文物修复',
  passport: '数字护照',
  cultivation: '修习之路',
}

// 省份短名→全名映射（用于 DataV GeoJSON 桥接）
const SUFFIXES = ['省', '市', '自治区', '壮族自治区', '回族自治区', '维吾尔自治区', '特别行政区']
function toShortName(fullName: string): string {
  for (const s of SUFFIXES) {
    if (fullName.endsWith(s) && fullName.length > s.length) {
      return fullName.slice(0, -s.length)
    }
  }
  return fullName
}

let chinaGeo: any = null

export default function PassportPage() {
  const [status, setStatus] = useState<PassportStatus | null>(null)
  const [allEarned, setAllEarned] = useState<EarnedStamp[]>([])
  const [timeline, setTimeline] = useState<TimelineMilestone[]>([])
  const [regions, setRegions] = useState<RegionProgress[]>([])
  const [stampConfigs, setStampConfigs] = useState<StampConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [geoLoaded, setGeoLoaded] = useState(false)
  const [exporting, setExporting] = useState(false)
  const passportRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadAll()
  }, [])

  // 加载 GeoJSON
  useEffect(() => {
    if (chinaGeo) { setGeoLoaded(true); return }
    fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
      .then(r => r.json())
      .then(geo => { chinaGeo = geo; setGeoLoaded(true) })
      .catch(() => setGeoLoaded(true))
  }, [])

  const loadAll = async () => {
    setLoading(true)
    setError(false)
    try {
      const [statusData, stampsData, timelineData, regionsData, configData] = await Promise.all([
        getPassportStatus(),
        listEarnedStamps(),
        fetchTimeline(),
        fetchRegions(),
        fetchStampConfig(),
      ])
      setStatus(statusData)
      setAllEarned(stampsData)
      setTimeline(timelineData)
      setRegions(regionsData)
      setStampConfigs(configData)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // 构建短名→全名 nameMap
  const nameMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (!chinaGeo) return map
    for (const feature of chinaGeo.features || []) {
      const fullName = feature.properties?.name || ''
      const shortName = toShortName(fullName)
      if (shortName && shortName !== fullName) {
        map[shortName] = fullName
      }
    }
    return map
  }, [geoLoaded])

  // 地域热力图数据
  const regionMapData = useMemo(() => {
    const regionSet = new Set(regions.map(r => r.region_code))
    const data: { name: string; value: number }[] = []
    if (!chinaGeo) return data
    for (const feature of chinaGeo.features || []) {
      const fullName = feature.properties?.name || ''
      const shortName = toShortName(fullName)
      data.push({
        name: fullName,
        value: regionSet.has(shortName) ? 1 : 0,
      })
    }
    return data
  }, [regions, geoLoaded])

  const earnedTypeSet = new Set(allEarned.map((s: EarnedStamp) => s.type))
  const stampMap = new Map(allEarned.map((s: EarnedStamp) => [s.type, s]))

  // 地域热力图配置
  const mapOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const short = toShortName(params.name || '')
        const hasExplored = params.value > 0
        return `<strong>${short}</strong><br/>${hasExplored ? '✅ 已探索' : '⏳ 尚未探索'}`
      },
    },
    visualMap: {
      min: 0, max: 1,
      inRange: { color: [REGION_COLOR_0, GOLD] },
      show: false,
    },
    geo: {
      map: 'china',
      roam: false,
      label: { show: false },
      itemStyle: {
        areaColor: REGION_COLOR_0,
        borderColor: '#D5CFC0',
        borderWidth: 0.5,
      },
      emphasis: {
        label: { show: true, color: INK },
        itemStyle: { areaColor: GOLD_LIGHT },
      },
    },
    series: [{
      type: 'map',
      map: 'china',
      geoIndex: 0,
      data: regionMapData,
    }],
  }), [regionMapData])

  // 导出护照
  const handleExport = async () => {
    if (!passportRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(passportRef.current, {
        backgroundColor: PAPER,
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `非遗数字护照_${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      message.success('护照已导出！')
    } catch {
      message.error('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

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
          <Button icon={<RefreshCw />} onClick={loadAll}>重试</Button>
        </Empty>
      </div>
    )
  }

  const isEmpty = status.earned_count === 0
  const stampDefs = stampConfigs.length > 0 ? stampConfigs : []

  return (
    <div ref={passportRef} style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 48px' }}>
      {/* 标题区域 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 32, position: 'relative' }}
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
        {/* 导出按钮 */}
        <Button
          icon={<Download />}
          onClick={handleExport}
          loading={exporting}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            borderColor: GOLD,
            color: GOLD,
          }}
        >
          导出护照
        </Button>
      </motion.div>

      {/* 完成度圆环 + 稀有度统计 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ marginBottom: 32 }}
      >
        <Row gutter={24} align="middle">
          <Col xs={24} md={10} style={{ textAlign: 'center' }}>
            <Progress
              type="circle"
              percent={status.completion_percentage}
              size={180}
              strokeColor={{
                '0%': GOLD,
                '100%': VERMILION,
              }}
              format={(pct) => (
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {pct?.toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
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
                    <Star />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {status.common_count}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>普通印章</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" styles={{ body: { padding: '16px', textAlign: 'center' } }}>
                  <div style={{ fontSize: 24, color: RARITY_CONFIG.rare.color, marginBottom: 4 }}>
                    <Flame />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {status.rare_count}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>稀有印章</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" styles={{ body: { padding: '16px', textAlign: 'center' } }}>
                  <div style={{ fontSize: 24, color: RARITY_CONFIG.epic.color, marginBottom: 4 }}>
                    <Crown />
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ink)' }}>
                    {status.epic_count}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>传说印章</div>
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
          style={{ textAlign: 'center', marginBottom: 32 }}
        >
          <Empty description="尚无印章，开始你的非遗探索之旅吧！">
            <Button type="primary" icon={<ChevronRight />} onClick={() => navigate('/recognition')}>
              去识别第一件非遗
            </Button>
          </Empty>
        </motion.div>
      )}

      {/* ── Passport 2.0: 探索时间轴 ── */}
      {timeline.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ marginBottom: 32 }}
        >
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            color: 'var(--color-ink)',
            marginBottom: 16,
            paddingBottom: 8,
            borderBottom: '2px solid var(--color-border-light)',
          }}>
            📜 探索旅程
          </h3>
          <Timeline
            items={timeline.map((m) => ({
              dot: <span style={{ fontSize: 20 }}>{m.icon}</span>,
              children: (
                <div>
                  <div style={{ fontWeight: 600, color: INK, marginBottom: 2 }}>{m.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: INK_SECONDARY }}>{m.description}</div>
                  {m.date && (
                    <div style={{ fontSize: 'var(--text-xs)', color: GOLD, marginTop: 2 }}>
                      {new Date(m.date).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        </motion.div>
      )}

      {/* ── Passport 2.0: 地域探索热力图 ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        style={{ marginBottom: 32 }}
      >
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-lg)',
          color: 'var(--color-ink)',
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: '2px solid var(--color-border-light)',
        }}>
          <MapPin style={{ marginRight: 8 }} />
          地域探索
          {regions.length > 0 && (
            <Tag color={GOLD} style={{ marginLeft: 8 }}>{regions.length} 个省份</Tag>
          )}
        </h3>
        {geoLoaded ? (
          <ReactECharts
            echarts={echarts}
            option={mapOption}
            style={{ height: 360 }}
            opts={{ renderer: 'canvas' }}
          />
        ) : (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="加载地图数据..." />
          </Card>
        )}
        {/* 已探索地域标签 */}
        {regions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {regions.map((r) => (
              <Tag key={r.region_code} color={GOLD} style={{ margin: 0 }}>
                📍 {r.region_code}
              </Tag>
            ))}
          </div>
        )}
      </motion.div>

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
          {stampDefs.map((def, idx) => {
            const earned = stampMap.get(def.type)
            const isEarned = earnedTypeSet.has(def.type)

            return (
              <Tooltip
                key={def.type}
                title={
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{def.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>{def.description}</div>
                    {isEarned && earned && (
                      <div style={{ fontSize: 'var(--text-xs)', marginTop: 4, opacity: 0.6 }}>
                        获得于 {new Date(earned.earned_at).toLocaleDateString('zh-CN')}
                      </div>
                    )}
                    {!isEarned && (
                      <div style={{ fontSize: 'var(--text-xs)', marginTop: 4, opacity: 0.6 }}>
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
                      ? `2px solid ${RARITY_CONFIG[def.rarity]?.color || GOLD}`
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
                    fontSize: 'var(--text-xs)',
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
                      style={{ fontSize: 'var(--text-xs)', lineHeight: '16px', padding: '0 6px', margin: 0 }}
                    >
                      {RARITY_CONFIG[def.rarity]?.label}
                    </Tag>
                  )}
                  {/* epic glow */}
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
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
                      {stamp.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>
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
