/** Admin — Prompt 管理页面（Phase C Step 8 极简版）

功能：
- 按模块列表卡片展示
- 点击展开编辑 TextArea
- 激活/回滚按钮（切换 is_active）
- 历史版本列表
不做：diff 对比、在线测试、变量高亮预览
*/

import React, { useEffect, useState } from 'react'
import {
  Card, Button, Input, Tag, message, Spin, Empty, Alert,
  Collapse, Modal, List, Typography, Space, Badge, Tooltip,
} from 'antd'
import {
  Pencil, CheckCircle, Undo2,
  History, Save, AlertCircle,
  FileText,
} from 'lucide-react'
import {
  fetchPrompts, updatePrompt, fetchPromptHistory,
  type PromptItem, type PromptModule,
  PROMPT_MODULE_LABELS, PROMPT_MODULE_ICONS, PROMPT_MODULE_COLORS,
} from '../../services/prompt'
import { LoomGridPattern } from '../../components/decoration'

const { TextArea } = Input
const { Text, Title } = Typography

const PromptManager: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [modules, setModules] = useState<PromptModule[]>([])
  const [error, setError] = useState<string | null>(null)

  // 编辑状态
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)

  // 历史版本弹窗
  const [historyVisible, setHistoryVisible] = useState(false)
  const [historyModule, setHistoryModule] = useState('')
  const [historyItems, setHistoryItems] = useState<PromptItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPrompts()
      setModules(data.modules)
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(promptId: number) {
    if (!editContent.trim()) {
      message.warning('Prompt 内容不能为空')
      return
    }
    setSaving(true)
    try {
      await updatePrompt(promptId, { content: editContent })
      message.success('Prompt 已保存（新版本已创建）')
      setEditingId(null)
      loadData()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || err?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate(promptId: number) {
    try {
      await updatePrompt(promptId, { is_active: true })
      message.success('已激活该版本')
      loadData()
    } catch (err: any) {
      message.error(err?.response?.data?.detail || err?.message || '激活失败')
    }
  }

  async function handleViewHistory(moduleName: string, promptId: number) {
    setHistoryVisible(true)
    setHistoryModule(moduleName)
    setHistoryLoading(true)
    try {
      const items = await fetchPromptHistory(promptId)
      setHistoryItems(items)
    } catch {
      message.error('无法加载历史版本')
    } finally {
      setHistoryLoading(false)
    }
  }

  function startEdit(item: PromptItem) {
    setEditingId(item.id)
    setEditContent(item.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditContent('')
  }

  // ── 渲染 ──

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载 Prompt 配置中..." /></div>
  }

  if (error) {
    return <Alert type="error" message="加载失败" description={error} showIcon action={<Button onClick={loadData}>重试</Button>} />
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative' }}>
      <LoomGridPattern opacity={0.18} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileText style={{ marginRight: 8 }} />
          Prompt 管理
        </Title>
        <Button onClick={loadData} icon={<Undo2 />}>刷新</Button>
      </div>

      <Alert
        type="info"
        message="极简版 Prompt 管理"
        description="支持编辑内容（自动创建新版本）、切换激活版本、查看历史。不做 diff 对比和在线测试。"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {modules.length === 0 ? (
        <Empty description="暂无 Prompt 数据（请先运行 seed 初始化默认 Prompt）" />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {modules.map((mod) => (
            <PromptModuleCard
              key={mod.module}
              module={mod}
              editingId={editingId}
              editContent={editContent}
              saving={saving}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onEditContentChange={setEditContent}
              onSave={handleSave}
              onActivate={handleActivate}
              onViewHistory={handleViewHistory}
            />
          ))}
        </Space>
      )}

      {/* 历史版本弹窗 */}
      <Modal
        title={`${PROMPT_MODULE_LABELS[historyModule] || historyModule} — 历史版本`}
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        footer={null}
        width={700}
      >
        {historyLoading ? (
          <Spin />
        ) : (
          <List
            dataSource={historyItems}
            renderItem={(item) => (
              <List.Item
                actions={[
                  item.is_active ? <Tag color="green">当前激活</Tag> : null,
                  !item.is_active && (
                    <Button size="small" onClick={() => { handleActivate(item.id); setHistoryVisible(false) }}>
                      回滚至此版本
                    </Button>
                  ),
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color={PROMPT_MODULE_COLORS[item.module]}>{item.module}</Tag>
                      v{item.version}
                      {item.is_active && <Badge status="processing" />}
                    </Space>
                  }
                  description={
                    <div>
                      {item.description && <Text type="secondary">{item.description}</Text>}
                      <div style={{ marginTop: 4, fontSize: 12, color: '#999', maxHeight: 60, overflow: 'hidden', whiteSpace: 'pre-wrap' }}>
                        {item.content.slice(0, 200)}{item.content.length > 200 ? '...' : ''}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  )
}

// ── 模块卡片子组件 ──

interface PromptModuleCardProps {
  module: PromptModule
  editingId: number | null
  editContent: string
  saving: boolean
  onStartEdit: (item: PromptItem) => void
  onCancelEdit: () => void
  onEditContentChange: (content: string) => void
  onSave: (id: number) => void
  onActivate: (id: number) => void
  onViewHistory: (module: string, promptId: number) => void
}

const PromptModuleCard: React.FC<PromptModuleCardProps> = ({
  module, editingId, editContent, saving,
  onStartEdit, onCancelEdit, onEditContentChange,
  onSave, onActivate, onViewHistory,
}) => {
  const icon = PROMPT_MODULE_ICONS[module.module] || '📝'
  const label = PROMPT_MODULE_LABELS[module.module] || module.module
  const color = PROMPT_MODULE_COLORS[module.module] || '#666'

  const activePrompt = module.prompts.find(p => p.is_active)
  const activeVersion = activePrompt?.version ?? '-'

  return (
    <Card
      title={
        <Space>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span>{label}</span>
          <Tag color={color}>{module.module}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            激活版本: v{activeVersion} · 共 {module.prompts.length} 个版本
          </Text>
        </Space>
      }
      extra={
        activePrompt && (
          <Button
            size="small"
            icon={<History />}
            onClick={() => onViewHistory(module.module, activePrompt.id)}
          >
            历史版本
          </Button>
        )
      }
      style={{ borderRadius: 12 }}
    >
      {module.prompts.length === 0 ? (
        <Text type="secondary">暂无版本</Text>
      ) : (
        module.prompts.slice(0, 3).map((item) => (
          <div
            key={item.id}
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 8,
              border: item.is_active ? `1px solid ${color}` : '1px solid #f0f0f0',
              background: item.is_active ? `${color}08` : '#fafafa',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Space>
                <Tag color={color}>v{item.version}</Tag>
                {item.is_active && <Badge status="processing" text={<Text style={{ color }}>激活</Text>} />}
                {item.description && (
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text>
                )}
              </Space>
              <Space>
                {!item.is_active && (
                  <Tooltip title="切换为激活版本">
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<CheckCircle />}
                      onClick={() => onActivate(item.id)}
                    >
                      激活
                    </Button>
                  </Tooltip>
                )}
                <Tooltip title="编辑内容（将创建新版本）">
                  <Button
                    size="small"
                    icon={<Pencil />}
                    onClick={() => onStartEdit(item)}
                    disabled={editingId === item.id}
                  >
                    编辑
                  </Button>
                </Tooltip>
              </Space>
            </div>

            {editingId === item.id ? (
              <div>
                <TextArea
                  rows={12}
                  value={editContent}
                  onChange={(e) => onEditContentChange(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Button
                    type="primary"
                    icon={<Save />}
                    loading={saving}
                    onClick={() => onSave(item.id)}
                  >
                    保存为新版本
                  </Button>
                  <Button onClick={onCancelEdit}>取消</Button>
                </div>
              </div>
            ) : (
              <pre style={{
                margin: 0,
                padding: 8,
                background: '#f5f5f5',
                borderRadius: 4,
                fontSize: 11,
                maxHeight: 100,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {item.content}
              </pre>
            )}
          </div>
        ))
      )}

      {module.prompts.length > 3 && (
        <Button
          type="link"
          size="small"
          icon={<History />}
          onClick={() => onViewHistory(module.module, module.prompts[0].id)}
        >
          查看全部 {module.prompts.length} 个版本
        </Button>
      )}
    </Card>
  )
}

export default PromptManager
