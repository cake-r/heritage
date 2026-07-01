/** AI 成本看板 — 按模型/日期总览 + 调用明细 */

import { useEffect, useState, useCallback } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, DatePicker, Typography } from 'antd'
import ReactEChartsCore from 'echarts-for-react'
import * as echarts from 'echarts/core'
import { fetchCostSummary, fetchCostLogs } from '../../services/admin'

const { Title } = Typography
const { RangePicker } = DatePicker

export default function CostDashboard() {
  const [summary, setSummary] = useState<any>({})
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, l] = await Promise.all([
        fetchCostSummary(days),
        fetchCostLogs({ page_size: 20 }),
      ])
      setSummary(s)
      setLogs(l.items || [])
    } finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  const modelNames = Object.keys(summary.by_model || {})
  const modelCosts = modelNames.map(m => summary.by_model?.[m] || 0)

  const barOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 100, right: 20, top: 10, bottom: 20 },
    xAxis: { type: 'value', name: '元' },
    yAxis: { type: 'category', data: modelNames, axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: modelCosts,
      itemStyle: { color: '#B8463A', borderRadius: [0, 4, 4, 0] },
    }],
  }

  const columns = [
    { title: '用户', dataIndex: 'user_id', width: 60 },
    { title: '模型', dataIndex: 'model', width: 130, render: (v: string) => <Tag>{v}</Tag> },
    { title: '端点', dataIndex: 'endpoint', width: 100 },
    { title: 'Tokens (入/出)', key: 'tokens', width: 120,
      render: (_: any, r: any) => `${r.tokens_in || 0} / ${r.tokens_out || 0}` },
    { title: '延迟', dataIndex: 'latency_ms', width: 80, render: (v: number) => `${v}ms` },
    { title: '费用', dataIndex: 'cost_cny', width: 80, render: (v: number) => `¥${v?.toFixed(4)}` },
    { title: '状态', dataIndex: 'status', width: 70,
      render: (s: string) => <Tag color={s === 'success' ? 'green' : 'red'}>{s}</Tag> },
    { title: '时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        AI 成本看板
        <DatePicker
          style={{ marginLeft: 16 }}
          value={null} placeholder={`最近 ${days} 天`}
          onChange={(_, d) => { if (d && d[0]) setDays(Math.ceil((Date.now() - new Date(d[0]).getTime()) / 86400000)) }}
        />
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}><Card><Statistic title="总成本" value={summary.total_cost || 0} precision={4} suffix="元" /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="模型数" value={modelNames.length} /></Card></Col>
        <Col xs={24} sm={8}><Card><Statistic title="日均成本" value={summary.total_cost ? (summary.total_cost / days).toFixed(4) : 0} suffix="元" /></Card></Col>

        <Col xs={24} lg={12}>
          <Card title="模型成本分布">
            <ReactEChartsCore echarts={echarts} option={barOption} style={{ height: 250 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="端点成本明细">
            {Object.entries(summary.by_endpoint || {}).map(([ep, cost]: any) => (
              <div key={ep} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                <span>{ep}</span>
                <Tag color="gold">¥{cost?.toFixed(4)}</Tag>
              </div>
            ))}
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="最近调用记录">
            <Table dataSource={logs} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
