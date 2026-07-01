/** 任务监控 — 队列状态 + 任务列表 + 重试/取消 */

import { useEffect, useState, useCallback } from 'react'
import { Table, Card, Row, Col, Statistic, Tag, Button, Select, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { fetchTaskQueueStatus, fetchAllTasks, adminRetryTask, adminCancelTask } from '../../services/admin'

const { Title } = Typography

interface TaskItem {
  task_id: string; task_type: string; user_id: number
  status: string; progress: number; retry_count: number
  error_msg?: string; created_at?: string
}

export default function TaskMonitor() {
  const [status, setStatus] = useState<any>({})
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState<string | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, t] = await Promise.all([
        fetchTaskQueueStatus(),
        fetchAllTasks({ page, page_size: 15, status: filterStatus }),
      ])
      setStatus(s)
      setTasks(t.items)
      setTotal(t.total)
    } finally { setLoading(false) }
  }, [page, filterStatus])

  useEffect(() => { load() }, [load])
  useEffect(() => { const i = setInterval(load, 5000); return () => clearInterval(i) }, [load])

  const columns: ColumnsType<TaskItem> = [
    { title: '任务ID', dataIndex: 'task_id', width: 110, render: (v: string) => <code>{v}</code> },
    {
      title: '类型', dataIndex: 'task_type', width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '用户', dataIndex: 'user_id', width: 60 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (s: string) => {
        const colors: Record<string, string> = { pending: 'gold', running: 'blue', success: 'green', failed: 'red' }
        return <Tag color={colors[s] || 'default'}>{s}</Tag>
      },
    },
    { title: '进度', dataIndex: 'progress', width: 80, render: (v: number) => `${v}%` },
    { title: '重试', dataIndex: 'retry_count', width: 50 },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_, record) => (
        <>
          {record.status === 'failed' && (
            <Button size="small" type="link" onClick={async () => { await adminRetryTask(record.task_id); load() }}>
              重试
            </Button>
          )}
          {(record.status === 'pending' || record.status === 'running') && (
            <Button size="small" type="link" danger onClick={async () => { await adminCancelTask(record.task_id); load() }}>
              取消
            </Button>
          )}
        </>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>任务监控</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card><Statistic title="排队中" value={status.pending || 0} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="运行中" value={status.running || 0} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="已完成" value={status.success || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="失败" value={status.failed || 0} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
      </Row>

      <Select
        allowClear placeholder="按状态筛选"
        style={{ width: 140, marginBottom: 12 }}
        value={filterStatus}
        onChange={(v) => { setFilterStatus(v); setPage(1) }}
        options={[
          { label: '排队中', value: 'pending' }, { label: '运行中', value: 'running' },
          { label: '已完成', value: 'success' }, { label: '失败', value: 'failed' },
        ]}
      />

      <Table
        dataSource={tasks} columns={columns} rowKey="task_id"
        loading={loading} size="small"
        pagination={{ current: page, pageSize: 15, total, onChange: setPage }}
      />
    </div>
  )
}
