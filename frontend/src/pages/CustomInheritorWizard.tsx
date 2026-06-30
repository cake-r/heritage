import { useState, useEffect, useCallback } from 'react'
import { Steps, Button, Card, Input, Select, Form, Spin, Tag, message, Space, Avatar, Row, Col } from 'antd'
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined,
  UserOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  getCatalog, generatePersona, createInheritor, generateAvatar,
  type CategoryInfo, type GeneratePersonaRequest, type GeneratePersonaResponse,
} from '../services/inheritor'

const ALL_CATEGORIES = ['suxiu', 'xiangxiu', 'shuxiu', 'yuexiu', 'jianzhi', 'piying', 'nianhua', 'lanbuhua', 'tangsancai', 'qinghua', 'zisha', 'jingju', 'dunhuang', 'miaoyin', 'jingtailan', 'muban', 'shufa', 'zhuanke', 'dongyang']

const TOOL_OPTIONS = [
  { id: 'inspect', name: '识物·品鉴', icon: '🔍', desc: '上传非遗作品图片，AI分析工艺技法和风格特征', supportedBy: ['suxiu', 'xiangxiu', 'shuxiu', 'yuexiu', 'jianzhi', 'tangsancai', 'qinghua', 'zisha', 'jingtailan', 'dongyang'] },
  { id: 'create', name: '创作·生成', icon: '🎨', desc: 'AI生成非遗艺术图案、纹样和设计作品', supportedBy: ['jianzhi', 'piying', 'nianhua', 'lanbuhua', 'tangsancai', 'qinghua', 'jingju', 'dunhuang', 'miaoyin', 'muban', 'shufa', 'zhuanke', 'dongyang'] },
  { id: 'connect', name: '博学·关联', icon: '🔗', desc: '从知识图谱中发现不同非遗品类之间的文化关联', supportedBy: ALL_CATEGORIES },
  { id: 'teach', name: '教学·答疑', icon: '📖', desc: '自动生成系统化的入门课程，从基础技法到实践项目', supportedBy: ALL_CATEGORIES },
  { id: 'pattern', name: '纹样·提取', icon: '🏮', desc: '上传纹样图片，AI提取并分析母题、对称性、文化寓意', supportedBy: ['suxiu', 'xiangxiu', 'shuxiu', 'yuexiu', 'jianzhi', 'nianhua', 'lanbuhua', 'tangsancai', 'qinghua', 'jingtailan', 'dunhuang', 'muban', 'dongyang'] },
  { id: 'story', name: '故事·讲述', icon: '📜', desc: '根据主题生成非遗传说、匠人轶事，寓教于乐', supportedBy: ALL_CATEGORIES },
  { id: 'compare', name: '对比·鉴赏', icon: '⚖️', desc: '对比两个非遗项目的技法、风格、历史背景异同', supportedBy: ALL_CATEGORIES },
]

export default function CustomInheritorWizard() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<CategoryInfo[]>([])

  // Step 1 state
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [personality, setPersonality] = useState('')
  const [bio, setBio] = useState('')

  // Step 2 state
  const [selectedTools, setSelectedTools] = useState<string[]>([])

  // Step 3 state
  const [generated, setGenerated] = useState<GeneratePersonaResponse | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [createdId, setCreatedId] = useState<number | null>(null)

  useEffect(() => {
    getCatalog().then(setCategories).catch(() => message.error('加载品类列表失败'))
  }, [])

  // 品类选择变化时自动推荐工具
  useEffect(() => {
    if (category) {
      const recommended = TOOL_OPTIONS
        .filter(t => t.supportedBy.includes(category))
        .slice(0, 2)
        .map(t => t.id)
      setSelectedTools(prev => prev.length === 0 ? recommended : prev)
    }
  }, [category])

  const next = () => setCurrent(prev => prev + 1)
  const prev = () => setCurrent(prev => Math.max(0, prev - 1))

  // Step 1 validation
  const step1Valid = name.length >= 2 && name.length <= 20 && category && bio.length > 0

  // Step 2 validation
  const step2Valid = selectedTools.length >= 1

  // Handle persona generation (step 2 → 3)
  const handleGenerate = async () => {
    setLoading(true)
    try {
      const req: GeneratePersonaRequest = {
        name,
        category: categories.find(c => c.id === category)?.name || category,
        personality,
        bio,
        selected_tools: selectedTools,
        expertise: selectedTools.map(t => {
          const tool = TOOL_OPTIONS.find(to => to.id === t)
          return tool ? tool.name : t
        }),
      }
      const result = await generatePersona(req)
      setGenerated(result)
      setCurrent(2)
    } catch (err: any) {
      message.error(err.message || '生成失败')
    } finally {
      setLoading(false)
    }
  }

  // Handle avatar generation
  const handleGenerateAvatar = async () => {
    if (!createdId) return
    setAvatarLoading(true)
    try {
      const result = await generateAvatar(createdId)
      setAvatarUrl(result.avatar_url)
    } catch (err: any) {
      message.error(err.message || '头像生成失败')
    } finally {
      setAvatarLoading(false)
    }
  }

  // Handle final creation
  const handleCreate = async () => {
    if (!generated) return
    setLoading(true)
    try {
      const result = await createInheritor({
        name,
        category: categories.find(c => c.id === category)?.name || category,
        persona: generated.persona,
        greeting: generated.greeting,
        tools: selectedTools,
        domain_prompts: {},
        style: generated.style,
        expertise: selectedTools.map(t => TOOL_OPTIONS.find(to => to.id === t)?.name || t),
      })
      setCreatedId(result.id)
      message.success('传承人创建成功！')

      // 自动生成头像
      try {
        const avResult = await generateAvatar(result.id)
        setAvatarUrl(avResult.avatar_url)
      } catch { /* 头像失败不影响创建 */ }
    } catch (err: any) {
      message.error(err.message || '创建失败')
    } finally {
      setLoading(false)
    }
  }

  const handleGoToWorkshop = () => {
    if (createdId) {
      navigate(`/workshop`)
    }
  }

  return (
    <div style={{
      maxWidth: 640,
      margin: '0 auto',
      padding: '32px 16px',
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: 32, fontSize: 22, fontWeight: 700 }}>
        🏮 创建自定义传承人
      </h2>

      <Steps
        current={current}
        size="small"
        style={{ marginBottom: 32 }}
        items={[
          { title: '定基' },
          { title: '选器' },
          { title: '生成' },
        ]}
      />

      {/* Step 1: 定基 */}
      {current === 0 && (
        <Card>
          <Form layout="vertical" size="large">
            <Form.Item label="传承人名称" required>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="给你的传承人起个名字（2-20字）"
                maxLength={20}
              />
            </Form.Item>
            <Form.Item label="非遗品类" required>
              <Select
                value={category || undefined}
                onChange={setCategory}
                placeholder="选择传承人专精的非遗品类"
                options={categories.map(c => ({
                  value: c.id,
                  label: `${c.icon} ${c.name}`,
                }))}
              />
            </Form.Item>
            <Form.Item label="性格特征">
              <Input.TextArea
                value={personality}
                onChange={e => setPersonality(e.target.value)}
                placeholder="描述传承人的性格（可选）：如温柔耐心、豪爽直率、沉稳有哲理..."
                rows={2}
                maxLength={500}
              />
            </Form.Item>
            <Form.Item label="一句话简介" required>
              <Input.TextArea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="用一句话介绍你的传承人（100字以内）"
                rows={2}
                maxLength={200}
              />
            </Form.Item>
          </Form>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button type="primary" onClick={next} disabled={!step1Valid} icon={<ArrowRightOutlined />}>
              下一步：选器
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: 选器 */}
      {current === 1 && (
        <Card>
          <p style={{ color: 'var(--color-ink-secondary, #6B5F52)', marginBottom: 16 }}>
            为传承人选择能力工具（至少一个）。选中的工具将出现在工坊右侧工具箱中。
          </p>
          <Row gutter={[12, 12]}>
            {TOOL_OPTIONS.map(tool => {
              const checked = selectedTools.includes(tool.id)
              const supported = tool.supportedBy.includes(category)
              return (
                <Col span={12} key={tool.id}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => {
                      if (!supported) return
                      setSelectedTools(prev =>
                        checked ? prev.filter(t => t !== tool.id) : [...prev, tool.id]
                      )
                    }}
                    style={{
                      border: checked ? '2px solid var(--color-vermilion, #B8463A)' : '1px solid var(--color-paper, #F7F4ED)',
                      opacity: supported ? 1 : 0.4,
                      cursor: supported ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 24 }}>{tool.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {checked && <CheckOutlined style={{ color: 'var(--color-vermilion, #B8463A)', marginRight: 4 }} />}
                          {tool.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary, #6B5F52)' }}>
                          {tool.desc}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <Button onClick={prev} icon={<ArrowLeftOutlined />}>上一步</Button>
            <Button
              type="primary"
              onClick={handleGenerate}
              disabled={!step2Valid}
              loading={loading}
              icon={<ArrowRightOutlined />}
            >
              生成人设
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: 生成 */}
      {current === 2 && (
        <Card>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin size="large" />
              <p style={{ marginTop: 16, color: 'var(--color-vermilion, #B8463A)' }}>
                正在召唤传承人...
              </p>
            </div>
          ) : createdId ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <CheckOutlined style={{ fontSize: 48, color: 'var(--color-success, #4A8C5C)' }} />
              <h3 style={{ margin: '16px 0 8px' }}>创建成功！</h3>
              {avatarUrl && (
                <Avatar size={80} src={avatarUrl} icon={<UserOutlined />} style={{ marginBottom: 16 }} />
              )}
              <p style={{ color: 'var(--color-ink-secondary, #6B5F52)' }}>
                「{name}」已加入你的传承人列表
              </p>
              <Space style={{ marginTop: 16 }}>
                {!avatarUrl && (
                  <Button loading={avatarLoading} icon={<ReloadOutlined />} onClick={handleGenerateAvatar}>
                    生成头像
                  </Button>
                )}
                <Button type="primary" onClick={handleGoToWorkshop}>
                  前往工坊
                </Button>
              </Space>
            </div>
          ) : generated ? (
            <>
              <h4>人设生成结果</h4>
              <Form layout="vertical" size="small">
                <Form.Item label="角色设定 (System Prompt)">
                  <Input.TextArea
                    value={generated.persona}
                    onChange={e => setGenerated({ ...generated, persona: e.target.value })}
                    rows={8}
                  />
                </Form.Item>
                <Form.Item label="问候语">
                  <Input
                    value={generated.greeting}
                    onChange={e => setGenerated({ ...generated, greeting: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label="快捷提问">
                  <Input.TextArea
                    value={generated.quick_questions.join('\n')}
                    onChange={e => setGenerated({ ...generated, quick_questions: e.target.value.split('\n').filter(Boolean) })}
                    rows={3}
                  />
                </Form.Item>
                <Form.Item label="说话风格">
                  <Input
                    value={generated.style}
                    onChange={e => setGenerated({ ...generated, style: e.target.value })}
                  />
                </Form.Item>
              </Form>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                <Button onClick={prev} icon={<ArrowLeftOutlined />}>返回修改</Button>
                <Button type="primary" onClick={handleCreate} loading={loading} icon={<CheckOutlined />}>
                  创建传承人
                </Button>
              </div>
            </>
          ) : null}
        </Card>
      )}
    </div>
  )
}
