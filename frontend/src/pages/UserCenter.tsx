import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Layout, Menu, Card, Typography, Spin, Empty, Button,
  List, Image, Tag, Space, Input, Form, message, Popconfirm, Tabs, Tooltip,
} from 'antd'
import {
  Camera, ImageIcon, MessageCircle,
  Heart, Settings, Wrench,
  Trash2, ChevronRight,
  User,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getProfile, updateProfile, listFavorites, deleteFavorite,
  type UserProfile, type FavoriteItem,
} from '../services/user'
import { getHistory as getRecognitionHistory, deleteRecognition, type RecognitionListItem } from '../services/recognition'
import { getHistory as getGenerationHistory, deleteWork, type GenerationItem } from '../services/generation'
import { getHistory as getRestorationHistory, deleteRestoration, type RestorationListItem } from '../services/restoration'
import { normalizeImageUrl } from '../utils/imageUrl'

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
  const { user } = useAuth()

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
      case 'settings': return <SettingsTab profile={profile} onUpdate={setProfile} />
      default: return <Empty description="未知页面" />
    }
  }

  return (
    <Layout style={{ background: 'transparent' }}>
      <Sider width={180} style={{ background: '#fff', borderRadius: 12, marginRight: 24 }}>
        {/* 用户信息卡片 */}
        <div style={{ padding: '20px 16px 12px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#C41E3A',
            margin: '0 auto 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 24, fontWeight: 'bold',
          }}>
            {profile?.nickname?.[0] || user?.username?.[0] || <User />}
          </div>
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

      <Content>
        <Card style={{ borderRadius: 12, minHeight: 500 }}>
          <Title level={3} style={{ marginTop: 0 }}>
            {tabs.find(t => t.key === tab)?.label}
          </Title>
          <div style={{ marginTop: 16 }}>{renderContent()}</div>
        </Card>
      </Content>
    </Layout>
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
      setRecords(data.items)
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
              <div style={{ height: 160, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImageIcon size={48} style={{ color: 'var(--color-border-medium)' }} />
              </div>
            )
          }
          bodyStyle={{ padding: '8px 12px' }}
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
  return <Empty description="对话历史 — 待模块③实现后接入" style={{ padding: 60 }} />
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
      setRecords(data.items)
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
  profile, onUpdate,
}: {
  profile: UserProfile | null
  onUpdate: (p: UserProfile) => void
}) {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { nickname: string; avatar_url: string }) => {
    setLoading(true)
    try {
      const updated = await updateProfile(values)
      onUpdate(updated)
      message.success('保存成功')
    } catch { message.error('保存失败') }
    finally { setLoading(false) }
  }

  if (!profile) return <Spin />

  return (
    <div style={{ maxWidth: 400 }}>
      <Form
        layout="vertical"
        initialValues={{ nickname: profile.nickname, avatar_url: profile.avatar_url }}
        onFinish={handleSubmit}
      >
        <Form.Item label="用户信息">
          <Space>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#C41E3A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 28, fontWeight: 'bold',
            }}>
              {profile.nickname?.[0] || profile.username[0] || <User />}
            </div>
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

        <Form.Item name="avatar_url" label="头像URL" rules={[{ type: 'url', message: '请输入有效的URL' }]}>
          <Input placeholder="输入头像图片URL (可选)" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存设置
          </Button>
        </Form.Item>
      </Form>

      <Card title="统计信息" size="small" style={{ marginTop: 24 }}>
        <SimpleStats />
      </Card>

      <Card title="偏好" size="small" style={{ marginTop: 16 }}>
        <div>
          <Text type="secondary">语音播报速度: {profile.voice_speed}x</Text>
          <br />
          <Text type="secondary">界面主题: {profile.theme === 'light' ? '浅色' : profile.theme}</Text>
        </div>
      </Card>
    </div>
  )
}

// ========== 统计小部件 ==========

function SimpleStats() {
  const [stats, setStats] = useState<{
    recognition_count: number
    generation_count: number
    chat_count: number
    favorite_count: number
    upload_count: number
  } | null>(null)

  useEffect(() => {
    import('../services/user').then(({ getStatistics }) => {
      getStatistics().then(setStats).catch(() => {})
    })
  }, [])

  if (!stats) return <Spin size="small" />

  return (
    <Space size={24} wrap>
      <div><Text strong style={{ fontSize: 20, color: '#C41E3A' }}>{stats.recognition_count}</Text><br /><Text type="secondary">识别记录</Text></div>
      <div><Text strong style={{ fontSize: 20, color: '#C41E3A' }}>{stats.generation_count}</Text><br /><Text type="secondary">生成作品</Text></div>
      <div><Text strong style={{ fontSize: 20, color: '#C41E3A' }}>{stats.chat_count}</Text><br /><Text type="secondary">对话次数</Text></div>
      <div><Text strong style={{ fontSize: 20, color: '#C41E3A' }}>{stats.favorite_count}</Text><br /><Text type="secondary">收藏</Text></div>
      <div><Text strong style={{ fontSize: 20, color: '#C41E3A' }}>{stats.upload_count}</Text><br /><Text type="secondary">上传作品</Text></div>
    </Space>
  )
}
