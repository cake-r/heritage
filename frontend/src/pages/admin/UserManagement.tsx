/** 用户管理 — 列表/搜索/角色/封禁 */

import { useEffect, useState, useCallback } from 'react'
import { Table, Button, Tag, Input, Select, Space, Modal, Typography, message } from 'antd'
import { Search, Square, Shield } from 'lucide-react'
import type { ColumnsType } from 'antd/es/table'
import { fetchUsers, updateUserRole, banUser, unbanUser, type UserItem } from '../../services/admin'

const { Title } = Typography

export default function UserManagement() {
  const [data, setData] = useState<{ total: number; items: UserItem[] }>({ total: 0, items: [] })
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchUsers({ page, page_size: 20, search: search || undefined, role: roleFilter })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter])

  useEffect(() => { load() }, [load])

  const handleRoleChange = async (userId: number, role: string) => {
    await updateUserRole(userId, role)
    message.success('角色已更新')
    load()
  }

  const handleBan = async (userId: number, username: string) => {
    Modal.confirm({
      title: `确认封禁 ${username}?`,
      content: '封禁后该用户将无法登录和使用任何功能。',
      okText: '确认封禁',
      okType: 'danger',
      onOk: async () => {
        await banUser(userId)
        message.success(`已封禁 ${username}`)
        load()
      },
    })
  }

  const handleUnban = async (userId: number) => {
    await unbanUser(userId)
    message.success('已解封')
    load()
  }

  const columns: ColumnsType<UserItem> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '用户名', dataIndex: 'username',
      filterDropdown: () => (
        <Input.Search
          placeholder="搜索用户名"
          onSearch={(v) => { setSearch(v); setPage(1) }}
          style={{ width: 200 }}
        />
      ),
      filterIcon: <Search />,
    },
    { title: '昵称', dataIndex: 'nickname', render: (v) => v || '-' },
    {
      title: '角色', dataIndex: 'role', width: 100,
      render: (role: string, record) => (
        <Select
          value={role || 'user'}
          size="small"
          style={{ width: 90 }}
          onChange={(v) => handleRoleChange(record.id, v)}
          options={[
            { label: '用户', value: 'user' },
            { label: '管理员', value: 'admin' },
          ]}
        />
      ),
    },
    {
      title: '状态', dataIndex: 'is_banned', width: 80,
      render: (banned: boolean) => banned
        ? <Tag color="error">已封禁</Tag>
        : <Tag color="success">正常</Tag>,
    },
    {
      title: '注册时间', dataIndex: 'created_at', width: 120,
      render: (v) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_, record) => (
        record.is_banned
          ? <Button size="small" type="link" onClick={() => handleUnban(record.id)}>解封</Button>
          : <Button size="small" type="link" danger onClick={() => handleBan(record.id, record.username)}>封禁</Button>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>用户管理</Title>
      <Table
        dataSource={data.items}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page, pageSize: 20, total: data.total,
          onChange: setPage, showTotal: (t) => `共 ${t} 人`,
        }}
        size="middle"
      />
    </div>
  )
}
