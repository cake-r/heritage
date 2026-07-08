import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Card, Typography, Tabs, Radio, Checkbox, Slider, Input, Button,
  Row, Col, Spin, Image, Space, Tag, message, Empty, Pagination,
  Upload, Tooltip, Switch, Segmented, Drawer, Descriptions, Skeleton, Divider,
} from 'antd'
import {
  ImageIcon, Download, Heart,
  Send, Loader2,
  Eye, UploadIcon, ChevronLeft,
  Search, SlidersHorizontal, Share2, Lock, Globe, LayoutGrid, List,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  textToImage, imageToImage, getGallery, getDetail, getGalleryStyles, publishWork,
  type GenerationResult, type GenerationItem, type GalleryParams,
} from '../services/generation'
import { useAuth } from '../contexts/AuthContext'
import { normalizeImageUrl } from '../utils/imageUrl'
import { MedallionPattern } from '../components/decoration'

const { Title, Text } = Typography

// ========== 常量配置 ==========

const STYLES = [
  '剪纸', '苏绣', '皮影', '蓝印花布', '年画',
  '唐三彩', '青花瓷', '京剧脸譜', '敦煌', '苗银',
  '景泰蓝', '漆器', '蜡染', '云锦', '龙泉青瓷',
  '紫砂陶', '竹编', '泥塑', '木版年画', '缂丝',
]

const ELEMENTS = [
  '祥云纹', '牡丹花', '回纹边框', '龙纹', '凤纹',
  '青花配色', '敦煌配色', '景泰蓝配色', '水墨风',
]

const PALETTES = ['', '青花瓷蓝白', '敦煌赭红石绿', '景泰蓝宝石色', '水墨黑白', '唐三彩黄绿褐', '漆器朱红黑金', '粉彩柔粉', '青铜锈绿', '紫砂赭褐', '汝窑天青']

const COMPOSITIONS = ['', '中心对称', '散点透视', '长卷式', '团扇式', '留白', '满铺纹样', '对角呼应', '三联幅', 'S形蜿蜒']

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
    <>
      {/* 全视口纹样背景 — 洒金宣纸 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <MedallionPattern opacity={0.22} />
      </div>
      <div style={{ maxWidth: 1300, margin: '0 auto', position: 'relative', zIndex: 1 }}>
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
    </>
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
                <Radio.Button key={p || '默认'} value={p}>{p || '默认'}</Radio.Button>
              ))}
            </Radio.Group>
          </div>

          {/* 构图 */}
          <div style={{ marginBottom: 20 }}>
            <Text strong>构图</Text>
            <Radio.Group value={composition} onChange={e => setComposition(e.target.value)} style={{ marginTop: 8 }}>
              {COMPOSITIONS.map(c => (
                <Radio.Button key={c || '默认'} value={c}>{c || '默认'}</Radio.Button>
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
  const { user } = useAuth()
  const [allItems, setAllItems] = useState<GenerationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [styleFilter, setStyleFilter] = useState('')
  const [modeFilter, setModeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<'newest' | 'popular'>('newest')
  const [viewMode, setViewMode] = useState<'grid' | 'waterfall'>('grid')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<GenerationItem | null>(null)
  const [galleryStyles, setGalleryStyles] = useState<string[]>([])
  const pageSize = 12

  // 加载画廊数据 + 风格列表
  useEffect(() => {
    setLoading(true)
    Promise.all([
      getGallery({ page: 1, pageSize: 50 }),
      getGalleryStyles().catch(() => [] as string[]),
    ])
      .then(([data, styles]) => {
        setAllItems(data.items)
        setGalleryStyles(styles)
      })
      .catch(() => message.error('加载画廊失败'))
      .finally(() => setLoading(false))
  }, [])

  // 客户端筛选 + 排序
  const filteredItems = useMemo(() => {
    let result = allItems
    if (styleFilter) result = result.filter(item => item.base_style === styleFilter)
    if (modeFilter) result = result.filter(item => item.mode === modeFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(item =>
        item.prompt.toLowerCase().includes(q) || item.base_style.toLowerCase().includes(q),
      )
    }
    // 排序
    if (sortMode === 'popular') {
      result = [...result].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }
    // newest 默认保持 API 返回顺序 (created_at DESC)
    return result
  }, [allItems, styleFilter, modeFilter, searchQuery, sortMode])

  // 客户端分页
  const displayedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page])

  const totalFiltered = filteredItems.length

  const handleFilterChange = (setter: (v: any) => void, value: any) => {
    setter(value)
    setPage(1)
  }

  const handleCardClick = (item: GenerationItem) => {
    setSelectedItem(item)
    setDrawerOpen(true)
  }

  const handleDownload = async (item: GenerationItem) => {
    if (!item.images?.[0]) return
    try {
      const res = await fetch(normalizeImageUrl(item.images[0]))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `非遗文创_${item.base_style}_${item.id}.jpg`
      a.click()
      URL.revokeObjectURL(url)
      message.success('下载成功')
    } catch {
      message.error('下载失败')
    }
  }

  const handleShare = (item: GenerationItem) => {
    const url = `${window.location.origin}/creative-studio?work=${item.id}`
    if (navigator.share) {
      navigator.share({ title: item.base_style, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(
        () => message.success('链接已复制'),
        () => message.error('复制失败'),
      )
    }
  }

  const handleTogglePublish = async (item: GenerationItem) => {
    try {
      await publishWork(item.id, !item.is_public)
      setAllItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, is_public: !i.is_public } : i,
      ))
      message.success(item.is_public ? '已设为私密' : '已发布到画廊')
    } catch {
      message.error('操作失败')
    }
  }

  // ===== 渲染 =====
  return (
    <>
      {/* 筛选工具栏 */}
      <Card style={{ borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          {/* 搜索 */}
          <Col xs={24} sm={6}>
            <Input
              prefix={<Search size={16} color="var(--color-ink-secondary)" />}
              placeholder="搜索作品…"
              allowClear
              value={searchQuery}
              onChange={e => handleFilterChange(setSearchQuery, e.target.value)}
              onPressEnter={() => setPage(1)}
              style={{ borderRadius: 'var(--radius-md)' }}
            />
          </Col>
          {/* 风格筛选 */}
          <Col xs={24} sm={8}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <SlidersHorizontal size={14} color="var(--color-ink-secondary)" />
              <Tag
                style={{ cursor: 'pointer', borderRadius: 'var(--radius-sm)', margin: 0 }}
                color={styleFilter === '' ? 'var(--color-vermilion)' : undefined}
                onClick={() => handleFilterChange(setStyleFilter, '')}
              >
                全部
              </Tag>
              {(galleryStyles.length > 0 ? galleryStyles : STYLES).slice(0, 10).map(s => (
                <Tag
                  key={s}
                  style={{ cursor: 'pointer', borderRadius: 'var(--radius-sm)', margin: 0 }}
                  color={styleFilter === s ? 'var(--color-vermilion)' : undefined}
                  onClick={() => handleFilterChange(setStyleFilter, styleFilter === s ? '' : s)}
                >
                  {s}
                </Tag>
              ))}
            </div>
          </Col>
          {/* 模式筛选 */}
          <Col xs={12} sm={4}>
            <Segmented
              size="small"
              value={modeFilter}
              onChange={v => handleFilterChange(setModeFilter, v as string)}
              options={[
                { label: '全部', value: '' },
                { label: '文生图', value: 'text2img' },
                { label: '图生图', value: 'img2img' },
              ]}
            />
          </Col>
          {/* 视图 + 排序 */}
          <Col xs={12} sm={3}>
            <Segmented
              size="small"
              value={viewMode}
              onChange={v => setViewMode(v as 'grid' | 'waterfall')}
              options={[
                { value: 'grid', icon: <LayoutGrid size={14} /> },
                { value: 'waterfall', icon: <List size={14} /> },
              ]}
            />
          </Col>
          <Col xs={24} sm={3}>
            <Segmented
              size="small"
              value={sortMode}
              onChange={v => setSortMode(v as 'newest' | 'popular')}
              options={[
                { label: '最新', value: 'newest' },
                { label: '热门', value: 'popular' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* 画廊主体 */}
      {loading ? (
        <Card style={{ borderRadius: 'var(--radius-lg)' }}>
          <Row gutter={[16, 16]}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Col xs={12} sm={8} md={6} lg={6} key={i}>
                <Card style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <Skeleton.Image style={{ width: '100%', height: 180 }} active />
                  <Skeleton active paragraph={{ rows: 1 }} style={{ padding: '12px 16px' }} />
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card style={{ borderRadius: 'var(--radius-lg)' }}>
          <Empty description="画廊暂无作品" style={{ padding: 60 }}>
            <Button
              type="primary"
              icon={<ImageIcon size={16} />}
              onClick={() => {
                const tabs = document.querySelector('.ant-tabs-tab')
                if (tabs) (tabs as HTMLElement).click()
              }}
            >
              去创作第一件作品
            </Button>
          </Empty>
        </Card>
      ) : (
        <Card style={{ borderRadius: 'var(--radius-lg)' }}>
          <Image.PreviewGroup>
            <Row gutter={[16, 16]}>
              {displayedItems.map((item, i) => (
                <Col
                  xs={viewMode === 'waterfall' ? 24 : 12}
                  sm={viewMode === 'waterfall' ? 12 : 8}
                  md={viewMode === 'waterfall' ? 8 : 6}
                  lg={viewMode === 'waterfall' ? 6 : 6}
                  key={item.id}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: (i % 12) * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: '100%' }}
                  >
                    <Card
                      hoverable
                      className="gallery-card"
                      onClick={() => handleCardClick(item)}
                      style={{
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '1px solid var(--color-border-light)',
                        height: '100%',
                        position: 'relative',
                      }}
                      cover={
                        <div style={{ position: 'relative', overflow: 'hidden', aspectRatio: viewMode === 'waterfall' ? '3/4' : '1' }}>
                          <img
                            src={normalizeImageUrl(item.images[0])}
                            alt={item.base_style}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            loading="lazy"
                          />
                          {/* Hover 叠加层 */}
                          <div className="gallery-card-overlay">
                            <Eye size={28} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 'var(--text-sm)' }}>查看详情</Text>
                          </div>
                          {/* 风格标签 */}
                          <Tag
                            color="gold"
                            style={{
                              position: 'absolute', top: 8, left: 8, zIndex: 2,
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            {item.base_style}
                          </Tag>
                          {/* 公开/私密图标 */}
                          {user && item.user_id === user.id && (
                            <Tooltip title={item.is_public ? '已公开' : '未发布'}>
                              <div style={{
                                position: 'absolute', bottom: 8, right: 8, zIndex: 2,
                                background: 'rgba(0,0,0,0.5)', borderRadius: '50%',
                                width: 28, height: 28, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                              }}>
                                {item.is_public
                                  ? <Globe size={14} color="#C4A265" />
                                  : <Lock size={14} color="#999" />}
                              </div>
                            </Tooltip>
                          )}
                        </div>
                      }
                      styles={{ body: { padding: '10px 14px' } }}
                    >
                      <Text
                        strong
                        style={{ fontSize: 'var(--text-sm)', display: 'block', marginBottom: 4 }}
                        ellipsis
                      >
                        {item.base_style}
                      </Text>
                      <Text
                        type="secondary"
                        style={{ fontSize: 'var(--text-xs)', lineHeight: 1.4 }}
                        ellipsis={{ rows: 2 }}
                      >
                        {item.prompt.slice(0, 60)}{item.prompt.length > 60 ? '…' : ''}
                      </Text>
                    </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
          </Image.PreviewGroup>

          {/* 分页 */}
          {totalFiltered > pageSize && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination
                current={page}
                total={totalFiltered}
                pageSize={pageSize}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          )}
        </Card>
      )}

      {/* 详情抽屉 */}
      <Drawer
        title="作品详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={640}
        styles={{ body: { padding: '16px 24px' } }}
      >
        {selectedItem && (
          <>
            {/* 图片 */}
            <Image.PreviewGroup>
              <Row gutter={[8, 8]}>
                {(selectedItem.images?.length > 0 ? selectedItem.images : ['']).map((img, idx) => (
                  <Col span={selectedItem.images.length === 1 ? 24 : 12} key={idx}>
                    <Image
                      src={normalizeImageUrl(img)}
                      alt={`作品 ${idx + 1}`}
                      style={{ borderRadius: 'var(--radius-md)', width: '100%', aspectRatio: '1', objectFit: 'cover' }}
                      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                    />
                  </Col>
                ))}
              </Row>
            </Image.PreviewGroup>

            <Divider />

            {/* 元数据 */}
            <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="风格">{selectedItem.base_style}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(selectedItem.created_at).toLocaleDateString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            {/* 完整 Prompt */}
            <div style={{
              background: 'var(--color-bg-hover)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: 16,
            }}>
              <Text type="secondary" style={{ fontSize: 'var(--text-xs)', marginBottom: 6, display: 'block' }}>
                AI 生成提示词
              </Text>
              <Text style={{ fontSize: 'var(--text-sm)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selectedItem.prompt}
              </Text>
            </div>

            <Divider />

            {/* 操作按钮 */}
            <Space size={12} wrap>
              <Button icon={<Download size={16} />} onClick={() => handleDownload(selectedItem)}>
                下载
              </Button>
              <Button icon={<Share2 size={16} />} onClick={() => handleShare(selectedItem)}>
                分享
              </Button>
              <Button icon={<Heart size={16} />} onClick={() => message.info('收藏功能开发中')}>
                收藏
              </Button>
              {user && (selectedItem as any).user_id === user.id && (
                <Button
                  icon={selectedItem.is_public ? <Lock size={16} /> : <Globe size={16} />}
                  onClick={() => handleTogglePublish(selectedItem)}
                >
                  {selectedItem.is_public ? '设为私密' : '发布到画廊'}
                </Button>
              )}
            </Space>
          </>
        )}
      </Drawer>
    </>
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
