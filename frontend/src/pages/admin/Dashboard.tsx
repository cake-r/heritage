/** 管理后台总览 — 统计数据 + 图表 */

import { useEffect, useState, useMemo } from 'react'
import { Card, Col, Row, Statistic, Typography, Spin, theme } from 'antd'
import {
  User, ClipboardCheck, DollarSign,
  GitGraph, FileImage,
} from 'lucide-react'
import ReactEChartsCore from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { fetchCostSummary, fetchTaskQueueStatus } from '../../services/admin'
import { fetchUsers } from '../../services/admin'
import { LoomGridPattern } from '../../components/decoration'
import { useTheme } from '../../contexts/ThemeContext'

const { Title } = Typography

export default function AdminDashboard() {
  const { token } = theme.useToken()
  const { theme: appTheme } = useTheme()
  const isDark = appTheme === 'dark'
  const [costs, setCosts] = useState<any>(null)
  const [tasks, setTasks] = useState<any>(null)
  const [users, setUsers] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchCostSummary(30),
      fetchTaskQueueStatus(),
      fetchUsers({ page_size: 1 }),
    ]).then(([c, t, u]) => {
      setCosts(c)
      setTasks(t)
      setUsers(u)
    }).finally(() => setLoading(false))
  }, [])

  const dailyData = costs?.by_day?.map((d: any) => d.date) || []
  const dailyCosts = costs?.by_day?.map((d: any) => d.cost) || []

  const costChartOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: dailyData, axisLabel: { rotate: 45, fontSize: 11 } },
    yAxis: { type: 'value', name: '元' },
    series: [{
      data: dailyCosts, type: 'line', smooth: true,
      lineStyle: { color: token.colorPrimary, width: 2 },
      itemStyle: { color: token.colorPrimary },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: token.colorPrimary + '40' },
        { offset: 1, color: token.colorPrimary + '05' },
      ])},
    }],
  }), [dailyData, dailyCosts, token.colorPrimary, isDark])

  const taskPieOption = useMemo(() => ({
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['50%', '75%'],
      data: [
        { value: tasks?.pending || 0, name: '排队中', itemStyle: { color: '#faad14' } },
        { value: tasks?.running || 0, name: '运行中', itemStyle: { color: '#1677ff' } },
        { value: tasks?.success || 0, name: '已完成', itemStyle: { color: '#52c41a' } },
        { value: tasks?.failed || 0, name: '失败', itemStyle: { color: '#ff4d4f' } },
      ],
      label: { formatter: '{b}: {c}' },
    }],
  }), [tasks, isDark])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />

  return (
    <div style={{ position: 'relative' }}>
      <LoomGridPattern opacity={0.18} />
      <Title level={4} style={{ marginBottom: 24 }}>管理后台总览</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="用户总数" value={users?.total || 0} prefix={<User />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="待处理任务" value={tasks?.pending || 0} prefix={<GitGraph />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="30天AI成本"
              value={costs?.total_cost || 0}
              precision={2}
              prefix={<DollarSign />}
              suffix="元"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="任务成功率" value={
              tasks ? Math.round((tasks.success || 0) / Math.max(tasks.success + tasks.failed, 1) * 100) : 0
            } suffix="%" />
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="每日AI成本趋势 (30天)">
            <ReactEChartsCore echarts={echarts} option={costChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="任务状态分布">
            <ReactEChartsCore echarts={echarts} option={taskPieOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
