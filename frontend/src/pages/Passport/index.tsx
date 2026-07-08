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
import { JourneyCloudPattern } from '../../components/decoration'
import { useTheme } from '../../contexts/ThemeContext'
import { DARK_PAPER, DARK_DEEP, DARK_INK, DARK_INK_SECONDARY } from '../../styles/chart-theme'

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
  const [selectedRegion, setSelectedRegion] = useState('')
  const [exporting, setExporting] = useState(false)
  const passportRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    loadAll()
  }, [])

  // 加载 GeoJSON + 注册地图
  useEffect(() => {
    if (chinaGeo) {
      setGeoLoaded(true)
      try { echarts.registerMap('china', chinaGeo) } catch { /* 已注册 */ }
      return
    }
    fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
      .then(r => r.json())
      .then(geo => {
        chinaGeo = geo
        try { echarts.registerMap('china', chinaGeo) } catch { /* ignore */ }
        setGeoLoaded(true)
      })
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

  // 地域热力图数据（二值化：已探索 1 / 未探索 0；item_count 预留未来梯度着色）
  const regionMapData = useMemo(() => {
    const regionSet = new Set(regions.map(r => r.region_code))
    const data: { name: string; value: number }[] = []
    if (!chinaGeo) return data
    for (const feature of chinaGeo.features || []) {
      const fullName = feature.properties?.name || ''
      const shortName = toShortName(fullName)
      data.push({ name: fullName, value: regionSet.has(shortName) ? 1 : 0 })
    }
    return data
  }, [regions, geoLoaded])

  const totalProvinces = useMemo(() => (chinaGeo?.features || []).length, [geoLoaded])

  const latestRegion = useMemo(() => {
    const sorted = [...regions].filter(r => r.unlocked_at).sort(
      (a, b) => new Date(b.unlocked_at!).getTime() - new Date(a.unlocked_at!).getTime()
    )
    return sorted[0] || null
  }, [regions])

  const earnedTypeSet = new Set(allEarned.map((s: EarnedStamp) => s.type))
  const stampMap = new Map(allEarned.map((s: EarnedStamp) => [s.type, s]))

  // 地域热力图配置
  const mapOption = useMemo(() => {
    const areaColor = isDark ? DARK_DEEP : REGION_COLOR_0
    const borderColor = isDark ? '#3A3530' : '#D5CFC0'
    const tooltipBg = isDark ? DARK_PAPER : PAPER
    const tooltipText = isDark ? DARK_INK : INK
    const tooltipSecondary = isDark ? DARK_INK_SECONDARY : INK_SECONDARY
    const tooltipBorder = isDark ? '#3A3530' : GOLD_LIGHT
    const emphasisAreaColor = isDark ? '#4A3A28' : GOLD_LIGHT
    const emphasisLabelColor = isDark ? DARK_INK : INK
    const unexploredColor = isDark ? DARK_DEEP : REGION_COLOR_0

    return {
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      padding: [14, 18],
      extraCssText: 'border-radius:10px;box-shadow:0 4px 16px rgba(30,27,24,0.10);',
      textStyle: {
        color: tooltipText,
        fontSize: 13,
        fontFamily: '"Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif',
      },
      formatter: (params: any) => {
        const short = toShortName(params.name || '')
        const hasExplored = params.value > 0
        const regionData = regions.find(r => r.region_code === short)
        const dateStr = regionData?.unlocked_at
          ? new Date(regionData.unlocked_at).toLocaleDateString('zh-CN')
          : null
        const vermilionColor = isDark ? '#C96B5F' : '#B8463A'
        const grayColor = isDark ? '#A09888' : '#C4BEB4'
        return `
          <div style="font-family:'Noto Serif SC','Source Han Serif SC',SimSun,serif;min-width:150px">
            <div style="font-size:15px;font-weight:600;color:${tooltipText};margin-bottom:8px;border-bottom:1px solid ${tooltipBorder};padding-bottom:6px">
              \u{1F4CD} ${short}
            </div>
            <div style="font-size:13px;color:${tooltipSecondary};margin-bottom:4px">
              状态：<b style="color:${hasExplored ? vermilionColor : tooltipSecondary};font-size:14px">${hasExplored ? '✅ 已探索' : '⏳ 尚未探索'}</b>
            </div>
            ${dateStr ? `<div style="font-size:13px;color:${tooltipSecondary}">解锁于：${dateStr}</div>` : ''}
            ${!hasExplored ? `<div style="font-size:11px;color:${grayColor};margin-top:6px;font-style:italic">继续探索非遗世界…</div>` : ''}
          </div>`
      },
    },
    visualMap: {
      min: 0,
      max: 1,
      pieces: [
        { value: 1, color: GOLD, label: '已探索' },
        { value: 0, color: unexploredColor, label: '未探索' },
      ],
      show: false,
    },
    geo: {
      map: 'china',
      roam: 'scale' as const,
      scaleLimit: { min: 1, max: 3 },
      label: { show: false },
      itemStyle: {
        areaColor,
        borderColor,
        borderWidth: 0.8,
        shadowColor: 'rgba(30,27,24,0.06)',
        shadowBlur: 4,
      },
      emphasis: {
        label: { show: true, color: emphasisLabelColor, fontSize: 13, fontWeight: 600 },
        itemStyle: {
          areaColor: emphasisAreaColor,
          borderColor: GOLD,
          borderWidth: 2,
          shadowColor: 'rgba(196,162,101,0.30)',
          shadowBlur: 12,
        },
      },
    },
    series: [{
      type: 'map',
      map: 'china',
      geoIndex: 0,
      data: regionMapData,
      selectedMode: false,
    }],
  }}, [regionMapData, regions, isDark])

  // 导出护照
  const handleExport = async () => {
    if (!passportRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(passportRef.current, {
        backgroundColor: isDark ? DARK_PAPER : PAPER,
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
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <JourneyCloudPattern opacity={0.22} />
      </div>
      <div ref={passportRef} style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 48px', position: 'relative', zIndex: 1 }}>
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
                  <div style={{ fontWeight: 600, color: 'var(--color-ink)', marginBottom: 2 }}>{m.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>{m.description}</div>
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

      {/* ── Passport 2.0: 地域探索 ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        style={{ marginBottom: 32 }}
      >
        {/* 标题行 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            color: 'var(--color-ink)',
            margin: 0,
            paddingBottom: 8,
            borderBottom: '2px solid var(--color-border-light)',
          }}>
            <MapPin style={{ marginRight: 8 }} />
            地域探索
          </h3>
          {regions.length > 0 && (
            <Tag color={GOLD} style={{ margin: 0, fontSize: 'var(--text-sm)', padding: '4px 14px', borderRadius: 20 }}>
              已探索 {regions.length} / {totalProvinces} 个省份
            </Tag>
          )}
        </div>

        {/* 统计卡片行 */}
        {regions.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={8}>
              <Card
                size="small"
                styles={{ body: { padding: '18px 12px', textAlign: 'center' } }}
                style={{ border: '1px solid var(--color-border-light)', borderRadius: 10 }}
              >
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginBottom: 6 }}>
                  已探索省份
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, color: GOLD, fontFamily: 'var(--font-display)' }}>
                  {regions.length}
                </div>
              </Card>
            </Col>
            <Col xs={8}>
              <Card
                size="small"
                styles={{ body: { padding: '18px 12px', textAlign: 'center' } }}
                style={{ border: '1px solid var(--color-border-light)', borderRadius: 10 }}
              >
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginBottom: 6 }}>
                  探索覆盖率
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                  {totalProvinces > 0 ? Math.round(regions.length / totalProvinces * 100) : 0}%
                </div>
              </Card>
            </Col>
            <Col xs={8}>
              <Card
                size="small"
                styles={{ body: { padding: '18px 12px', textAlign: 'center' } }}
                style={{ border: '1px solid var(--color-border-light)', borderRadius: 10 }}
              >
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginBottom: 6 }}>
                  最近解锁
                </div>
                <div style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: VERMILION,
                  fontFamily: 'var(--font-display)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {latestRegion ? `📍 ${latestRegion.region_code}` : '—'}
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* 中国热力图 */}
        {geoLoaded ? (
          <Card
            styles={{ body: { padding: 8 } }}
            style={{
              marginBottom: 16,
              border: '1px solid var(--color-border-light)',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--color-paper-white)',
            }}
          >
            <ReactECharts
              echarts={echarts}
              option={mapOption}
              style={{ height: 500 }}
              opts={{ renderer: 'canvas' }}
              onEvents={{
                click: (params: any) => {
                  if (params.name) {
                    const short = toShortName(params.name)
                    setSelectedRegion(prev => prev === short ? '' : short)
                  }
                },
              }}
            />
          </Card>
        ) : (
          <Card style={{ textAlign: 'center', padding: 48, marginBottom: 16 }}>
            <Spin tip="加载地图数据..." />
          </Card>
        )}

        {/* 色阶图例 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3,
              background: REGION_COLOR_0,
              border: '1px solid #D5CFC0',
            }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>未探索</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3,
              background: GOLD,
            }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)' }}>已探索</span>
          </div>
        </div>

        {/* 省份卡片网格 */}
        {regions.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: 12,
          }}>
            {regions
              .sort((a, b) => {
                const da = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0
                const db = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0
                return db - da
              })
              .map((r, idx) => {
                const isSelected = selectedRegion === r.region_code
                return (
                  <motion.div
                    key={r.region_code}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                    whileHover={{ y: -3, boxShadow: '0 6px 20px rgba(30,27,24,0.10)' }}
                    onClick={() => setSelectedRegion(isSelected ? '' : r.region_code)}
                    style={{
                      padding: '16px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: isSelected
                        ? `2px solid ${VERMILION}`
                        : '1px solid var(--color-border-light)',
                      background: isSelected ? (isDark ? 'rgba(201,107,95,0.12)' : '#FFF5F3') : 'var(--color-paper-white)',
                      transition: 'all var(--duration-normal) var(--ease-out)',
                      boxShadow: isSelected
                        ? '0 4px 14px rgba(184,70,58,0.12)'
                        : '0 1px 4px rgba(30,27,24,0.04)',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
                        📍 {r.region_code}
                      </span>
                      {isSelected && (
                        <Tag color={VERMILION} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>
                          选中
                        </Tag>
                      )}
                    </div>
                    <Progress
                      percent={100}
                      showInfo={false}
                      strokeColor={GOLD}
                      trailColor="var(--color-border-light)"
                      size="small"
                    />
                    {r.unlocked_at && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary)', marginTop: 6 }}>
                        🗓 {new Date(r.unlocked_at).toLocaleDateString('zh-CN')}
                      </div>
                    )}
                  </motion.div>
                )
              })}
          </div>
        ) : (
          <Card style={{ textAlign: 'center', padding: 32, borderRadius: 12 }}>
            <Empty
              description="尚未探索任何地域，去知识图谱或展厅逛逛吧！"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
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
    </>
  )
}
