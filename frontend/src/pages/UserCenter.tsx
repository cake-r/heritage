import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Layout, Menu, Card, Typography, Spin, Empty, Button,
  List, Image, Tag, Space, Input, Form, message, Popconfirm, Tabs, Tooltip,
  Upload, Avatar, Progress,
} from 'antd'
import {
  Camera, ImageIcon, MessageCircle,
  Heart, Settings, Wrench,
  Trash2, ChevronRight,
  User, Plus, Bot, Flame, Trophy,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getProfile, updateProfile, listFavorites, deleteFavorite, getStatistics,
  type UserProfile, type FavoriteItem, type UserStatistics,
} from '../services/user'
import { getHistory as getRecognitionHistory, deleteRecognition, type RecognitionListItem } from '../services/recognition'
import { getHistory as getGenerationHistory, deleteWork, type GenerationItem } from '../services/generation'
import { getHistory as getRestorationHistory, deleteRestoration, type RestorationListItem } from '../services/restoration'
import api from '../services/api'
import { normalizeImageUrl } from '../utils/imageUrl'
import AvatarCropper from '../components/AvatarCropper'
import { LotusPondPattern } from '../components/decoration'
import { listSessions, deleteSession, type ChatSessionItem } from '../services/chat'
import { listMyInheritors, deleteInheritor, type CustomInheritor } from '../services/inheritor'
import { TOOL_NAMES, TOOL_ICONS } from './Workshop'
import { useCultivationStore } from '../stores/cultivationStore'
import { Icon, RANK_ICON_CONFIG } from '../config/icons'

const { Sider, Content } = Layout
const { Title, Text } = Typography

const tabs = [
  { key: 'records', icon: <Camera />, label: '识别记录' },
  { key: 'works', icon: <ImageIcon size={18} />, label: '生成作品' },
  { key: 'chats', icon: <MessageCircle />, label: '对话历史' },
  { key: 'restoration', icon: <Wrench />, label: '修复记录' },
  { key: 'favorites', icon: <Heart />, label: '我的收藏' },
  { key: 'settings', icon: <Settings />, label: '个人设置' },
]

export default function UserCenter() {
  const { tab = 'records' } = useParams()
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()

  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    getProfile().then(setProfile).catch(() => {})
  }, [])

  const renderContent = () => {
    switch (tab) {
      case 'records': return <RecordsTab />
      case 'works': return <WorksTab />
      case 'chats': return <ChatsTab />
      case 'restoration': return <RestorationTab />
      case 'favorites': return <FavoritesTab />
      case 'settings': return <SettingsTab profile={profile} onUpdate={setProfile} updateUser={updateUser} />
      default: return <Empty description="未知页面" />
    }
  }

  return (
    <>
      {/* 全视口纹样背景 — fixed 覆盖 Header/Sider/边距 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <LotusPondPattern opacity={0.18} />
      </div>

      <Layout style={{ background: 'transparent', position: 'relative', zIndex: 1, minHeight: 'calc(100vh - 64px - 32px)' }}>
        <Sider width={180} style={{ background: 'var(--color-paper-white)', borderRadius: 12, marginRight: 24 }}>
          {/* 用户信息卡片 */}
          <div style={{ padding: '20px 16px 12px', textAlign: 'center', borderBottom: '1px solid var(--color-border-light)' }}>
            <Avatar
              size={150}
              src={normalizeImageUrl(profile?.avatar_url)}
              icon={<User size={64} color="var(--color-paper-white)" />}
              style={{ margin: '0 auto 8px', display: 'block', background: 'var(--color-vermilion)' }}
            />
            <Text strong>{profile?.nickname || user?.username || '用户'}</Text>
          </div>

        <Menu
          mode="inline"
          selectedKeys={[tab]}
          items={tabs}
          onClick={({ key }) => navigate(`/user-center/${key}`)}
          style={{ border: 'none', marginTop: 8 }}
        />
      </Sider>

      <Content style={{ display: 'flex', flexDirection: 'column' }}>
        <Card
          style={{ borderRadius: 12, flex: 1 }}
          styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%', padding: 24 } }}
        >
          <Title level={3} style={{ marginTop: 0, flexShrink: 0 }}>
            {tabs.find(t => t.key === tab)?.label}
          </Title>
          <div style={{ marginTop: 16, flex: 1, overflow: 'auto', minHeight: 0 }}>{renderContent()}</div>

          {/* Card 底部 — 修习状态 + 今日足迹 */}
          <div style={{ flexShrink: 0, marginTop: 24 }}>
            <div style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, var(--color-gold, #C4A265), transparent)',
              opacity: 0.4,
              marginBottom: 20,
            }} />
            <DashboardFooter />
          </div>
        </Card>
      </Content>
    </Layout>
    </>
  )
}

// ========== 识别记录 Tab ==========

function RecordsTab() {
  const [records, setRecords] = useState<RecognitionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await getRecognitionHistory(1, 20)
      const items = Array.isArray(data) ? data : (data?.items || [])
      setRecords(items)
    } catch { message.error('加载识别记录失败') }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteRecognition(id)
      message.success('已删除')
      setRecords(prev => prev.filter(r => r.id !== id))
    } catch { message.error('删除失败') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
  if (records.length === 0) return <Empty description="暂无识别记录" />

  return (
    <List
      dataSource={records}
      renderItem={item => (
        <List.Item
          extra={
            <Space>
              <Button type="link" icon={<ChevronRight />} onClick={() => navigate(`/recognition?id=${item.id}`)}>
                查看详情
              </Button>
              <Popconfirm title="确定删除？" onConfirm={() => handleDelete(item.id)}>
                <Button type="text" size="small" danger icon={<Trash2 />} />
              </Popconfirm>
            </Space>
          }
        >
          <List.Item.Meta
            avatar={
              item.image_url
                ? <Image src={normalizeImageUrl(item.image_url)} width={80} height={60} style={{ borderRadius: 6, objectFit: 'cover' }} preview={false} />
                : <ImageIcon size={48} style={{ color: 'var(--color-border-medium)' }} />
            }
            title={<Text strong>{item.category}</Text>}
            description={
              <Space size={8}>
                <Tag color="blue">置信度 {(item.confidence * 100).toFixed(1)}%</Tag>
                <Text type="secondary">{new Date(item.created_at).toLocaleDateString('zh-CN')}</Text>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  )
}

// ========== 生成作品 Tab ==========

function WorksTab() {
  const [works, setWorks] = useState<GenerationItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await getGenerationHistory(1, 20)
      setWorks(data.items)
    } catch { message.error('加载作品失败') }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteWork(id)
      message.success('已删除')
      setWorks(prev => prev.filter(w => w.id !== id))
    } catch { message.error('删除失败') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
  if (works.length === 0) return <Empty description="暂无生成作品" />

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {works.map(w => (
        <Card
          key={w.id}
          hoverable
          style={{ width: 200, borderRadius: 12 }}
          cover={
            w.images.length > 0 ? (
              <Image src={normalizeImageUrl(w.images[0])} alt={w.base_style}
                style={{ height: 160, objectFit: 'cover', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
                preview={{ mask: '预览' }}
              />
            ) : (
              <div style={{ height: 160, background: 'var(--color-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImageIcon size={48} style={{ color: 'var(--color-border-medium)' }} />
              </div>
            )
          }
          styles={{ body: { padding: '8px 12px' } }}
          actions={[
            <Tooltip title="查看详情" key="view">
              <Button type="text" size="small" icon={<ChevronRight />}
                onClick={() => navigate(`/creative-studio?work=${w.id}`)} />
            </Tooltip>,
            <Popconfirm key="del" title="确定删除？" onConfirm={() => handleDelete(w.id)}>
              <Button type="text" size="small" danger icon={<Trash2 />} />
            </Popconfirm>,
          ]}
        >
          <Text strong style={{ fontSize: 'var(--text-sm)' }}>{w.base_style}风格</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{new Date(w.created_at).toLocaleDateString('zh-CN')}</Text>
        </Card>
      ))}
    </div>
  )
}

// ========== 对话历史 Tab ==========

function ChatsTab() {
  const navigate = useNavigate()

  return (
    <Tabs
      defaultActiveKey="sessions"
      items={[
        { key: 'sessions', label: '对话记录', children: <SessionsList /> },
        { key: 'inheritors', label: '我的传承人', children: <MyInheritorsList /> },
      ]}
    />
  )
}

// ── 子组件：对话记录列表 ──

function SessionsList() {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { user } = useAuth()

  // 读取 localStorage 头像覆盖（与 Workshop buildInheritorList 逻辑一致）
  const [avatarOverrides, setAvatarOverrides] = useState<Record<string, string>>({})
  useEffect(() => {
    try {
      const raw = localStorage.getItem('inheritor_avatar_overrides')
      if (raw) setAvatarOverrides(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  // 解析实际头像：优先 localStorage 覆盖
  const resolveAvatar = (item: ChatSessionItem) =>
    avatarOverrides[item.persona] || item.inheritor_avatar

  useEffect(() => { load() }, [])

  const load = () => {
    setLoading(true)
    listSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      message.success('已删除')
    } catch { message.error('删除失败') }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
  }

  if (sessions.length === 0) {
    return (
      <Empty description="暂无对话记录，去技艺工坊开始探索吧！">
        <Button type="primary" icon={<ChevronRight />} onClick={() => navigate('/workshop')}>
          去技艺工坊
        </Button>
      </Empty>
    )
  }

  return (
    <List
      dataSource={sessions}
      renderItem={(item) => (
        <List.Item
          extra={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button
                type="link"
                icon={<ChevronRight />}
                onClick={() => navigate(`/workshop?persona=${item.persona}`)}
              >
                继续
              </Button>
              <Popconfirm
                title="确定删除此对话？"
                onConfirm={() => handleDelete(item.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" danger icon={<Trash2 />} />
              </Popconfirm>
            </div>
          }
        >
          <List.Item.Meta
            avatar={
              <div style={{ position: 'relative' }}>
                {/* 传承人头像 — 优先 localStorage 覆盖，加载失败自动回退 */}
                <Avatar
                  size={48}
                  src={normalizeImageUrl(resolveAvatar(item))}
                  icon={<Bot size={24} style={{ color: 'var(--color-ink-secondary, #6B5F52)' }} />}
                  style={{ background: 'var(--color-paper, #F7F4ED)' }}
                />
                {/* 用户头像小角标 */}
                <Avatar
                  size={26}
                  src={normalizeImageUrl(user?.avatar_url)}
                  icon={<User size={12} color="var(--color-paper-white)" />}
                  style={{
                    position: 'absolute', bottom: -2, right: -4,
                    border: '2px solid var(--color-paper-white)', background: 'var(--color-vermilion)',
                  }}
                />
              </div>
            }
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  {item.title || '新对话'}
                </span>
                {item.inheritor_name && (
                  <Tag style={{ fontSize: 'var(--text-xs)', margin: 0 }}>
                    {item.inheritor_name}
                  </Tag>
                )}
              </div>
            }
            description={
              <div>
                {item.preview && (
                  <div style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-ink-secondary, #6B5F52)',
                    marginBottom: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 400,
                  }}>
                    {item.preview}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {item.available_tools?.map(toolId => (
                    <Tag key={toolId} style={{ fontSize: 11, margin: 0 }} color="gold">
                      {TOOL_ICONS[toolId] || 'wrench'} {TOOL_NAMES[toolId] || toolId}
                    </Tag>
                  ))}
                  <span style={{ fontSize: 11, color: 'var(--color-ink-tertiary, #999)' }}>
                    {new Date(item.updated_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            }
          />
        </List.Item>
      )}
    />
  )
}

// ── 子组件：我的传承人列表 ──

function MyInheritorsList() {
  const [inheritors, setInheritors] = useState<CustomInheritor[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  const load = () => {
    setLoading(true)
    listMyInheritors()
      .then(setInheritors)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteInheritor(id)
      setInheritors(prev => prev.filter(i => i.id !== id))
      message.success('已删除')
    } catch { message.error('删除失败') }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
  }

  if (inheritors.length === 0) {
    return (
      <Empty description="尚未创建自定义传承人">
        <Button type="primary" icon={<Plus />} onClick={() => navigate('/workshop/wizard')}>
          创建传承人
        </Button>
      </Empty>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {inheritors.map((item) => (
        <Card
          key={item.id}
          size="small"
          style={{ width: 200, borderRadius: 12 }}
          styles={{ body: { padding: 16 } }}
        >
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <Avatar
              size={64}
              src={normalizeImageUrl(item.avatar_url)}
              icon={<User size={28} style={{ color: 'var(--color-ink-secondary, #6B5F52)' }} />}
              style={{ background: 'var(--color-paper, #F7F4ED)' }}
            />
          </div>

          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>
            {item.name}
          </div>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
            <Tag color="gold" style={{ fontSize: 11, margin: 0 }}>{item.category}</Tag>
            {item.expertise?.slice(0, 2).map((e, i) => (
              <Tag key={i} style={{ fontSize: 11, margin: 0 }}>{e}</Tag>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button
              type="primary"
              size="small"
              icon={<ChevronRight />}
              style={{ fontSize: 'var(--text-xs)' }}
              onClick={() => navigate(`/workshop?persona=custom:${item.id}`)}
            >
              对话
            </Button>
            <Popconfirm
              title="确定删除此传承人？"
              onConfirm={() => handleDelete(item.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" size="small" danger icon={<Trash2 />} />
            </Popconfirm>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ========== 修复记录 Tab ==========

function RestorationTab() {
  const [records, setRecords] = useState<RestorationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await getRestorationHistory(1, 50)
      const items = Array.isArray(data) ? data : (data?.items || [])
      setRecords(items)
    } catch { message.error('加载修复记录失败') }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteRestoration(id)
      message.success('已删除')
      setRecords(prev => prev.filter(r => r.id !== id))
    } catch { message.error('删除失败') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
  if (records.length === 0) return <Empty description="暂无修复记录" />

  return (
    <List
      dataSource={records}
      renderItem={item => (
        <List.Item
          extra={
            <Space>
              <Button type="link" icon={<ChevronRight />} onClick={() => navigate(`/restoration?id=${item.id}`)}>
                查看详情
              </Button>
              <Popconfirm title="确定删除？" onConfirm={() => handleDelete(item.id)}>
                <Button type="text" size="small" danger icon={<Trash2 />} />
              </Popconfirm>
            </Space>
          }
        >
          <List.Item.Meta
            avatar={
              item.original_image_url
                ? <Image src={normalizeImageUrl(item.original_image_url)} width={80} height={60} style={{ borderRadius: 6, objectFit: 'cover' }} preview={false} />
                : <ImageIcon size={48} style={{ color: 'var(--color-border-medium)' }} />
            }
            title={
              <Space>
                <Text strong>{item.damage_category || '未知类别'}</Text>
                <Tag color={item.pipeline_status === 'completed' ? 'green' : 'red'}>
                  {item.pipeline_status === 'completed' ? '修复完成' : '修复失败'}
                </Tag>
              </Space>
            }
            description={
              <Space size={8}>
                {item.verification_score != null && (
                  <Tag color={item.verification_score >= 80 ? 'gold' : item.verification_score >= 60 ? 'blue' : 'default'}>
                    评分 {item.verification_score}
                  </Tag>
                )}
                <Text type="secondary">{new Date(item.created_at).toLocaleDateString('zh-CN')}</Text>
              </Space>
            }
          />
        </List.Item>
      )}
    />
  )
}

// ========== 收藏 Tab ==========

function FavoritesTab() {
  const [favs, setFavs] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState('all')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await listFavorites()
      setFavs(data)
    } catch { message.error('加载收藏失败') }
    finally { setLoading(false) }
  }

  const handleUnfavorite = async (id: number) => {
    try {
      await deleteFavorite(id)
      setFavs(prev => prev.filter(f => f.id !== id))
      message.success('已取消收藏')
    } catch { message.error('操作失败') }
  }

  const filtered = subTab === 'all' ? favs : favs.filter(f => f.item_type === subTab)

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
  if (favs.length === 0) return <Empty description="暂无收藏" />

  return (
    <div>
      <Tabs activeKey={subTab} onChange={setSubTab}
        items={[
          { key: 'all', label: '全部' },
          { key: 'heritage', label: '展品' },
          { key: 'generated', label: '作品' },
          { key: 'user_upload', label: '用户上传' },
        ]}
        style={{ marginBottom: 16 }}
      />
      <List
        dataSource={filtered}
        renderItem={item => (
          <List.Item
            extra={
              <Button type="link" danger onClick={() => handleUnfavorite(item.id)}>
                取消收藏
              </Button>
            }
          >
            <List.Item.Meta
              avatar={
                item.image_url
                  ? <Image src={normalizeImageUrl(item.image_url)} width={80} height={60} style={{ borderRadius: 6, objectFit: 'cover' }} preview={false} />
                  : <ImageIcon size={48} style={{ color: 'var(--color-border-medium)' }} />
              }
              title={<Text strong>{item.title}</Text>}
              description={
                <Space size={8}>
                  {item.category && <Tag>{item.category}</Tag>}
                  <Tag color="purple">
                    {item.item_type === 'heritage' ? '展品' : item.item_type === 'generated' ? '作品' : '用户上传'}
                  </Tag>
                  {item.creator && <Text type="secondary">by {item.creator}</Text>}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </div>
  )
}

// ========== 个人设置 Tab ==========

function SettingsTab({
  profile, onUpdate, updateUser,
}: {
  profile: UserProfile | null
  onUpdate: (p: UserProfile) => void
  updateUser: (updates: Partial<{ id: number; username: string; nickname: string; avatar_url: string }>) => void
}) {
  const [loading, setLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [cropperOpen, setCropperOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // 裁剪确认 → 上传
  const handleCropConfirm = async (croppedFile: File) => {
    setCropperOpen(false)
    setPendingFile(null)
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', croppedFile)
      const res = await api.post('/api/user/upload-avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      const url = res.data.url
      setAvatarPreview(URL.createObjectURL(croppedFile))
      const updated = await updateProfile({ nickname: profile!.nickname, avatar_url: url })
      onUpdate(updated)
      updateUser({ nickname: profile!.nickname, avatar_url: url })
      message.success('头像上传成功')
    } catch (err: any) {
      message.error(err.response?.data?.detail || '头像上传失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (values: { nickname: string; avatar_url: string }) => {
    setLoading(true)
    try {
      const updated = await updateProfile(values)
      onUpdate(updated)
      updateUser({ nickname: values.nickname, avatar_url: values.avatar_url })
      message.success('保存成功')
    } catch { message.error('保存失败') }
    finally { setLoading(false) }
  }

  if (!profile) return <Spin />

  const displayAvatar = avatarPreview || profile?.avatar_url
    ? normalizeImageUrl(avatarPreview || profile.avatar_url || '')
    : null

  return (
    <div style={{ maxWidth: 400 }}>
      <Form
        layout="vertical"
        initialValues={{ nickname: profile.nickname, avatar_url: profile.avatar_url }}
        onFinish={handleSubmit}
      >
        <Form.Item label="用户信息">
          <Space>
            {displayAvatar ? (
              <Avatar size={88} src={displayAvatar} />
            ) : (
              <div style={{
                width: 88, height: 88, borderRadius: '50%', background: 'var(--color-vermilion)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-paper-white)', fontSize: 36, fontWeight: 'bold',
              }}>
                {profile.nickname?.[0] || profile.username[0] || <User size={36} />}
              </div>
            )}
            <div>
              <Text strong style={{ fontSize: 16 }}>{profile.nickname || '未设置昵称'}</Text>
              <br />
              <Text type="secondary">@{profile.username}</Text>
            </div>
          </Space>
        </Form.Item>

        <Form.Item name="nickname" label="昵称" rules={[{ max: 50, message: '最多50个字符' }]}>
          <Input placeholder="设置你的昵称" />
        </Form.Item>

        <Form.Item label="头像">
          <Upload
            accept="image/jpeg,image/png,image/webp"
            maxCount={1}
            showUploadList={false}
            beforeUpload={async (file) => {
              const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
              if (!allowedTypes.includes(file.type)) {
                message.error('请上传 JPG / PNG / WebP 格式的图片')
                return false
              }
              if (file.size > 10 * 1024 * 1024) {
                message.error('图片大小不能超过 10MB')
                return false
              }
              setPendingFile(file)
              setCropperOpen(true)
              return false
            }}
          >
            <div style={{ cursor: 'pointer' }}>
              {displayAvatar ? (
                <div style={{ textAlign: 'center' }}>
                  <Avatar size={120} src={displayAvatar} />
                  <br />
                  <Button type="link" style={{ padding: 0, marginTop: 8 }}>更换头像</Button>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 120, height: 120, borderRadius: '50%',
                    background: 'var(--color-paper, #F7F4ED)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px dashed var(--color-gold, #C4A265)',
                  }}>
                    <Camera size={40} color="var(--color-ink-secondary, #6B5F52)" />
                  </div>
                  <br />
                  <Button type="link" style={{ padding: 0, marginTop: 8 }}>上传头像</Button>
                </div>
              )}
            </div>
          </Upload>
        </Form.Item>

        {/* 隐藏域保存 avatar_url（表单提交时使用） */}
        <Form.Item name="avatar_url" hidden>
          <Input />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存设置
          </Button>
        </Form.Item>
      </Form>

      <Card title="偏好" size="small" style={{ marginTop: 16 }}>
        <div>
          <Text type="secondary">语音播报速度: {profile.voice_speed}x</Text>
          <br />
          <Text type="secondary">界面主题: {profile.theme === 'light' ? '浅色' : profile.theme}</Text>
        </div>
      </Card>

      {/* 头像裁剪弹窗 */}
      <AvatarCropper
        open={cropperOpen}
        file={pendingFile}
        onConfirm={handleCropConfirm}
        onCancel={() => { setCropperOpen(false); setPendingFile(null) }}
      />
    </div>
  )
}

// ========== Card 底部仪表盘：修习状态 + 活动足迹 ==========

const RANK_THRESHOLDS = [0, 100, 300, 800, 2000]

function DashboardFooter() {
  const status = useCultivationStore(s => s.status)
  const [stats, setStats] = useState<UserStatistics | null>(null)

  useEffect(() => {
    getStatistics().then(setStats).catch(() => {})
  }, [])

  // 同步拉取修习状态（如果 store 尚未加载）
  useEffect(() => {
    if (!status) {
      useCultivationStore.getState().refreshStatus()
    }
  }, [])

  const rankPercent = status && status.xp_to_next > 0
    ? Math.round(((status.xp - RANK_THRESHOLDS[status.rank_index]) /
        (RANK_THRESHOLDS[status.rank_index + 1] - RANK_THRESHOLDS[status.rank_index])) * 100)
    : status ? 100 : 0

  // 活动项配置
  const activityItems = stats ? [
    { icon: 'camera', count: stats.recognition_count, label: '识别' },
    { icon: 'palette', count: stats.generation_count, label: '作品' },
    { icon: 'message-circle', count: stats.chat_count, label: '对话' },
    { icon: 'wrench', count: stats.restoration_count, label: '修复' },
  ] : []

  return (
    <div style={{ padding: '8px 4px 4px' }}>
      {/* ── 上排：段位 + 经验条 + 连续天数 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 18,
      }}>
        {status ? (
          <>
            {/* 左侧：段位 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {(() => {
                const cfg = RANK_ICON_CONFIG[status.rank_index] || RANK_ICON_CONFIG[0]
                const RankIconComp = cfg.icon
                return <RankIconComp size={32} color={cfg.color} />
              })()}
              <div>
                <Text strong style={{ fontSize: 'var(--text-sm)' }}>{status.rank}</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <Progress
                    percent={rankPercent}
                    size="small"
                    style={{ width: 140, margin: 0, lineHeight: 1 }}
                    strokeColor="var(--color-gold, #C4A265)"
                    trailColor="rgba(196,162,101,0.12)"
                    showInfo={false}
                  />
                  <Text type="secondary" style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                    {status.xp_to_next > 0 ? `距下段 ${status.xp_to_next} XP` : '已达巅峰'}
                  </Text>
                </div>
              </div>
            </div>

            {/* 右侧：连续天数 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, rgba(232,112,64,0.08), rgba(232,112,64,0.02))',
              borderRadius: 12, padding: '10px 16px',
            }}>
              <Flame size={22} color="#E87040" style={{ filter: 'drop-shadow(0 0 4px rgba(232,112,64,0.3))' }} />
              <div>
                <Text strong style={{ fontSize: 20, color: '#E87040', lineHeight: 1 }}>{status.streak_days}</Text>
                <Text type="secondary" style={{ fontSize: 'var(--text-xs)', display: 'block' }}>连续天数</Text>
              </div>
            </div>
          </>
        ) : (
          <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>修习数据加载中...</Text>
        )}
      </div>

      {/* ── 下排：活动足迹 ── */}
      {activityItems.length > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-around',
          padding: '14px 0 6px',
          borderTop: '1px dashed rgba(196,162,101,0.2)',
        }}>
          {activityItems.map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 4 }}><Icon name={item.icon} size={22} /></div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-vermilion, #B8463A)', lineHeight: 1 }}>
                {item.count}
              </div>
              <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>{item.label}</Text>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
