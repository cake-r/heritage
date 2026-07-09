/** 管理后台 — 数据驾驶舱（Admin Dashboard 2.0） */
import { useEffect, useState, useMemo } from 'react'
import { Card, Col, Row, Statistic, Typography, Spin, Select, Empty } from 'antd'
import {
  User, ClipboardCheck, DollarSign,
  GitGraph, FileImage, Flame,
  Database, Image, Trophy,
  BarChart3, TrendingUp, Map, Crown,
} from 'lucide-react'
import ReactEChartsCore from 'echarts-for-react'
import * as echarts from 'echarts/core'
import {
  fetchDashboardOverview,
  fetchDashboardTrends,
  fetchDashboardLeaderboard,
  type DashboardOverview,
  type DailyTrend,
  type DashboardLeaderboard,
} from '../../services/admin'
import { LoomGridPattern } from '../../components/decoration'
import { useTheme } from '../../contexts/ThemeContext'
import { DARK_DEEP } from '../../styles/chart-theme'

const { Title } = Typography

// 主题色
const GOLD = '#C4A265'
const VERMILION = '#B8463A'
const INK = '#2C241A'

// DataV GeoJSON 加载
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

export default function DataCockpit() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [trends, setTrends] = useState<DailyTrend[]>([])
  const [leaderboard, setLeaderboard] = useState<DashboardLeaderboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [trendDays, setTrendDays] = useState(7)
  const [geoLoaded, setGeoLoaded] = useState(false)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (chinaGeo) { setGeoLoaded(true); return }
    fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
      .then(r => r.json())
      .then(geo => { chinaGeo = geo; setGeoLoaded(true) })
      .catch(() => setGeoLoaded(true))
  }, [])

  useEffect(() => {
    loadAll()
  }, [trendDays])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [ov, tr, lb] = await Promise.all([
        fetchDashboardOverview(),
        fetchDashboardTrends(trendDays),
        fetchDashboardLeaderboard(10),
      ])
      setOverview(ov)
      setTrends(tr.trends)
      setLeaderboard(lb)
    } finally {
      setLoading(false)
    }
  }

  // ── 图表配置 ──

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 20, top: 20, bottom: 35 },
    xAxis: {
      type: 'category',
      data: trends.map(t => t.date.slice(5)),
      axisLabel: { fontSize: 10 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '识别', type: 'line', data: trends.map(t => t.recognitions),
        smooth: true, lineStyle: { color: VERMILION, width: 2 },
        itemStyle: { color: VERMILION },
      },
      {
        name: '修复', type: 'line', data: trends.map(t => t.restorations),
        smooth: true, lineStyle: { color: '#4A7FB5', width: 2 },
        itemStyle: { color: '#4A7FB5' },
      },
      {
        name: '创作', type: 'line', data: trends.map(t => t.generations),
        smooth: true, lineStyle: { color: '#52c41a', width: 2 },
        itemStyle: { color: '#52c41a' },
      },
      {
        name: '新用户', type: 'line', data: trends.map(t => t.new_users),
        smooth: true, lineStyle: { color: GOLD, width: 2 },
        itemStyle: { color: GOLD },
      },
    ],
  }), [trends])

  const costOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: trends.map(t => t.date.slice(5)),
      axisLabel: { fontSize: 10 },
    },
    yAxis: { type: 'value', name: '元', axisLabel: { fontSize: 10 } },
    series: [{
      name: 'AI成本',
      type: 'bar',
      data: trends.map(t => t.cost),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: GOLD },
          { offset: 1, color: GOLD + '30' },
        ]),
        borderRadius: [4, 4, 0, 0],
      },
    }],
  }), [trends])

  // 品类柱状图
  const categoryOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 80, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: (leaderboard?.top_categories || []).map(c => c.name).reverse(),
      axisLabel: { fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: (leaderboard?.top_categories || []).map(c => c.value).reverse(),
      itemStyle: { color: VERMILION, borderRadius: [0, 4, 4, 0] },
      barMaxWidth: 24,
    }],
  }), [leaderboard])

  // 地域热力图
  const regionMapData = useMemo(() => {
    const regionCounts: Record<string, number> = {}
    leaderboard?.top_regions?.forEach(r => { regionCounts[r.name] = r.value })
    const data: { name: string; value: number }[] = []
    if (!chinaGeo) return data
    for (const feature of chinaGeo.features || []) {
      const fullName = feature.properties?.name || ''
      const shortName = toShortName(fullName)
      data.push({ name: fullName, value: regionCounts[shortName] || 0 })
    }
    return data
  }, [leaderboard, geoLoaded])

  const mapOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${toShortName(p.name)}: ${p.value || 0} 项`,
    },
    visualMap: {
      min: 0,
      max: Math.max(...regionMapData.map(d => d.value), 1),
      inRange: { color: isDark ? ['#1E1B18', '#3A3020', '#C4A265', '#C96B5F'] : ['#F7F4ED', '#E8D5B0', '#C4A265', '#B8463A'] },
      show: false,
    },
    geo: {
      map: 'china',
      roam: false,
      label: { show: false },
      itemStyle: {
        areaColor: isDark ? DARK_DEEP : '#F7F4ED',
        borderColor: isDark ? '#3A3530' : '#D5CFC0',
        borderWidth: 0.5,
      },
      emphasis: {
        itemStyle: { areaColor: isDark ? '#4A3A28' : '#E8D5B0' },
      },
    },
    series: [{
      type: 'map', map: 'china', geoIndex: 0, data: regionMapData,
    }],
  }), [regionMapData, isDark])

  if (loading && !overview) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
  }

  return (
    <div style={{ position: 'relative' }}>
      <LoomGridPattern opacity={0.18} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}><BarChart3 size={22} style={{ marginRight: 8 }} />数据驾驶舱</Title>
        <Select
          value={trendDays}
          onChange={setTrendDays}
          style={{ width: 120 }}
          options={[
            { value: 7, label: '近7天' },
            { value: 30, label: '近30天' },
            { value: 90, label: '近90天' },
          ]}
        />
      </div>

      {/* ── KPI 卡片行 ── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={3}>
          <Card size="small">
            <Statistic title="用户总数" value={overview?.total_users || 0} prefix={<User />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={3}>
          <Card size="small">
            <Statistic title="今日活跃" value={overview?.active_users_today || 0} prefix={<Flame />}
              valueStyle={{ color: VERMILION }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={3}>
          <Card size="small">
            <Statistic title="识别总量" value={overview?.total_recognitions || 0} prefix={<ClipboardCheck />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={3}>
          <Card size="small">
            <Statistic title="修复总量" value={overview?.total_restorations || 0} prefix={<Image />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={3}>
          <Card size="small">
            <Statistic title="创作总量" value={overview?.total_generations || 0} prefix={<FileImage />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={3}>
          <Card size="small">
            <Statistic title="今日成本" value={overview?.ai_cost_today || 0} precision={2}
              prefix={<DollarSign />} suffix="元" valueStyle={{ color: GOLD }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={3}>
          <Card size="small">
            <Statistic title="排队任务" value={overview?.task_pending || 0} prefix={<GitGraph />}
              valueStyle={{ color: overview?.task_pending ? '#faad14' : undefined }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={3}>
          <Card size="small">
            <Statistic title="知识库" value={overview?.knowledge_base_size || 0} prefix={<Database />} />
          </Card>
        </Col>
      </Row>

      {/* ── 趋势图表行 ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title={<><TrendingUp size={18} style={{ marginRight: 8 }} />业务趋势</>}>
            {trends.length > 0 ? (
              <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 300 }} />
            ) : (
              <Empty description="暂无趋势数据" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<><DollarSign size={18} style={{ marginRight: 8 }} />AI 成本趋势</>}>
            {trends.length > 0 ? (
              <ReactEChartsCore echarts={echarts} option={costOption} style={{ height: 300 }} />
            ) : (
              <Empty description="暂无成本数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── 排行榜行 ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card title={<><Trophy size={18} style={{ marginRight: 8 }} />热门品类 TOP 10</>}>
            <ReactEChartsCore echarts={echarts} option={categoryOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title={<><Map size={18} style={{ marginRight: 8 }} />地域分布</>}>
            {geoLoaded ? (
              <ReactEChartsCore echarts={echarts} option={mapOption} style={{ height: 300 }} />
            ) : (
              <Spin tip="加载地图..." />
            )}
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title={<><Crown size={18} style={{ marginRight: 8 }} />活跃用户 TOP 10</>}>
            {leaderboard?.top_users && leaderboard.top_users.length > 0 ? (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {leaderboard.top_users.map((u, i) => (
                  <div key={u.name} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderBottom: '1px solid var(--color-border-light)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: i < 3 ? ['#C4A265', '#C0C0C0', '#CD7F32'][i] : '#F5F2EC',
                        color: i < 3 ? '#fff' : 'var(--color-ink)',
                        textAlign: 'center', lineHeight: '24px', fontSize: 12, fontWeight: 600,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>{u.name}</span>
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: GOLD, fontWeight: 600 }}>
                      {u.value} 印章
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无活跃用户" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
