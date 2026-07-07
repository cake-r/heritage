import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Card, Typography, Tabs, Radio, Checkbox, Slider, Input, Button,
  Row, Col, Spin, Image, Space, Tag, message, Empty, Pagination,
  Upload, Tooltip,
} from 'antd'
import {
  ImageIcon, Download, Heart,
  Send, Loader2,
  Eye, UploadIcon, ChevronLeft,
} from 'lucide-react'
import {
  textToImage, imageToImage, getGallery, getDetail,
  type GenerationResult, type GenerationItem,
} from '../services/generation'
import { normalizeImageUrl } from '../utils/imageUrl'

const { Title, Text } = Typography

// ========== 常量配置 ==========

const STYLES = [
  '剪纸', '苏绣', '皮影', '蓝印花布', '年画',
  '唐三彩', '青花瓷', '京剧脸譜', '敦煌', '苗银',
]

const ELEMENTS = [
  '祥云纹', '牡丹花', '回纹边框', '龙纹', '凤纹',
  '青花配色', '敦煌配色', '景泰蓝配色', '水墨风',
]

const PALETTES = ['', '青花瓷蓝白', '敦煌赭红石绿', '景泰蓝宝石色', '水墨黑白']

const COMPOSITIONS = ['', '中心对称', '散点透视', '长卷式', '团扇式', '留白']

// ========== 页面主组件 ==========

export default function CreativeStudio() {
  const [activeTab, setActiveTab] = useState<'create' | 'gallery'>('create')
  const [searchParams] = useSearchParams()
  const workIdParam = searchParams.get('work')

  // 支持 ?work=xxx 从个人中心跳转查看作品详情
  if (workIdParam) {
    return <WorkDetailView workId={parseInt(workIdParam, 10)} />
  }

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      <Title level={3}>🎨 AI非遗文创生成工作室</Title>

      <Tabs
        activeKey={activeTab}
        onChange={k => setActiveTab(k as 'create' | 'gallery')}
        items={[
          { key: 'create', label: <span><ImageIcon size={18} /> 创作</span> },
          { key: 'gallery', label: <span><Eye /> 画廊</span> },
        ]}
        style={{ marginBottom: 16 }}
      />

      {activeTab === 'create' ? <CreationPanel /> : <GalleryPanel />}
    </div>
  )
}

// ========== 创作面板 ==========

function CreationPanel() {
  const [mode, setMode] = useState<'text2img' | 'img2img'>('text2img')
  const [style, setStyle] = useState('苏绣')
  const [elements, setElements] = useState<string[]>([])
  const [palette, setPalette] = useState('')
  const [composition, setComposition] = useState('')
  const [intensity, setIntensity] = useState(70)
  const [count, setCount] = useState(2)
  const [negative, setNegative] = useState('')
  const [refFile, setRefFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerationResult | null>(null)

  const handleGenerate = async () => {
    if (mode === 'img2img' && !refFile) {
      message.warning('请上传参考图片')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const params = { base_style: style, elements, color_palette: palette, composition, intensity: intensity / 100, negative_prompt: negative, count }
      const data = mode === 'text2img'
        ? await textToImage(params)
        : await imageToImage(refFile!, params)
      setResult(data)
      message.success('生成完成！')
      // 通知伴游：完成创作操作
      window.dispatchEvent(new CustomEvent('companion:action', { detail: { action: 'just_completed_generation' } }))
      window.dispatchEvent(new CustomEvent('cultivation:check'))
    } catch (err: any) {
      message.error(err.message || '生成失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Row gutter={24}>
      {/* 左侧: 参数面板 */}
      <Col xs={24} lg={10}>
        <Card title="创作参数" style={{ borderRadius: 12, marginBottom: 16 }}>
          {/* 模式 */}
          <div style={{ marginBottom: 20 }}>
            <Text strong>生成模式</Text>
            <Radio.Group value={mode} onChange={e => setMode(e.target.value)} style={{ marginTop: 8, width: '100%' }}>
              <Radio.Button value="text2img" style={{ width: '50%', textAlign: 'center' }}>文生图</Radio.Button>
              <Radio.Button value="img2img" style={{ width: '50%', textAlign: 'center' }}>图生图</Radio.Button>
            </Radio.Group>
          </div>

          {/* 图生图参考图 */}
          {mode === 'img2img' && (
            <div style={{ marginBottom: 20 }}>
              <Text strong>参考图片</Text>
              <Upload
                accept="image/*"
                maxCount={1}
                showUploadList={false}
                beforeUpload={file => {
                  const isImage = file.type.startsWith('image/')
                  if (!isImage) { message.error('只能上传图片文件'); return false }
                  const isLt10M = (file as any).size / 1024 / 1024 < 10
                  if (!isLt10M) { message.error('图片大小不能超过 10MB'); return false }
                  setRefFile(file); return false
                }}
                style={{ marginTop: 8 }}
              >
                <Button icon={<UploadIcon size={18} />} block>
                  {refFile ? refFile.name : '点击上传参考图'}
                </Button>
              </Upload>
              {refFile && (
                <img src={URL.createObjectURL(refFile)} alt="ref"
                  style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />
              )}
            </div>
          )}

          {/* 风格选择 */}
          <div style={{ marginBottom: 20 }}>
            <Text strong>非遗风格</Text>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STYLES.map(s => (
                <Tag
                  key={s}
                  color={style === s ? 'var(--color-vermilion, #B8463A)' as any : 'default'}
                  style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 'var(--text-sm)' }}
                  onClick={() => setStyle(s)}
                >
                  {s}
                </Tag>
              ))}
            </div>
          </div>

          {/* 元素勾选 */}
          <div style={{ marginBottom: 20 }}>
            <Text strong>附加元素（可选）</Text>
            <Checkbox.Group value={elements} onChange={v => setElements(v as string[])} style={{ marginTop: 8, width: '100%' }}>
              <Row gutter={[8, 8]}>
                {ELEMENTS.map(e => (
                  <Col span={8} key={e}><Checkbox value={e}>{e}</Checkbox></Col>
                ))}
              </Row>
            </Checkbox.Group>
          </div>

          {/* 配色 */}
          <div style={{ marginBottom: 20 }}>
            <Text strong>配色方案</Text>
            <Radio.Group value={palette} onChange={e => setPalette(e.target.value)} style={{ marginTop: 8 }}>
              {PALETTES.map(p => (
                <Radio.Button key={p || '默认'} value={p} style={{ fontSize: 12 }}>{p || '默认'}</Radio.Button>
              ))}
            </Radio.Group>
          </div>

          {/* 构图 */}
          <div style={{ marginBottom: 20 }}>
            <Text strong>构图</Text>
            <Radio.Group value={composition} onChange={e => setComposition(e.target.value)} style={{ marginTop: 8 }}>
              {COMPOSITIONS.map(c => (
                <Radio.Button key={c || '默认'} value={c} style={{ fontSize: 12 }}>{c || '默认'}</Radio.Button>
              ))}
            </Radio.Group>
          </div>

          {/* 风格强度 */}
          <div style={{ marginBottom: 20 }}>
            <Text strong>风格强度: {intensity}%</Text>
            <Slider value={intensity} onChange={setIntensity} min={0} max={100}
              marks={{ 0: '轻融合', 50: '平衡', 100: '强融合' }} />
          </div>

          {/* 生成数量 */}
          <div style={{ marginBottom: 20 }}>
            <Text strong>生成数量</Text>
            <Radio.Group value={count} onChange={e => setCount(e.target.value)} style={{ marginTop: 8 }}>
              {[1, 2, 4].map(n => <Radio.Button key={n} value={n}>{n}张</Radio.Button>)}
            </Radio.Group>
          </div>

          {/* 负向提示 */}
          <div style={{ marginBottom: 20 }}>
            <Text strong>负向提示词（可选）</Text>
            <Input.TextArea
              value={negative}
              onChange={e => setNegative(e.target.value)}
              placeholder="描述你不希望出现的元素，如: 低质量, 模糊, 西方风格"
              rows={2}
              style={{ marginTop: 8 }}
            />
          </div>

          {/* 生成按钮 */}
          <Button
            type="primary"
            size="large"
            icon={loading ? <Loader2 /> : <Send />}
            loading={loading}
            onClick={handleGenerate}
            block
            style={{ height: 48, fontSize: 16, borderRadius: 8 }}
          >
            {loading ? '生成中...' : '开始生成'}
          </Button>
        </Card>
      </Col>

      {/* 右侧: 结果 */}
      <Col xs={24} lg={14}>
        <Card title="生成结果" style={{ borderRadius: 12, minHeight: 400 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <Spin size="large" />
              <p style={{ marginTop: 16, color: '#999' }}>AI正在创作中，请耐心等待...</p>
            </div>
          )}

          {!loading && !result && (
            <Empty description="配置参数后点击「开始生成」" style={{ padding: 60 }} />
          )}

          {result && (
            <div>
              <Image.PreviewGroup>
                <Row gutter={[12, 12]}>
                  {result.images.map((img, i) => (
                    <Col span={result.images.length <= 2 ? 12 : 12} key={i}>
                      <ResultCard image={img} index={i} result={result} />
                    </Col>
                  ))}
                </Row>
              </Image.PreviewGroup>

              {/* 参数面板 */}
              <Card size="small" style={{ marginTop: 16, background: 'var(--color-bg-hover, #F5F5F0)' }}>
                <Space wrap size="small">
                  <Tag color="blue">Seed: {result.seed}</Tag>
                  <Tag>{result.params.base_style}</Tag>
                  <Button size="small" onClick={() => {
                    navigator.clipboard.writeText(result.prompt_used)
                    message.success('Prompt已复制')
                  }}>
                    复制Prompt
                  </Button>
                </Space>
              </Card>
            </div>
          )}
        </Card>
      </Col>
    </Row>
  )
}

// ========== 结果卡片 ==========

function ResultCard({ image, index, result }: { image: string; index: number; result: GenerationResult }) {
  const handleDownload = async () => {
    try {
      const resp = await fetch(image)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `ich_creation_${result.id}_${index + 1}.png`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('下载失败')
    }
  }

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <Image src={image} alt={`生成 ${index + 1}`}
        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }}
        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
      />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'var(--color-deep, rgba(30,27,24,0.85))', padding: '6px 8px',
        display: 'flex', justifyContent: 'center', gap: 8,
      }}>
        <Tooltip title="下载"><Button size="small" type="text" ghost icon={<Download />} onClick={handleDownload} /></Tooltip>
        <Tooltip title="收藏"><Button size="small" type="text" ghost icon={<Heart />} /></Tooltip>
      </div>
    </div>
  )
}

// ========== 画廊面板 ==========

function GalleryPanel() {
  const [items, setItems] = useState<GenerationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    loadGallery(page)
  }, [page])

  const loadGallery = async (p: number) => {
    setLoading(true)
    try {
      const data = await getGallery(p, 12)
      setItems(data.items)
      setTotal(data.total)
    } catch {
      message.error('加载画廊失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ borderRadius: 12 }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : items.length === 0 ? (
        <Empty description="画廊暂无作品" style={{ padding: 60 }} />
      ) : (
        <>
          <Image.PreviewGroup>
            <Row gutter={[16, 16]}>
              {items.map(item => (
                <Col xs={12} sm={8} md={6} lg={6} key={item.id}>
                  <Card
                    hoverable
                    size="small"
                    cover={
                      <Image src={normalizeImageUrl(item.images[0])} alt={item.base_style}
                        style={{ aspectRatio: '1', objectFit: 'cover' }}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                      />
                    }
                    bodyStyle={{ padding: '8px 12px' }}
                  >
                    <Text strong style={{ fontSize: 'var(--text-sm)' }}>{item.base_style}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{item.prompt.slice(0, 40)}...</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Image.PreviewGroup>
          {total > 12 && (
            <Pagination current={page} total={total} pageSize={12} onChange={setPage}
              style={{ textAlign: 'center', marginTop: 24 }} />
          )}
        </>
      )}
    </Card>
  )
}

// ========== 作品详情视图（从个人中心跳转） ==========

function WorkDetailView({ workId }: { workId: number }) {
  const [work, setWork] = useState<GenerationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isNaN(workId)) {
      setLoading(true)
      getDetail(workId)
        .then(data => { setWork(data); setLoading(false) })
        .catch(err => { setError(err.message || '加载作品失败'); setLoading(false) })
    }
  }, [workId])

  if (loading) {
    return (
      <div style={{ maxWidth: 1300, margin: '0 auto', textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip="加载作品详情..." />
      </div>
    )
  }

  if (error || !work) {
    return (
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <Empty description={error || '作品不存在'} style={{ padding: 80 }}>
          <Button type="primary" onClick={() => window.history.back()}>返回</Button>
        </Empty>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<ChevronLeft />} onClick={() => window.history.back()}>返回</Button>
        <Title level={3} style={{ margin: 0 }}>🎨 作品详情</Title>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Image.PreviewGroup>
          <Row gutter={[12, 12]}>
            {work.images.map((img, i) => (
              <Col span={work.images.length <= 2 ? 12 : 8} key={i}>
                <Image src={normalizeImageUrl(img)} alt={`生成结果 ${i + 1}`}
                  style={{ width: '100%', borderRadius: 8, aspectRatio: '1', objectFit: 'cover' }}
                />
              </Col>
            ))}
          </Row>
        </Image.PreviewGroup>
      </Card>

      <Card size="small" style={{ background: 'var(--color-bg-hover, #F5F5F0)', borderRadius: 12 }}>
        <Space wrap size="small">
          <Tag color="blue">Seed: {work.seed}</Tag>
          <Tag>{work.params.base_style || '未知风格'}</Tag>
          <Text type="secondary" style={{ fontSize: 'var(--text-sm)' }}>
            创建于 {new Date(work.created_at).toLocaleDateString('zh-CN')}
          </Text>
        </Space>
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ fontSize: 'var(--text-sm)' }}>Prompt: </Text>
          <Text style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-secondary)' }}>{work.prompt_used}</Text>
        </div>
      </Card>
    </div>
  )
}
