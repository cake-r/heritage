import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Layout, Menu, Card, Typography, Input, Select, Button, Badge,
  Row, Col, Drawer, Image, Tag, Pagination, Modal, Upload,
  Form, Spin, Empty, Space, message, Segmented, Collapse, AutoComplete, Checkbox,
} from 'antd'
import {
  Search, UploadIcon, Heart,
  LayoutGrid, List,
  ImageIcon, MapPin, Clock,
  MessageCircle, Maximize, Check, X,
  RefreshCw, Lock, Pencil,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  getItems, getCategories, getRegions, getEras, uploadWork,
  startExpansion, getTaskStatus, getExpansionQueue,
  approveExpansionItem, rejectExpansionItem, uploadQueueImages,
  verifyAdminPassword, updateHeritageItem, uploadHeritageImages,
  type HeritageItem, type ExpansionQueueItem, type ExpansionPreferences,
} from '../services/exhibition'
import { addFavorite, deleteFavorite, listFavorites } from '../services/user'
import { trackRegionVisit } from '../services/passport'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { normalizeImageUrl } from '../utils/imageUrl'

const { Sider, Content } = Layout
const { Text, Paragraph } = Typography

export default function ExhibitionHall() {
  const [searchParams] = useSearchParams()
  const initialId = searchParams.get('id')
  const { isAuthenticated } = useAuth()

  // state
  const [categories, setCategories] = useState<string[]>([])
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [era, setEra] = useState('')
  const [sortMode, setSortMode] = useState<'default' | 'recommended'>('default')
  const [viewMode, setViewMode] = useState<'grid' | 'waterfall'>('grid')
  const [recommendedItems, setRecommendedItems] = useState<HeritageItem[]>([])
  const [items, setItems] = useState<HeritageItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<HeritageItem | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // upload modal
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadCategory, setUploadCategory] = useState('')
  const [uploadRegion, setUploadRegion] = useState('')
  const [uploadEra, setUploadEra] = useState('')
  const [uploadTechniques, setUploadTechniques] = useState('')
  const [uploadInheritors, setUploadInheritors] = useState('')
  const [uploadCulturalMeaning, setUploadCulturalMeaning] = useState('')
  const [uploading, setUploading] = useState(false)

  // dynamic filter options
  const [regions, setRegions] = useState<string[]>([])
  const [eras, setEras] = useState<string[]>([])

  // favorites set (compound key: "type:id")
  const [favIds, setFavIds] = useState<Set<string>>(new Set())

  // 知识库扩充
  const [expandOpen, setExpandOpen] = useState(false)
  const [expandCount, setExpandCount] = useState(5)
  const [expandCategories, setExpandCategories] = useState<string[]>([])
  const [expandRegions, setExpandRegions] = useState<string[]>([])
  const [expandEras, setExpandEras] = useState<string[]>([])
  const [expandKeywords, setExpandKeywords] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskRunning, setTaskRunning] = useState(false)
  const [taskProgress, setTaskProgress] = useState({ completed: 0, total: 0, items_found: 0 })
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewItems, setReviewItems] = useState<ExpansionQueueItem[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewTotal, setReviewTotal] = useState(0)
  const [approving, setApproving] = useState<number | null>(null)

  // === 管理员编辑模式 ===
  const [adminMode, setAdminMode] = useState(false)
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminVerifying, setAdminVerifying] = useState(false)

  // 编辑弹窗
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<HeritageItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editRegion, setEditRegion] = useState('')
  const [editEra, setEditEra] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editTechniques, setEditTechniques] = useState('')
  const [editInheritors, setEditInheritors] = useState('')
  const [editCulturalMeaning, setEditCulturalMeaning] = useState('')
  const [editFiles, setEditFiles] = useState<File[]>([])
  const [editSaving, setEditSaving] = useState(false)

  // load categories / regions / eras + pending review count
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
    getRegions().then(setRegions).catch(() => {})
    getEras().then(setEras).catch(() => {})
    // 检查待审核数量
    if (isAuthenticated) {
      getExpansionQueue({ status: 'pending', page_size: 1 }).then(res => {
        setReviewTotal(res.total)
      }).catch(() => {})
    }
  }, [isAuthenticated])

  // load favorites
  useEffect(() => {
    if (isAuthenticated) {
      listFavorites()
        .then(favs => setFavIds(new Set(favs.map(f => `${f.item_type}:${f.item_id}`))))
        .catch(() => {})
    }
  }, [isAuthenticated])

  // Track region visit when user filters by region
  useEffect(() => {
    if (region) {
      trackRegionVisit(region).catch(() => {})
    }
  }, [region])

  // load items
  const loadItems = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const data = await getItems({ category, region, era, search, page: p, page_size: 12 })
      setItems(data.items)
      setTotal(data.total)
      if (initialId && p === 1) {
        const target = data.items.find(it => it.id === Number(initialId))
        if (target) { setSelectedItem(target); setDrawerOpen(true) }
      }
    } catch {
      message.error('加载藏品失败')
    } finally {
      setLoading(false)
    }
  }, [category, region, era, search, initialId])

  useEffect(() => { loadItems(page) }, [loadItems, page])

  const handleSearch = () => { setPage(1); loadItems(1) }

  const handleItemClick = (item: HeritageItem) => {
    setSelectedItem(item)
    setDrawerOpen(true)
  }

  const handleToggleFavorite = async (item: HeritageItem) => {
    if (!isAuthenticated) { message.warning('请先登录'); return }
    const itemType = item.item_type || 'heritage'
    const favKey = `${itemType}:${item.id}`
    try {
      if (favIds.has(favKey)) {
        const favs = await listFavorites()
        const target = favs.find(f => f.item_type === itemType && f.item_id === item.id)
        if (target) await deleteFavorite(target.id)
        setFavIds(prev => { const n = new Set(prev); n.delete(favKey); return n })
        message.success('已取消收藏')
      } else {
        await addFavorite(itemType, item.id)
        setFavIds(prev => new Set(prev).add(favKey))
        message.success('已收藏')
        window.dispatchEvent(new CustomEvent('cultivation:check'))
      }
    } catch (err: any) {
      message.error(err.message || '操作失败')
    }
  }

  const handleUpload = async () => {
    if (!uploadTitle.trim()) { message.warning('请输入作品标题'); return }
    if (uploadFiles.length === 0) { message.warning('请上传至少一张图片'); return }
    setUploading(true)
    try {
      // 解析工艺技法: 每行 "技法名：描述" 或 "技法名:描述" 或仅 "技法名"
      const techniques = uploadTechniques.trim()
        ? uploadTechniques.split('\n').filter(Boolean).map(line => {
            const idx = line.indexOf('：') >= 0 ? line.indexOf('：') : line.indexOf(':')
            if (idx >= 0) return { name: line.slice(0, idx).trim(), desc: line.slice(idx + 1).trim() }
            return { name: line.trim(), desc: '' }
          })
        : []
      // 解析传承人: 每行 "姓名：称号：简介" 或 "姓名：称号" 或 "姓名"
      const inheritors = uploadInheritors.trim()
        ? uploadInheritors.split('\n').filter(Boolean).map(line => {
            const idx1 = line.indexOf('：') >= 0 ? line.indexOf('：') : line.indexOf(':')
            if (idx1 < 0) return { name: line.trim(), title: '', desc: '' }
            const name = line.slice(0, idx1).trim()
            const rest = line.slice(idx1 + 1).trim()
            const idx2 = rest.indexOf('：') >= 0 ? rest.indexOf('：') : rest.indexOf(':')
            if (idx2 >= 0) {
              return { name, title: rest.slice(0, idx2).trim(), desc: rest.slice(idx2 + 1).trim() }
            }
            return { name, title: rest, desc: '' }
          })
        : []
      await uploadWork(
        uploadFiles, uploadTitle, uploadDesc, uploadCategory,
        uploadRegion, uploadEra, techniques, inheritors, uploadCulturalMeaning,
      )
      message.success('上传成功！')
      setUploadOpen(false)
      setUploadFiles([])
      setUploadTitle('')
      setUploadDesc('')
      setUploadCategory('')
      setUploadRegion('')
      setUploadEra('')
      setUploadTechniques('')
      setUploadInheritors('')
      setUploadCulturalMeaning('')
      // 重新加载筛选选项（可能有新地区/年代）
      getRegions().then(setRegions).catch(() => {})
      getEras().then(setEras).catch(() => {})
      getCategories().then(setCategories).catch(() => {})
      loadItems(page)
    } catch (err: any) {
      message.error(err.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  // === 知识库扩充 ===

  const handleStartExpansion = async () => {
    setExpandOpen(false)
    setTaskRunning(true)
    setTaskProgress({ completed: 0, total: expandCount, items_found: 0 })
    try {
      // 构建偏好参数
      const prefs: ExpansionPreferences = {}
      if (expandCategories.length > 0) prefs.categories = expandCategories
      if (expandRegions.length > 0) prefs.regions = expandRegions
      if (expandEras.length > 0) prefs.eras = expandEras
      if (expandKeywords.trim()) prefs.keywords = expandKeywords.trim().split(/[,，、\s]+/).filter(Boolean)

      const { task_id, message: msg } = await startExpansion(expandCount, Object.keys(prefs).length > 0 ? prefs : undefined)
      message.success(msg)
      setTaskId(task_id)
      // 每 3 秒轮询进度
      const poll = setInterval(async () => {
        try {
          const status = await getTaskStatus(task_id)
          setTaskProgress({ completed: status.completed, total: status.total, items_found: status.items_found })
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(poll)
            setTaskRunning(false)
            if (status.status === 'completed') {
              setReviewTotal(status.items_found)
              message.success(`扩充完成！找到 ${status.items_found} 个非遗项目，请审核`)
            } else {
              message.warning(`扩充异常结束: ${status.error || '未知错误'}`)
            }
          }
        } catch {
          // 轮询失败静默处理
        }
      }, 3000)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '扩充启动失败')
      setTaskRunning(false)
    }
  }

  const handleLoadReviewQueue = async (pageNum = 1) => {
    setReviewLoading(true)
    try {
      const res = await getExpansionQueue({ status: 'pending', page: pageNum, page_size: 20 })
      setReviewItems(res.items)
      setReviewTotal(res.total)
      setReviewPage(pageNum)
    } catch {
      message.error('加载审核队列失败')
    } finally {
      setReviewLoading(false)
    }
  }

  const handleApproveItem = async (id: number, name: string) => {
    setApproving(id)
    try {
      await approveExpansionItem(id)
      message.success(`已上架: ${name}`)
      // 从列表移除
      setReviewItems(prev => prev.filter(i => i.id !== id))
      // 刷新展览列表和筛选选项
      getRegions().then(setRegions).catch(() => {})
      getEras().then(setEras).catch(() => {})
      getCategories().then(setCategories).catch(() => {})
      loadItems(page)
    } catch (err: any) {
      message.error(err.response?.data?.detail || '审批失败')
    } finally {
      setApproving(null)
    }
  }

  const handleRejectItem = async (id: number, name: string) => {
    try {
      await rejectExpansionItem(id)
      message.info(`已拒绝: ${name}`)
      setReviewItems(prev => prev.filter(i => i.id !== id))
    } catch (err: any) {
      message.error(err.response?.data?.detail || '操作失败')
    }
  }

  const handleOpenReview = () => {
    setReviewOpen(true)
    handleLoadReviewQueue(1)
  }

  // === 管理员功能 ===

  const handleAdminVerify = async () => {
    setAdminVerifying(true)
    try {
      const res = await verifyAdminPassword(adminPassword)
      setAdminToken(res.token)
      setAdminMode(true)
      setPasswordModalOpen(false)
      setAdminPassword('')
      message.success('已进入管理员编辑模式')
    } catch (err: any) {
      message.error(err.response?.data?.detail || '密码错误')
    } finally {
      setAdminVerifying(false)
    }
  }

  const handleExitAdminMode = () => {
    setAdminMode(false)
    setAdminToken(null)
    message.info('已退出管理员编辑模式')
  }

  const handleOpenEdit = (item: HeritageItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingItem(item)
    setEditName(item.name)
    setEditCategory(item.category)
    setEditRegion(item.region || '')
    setEditEra(item.era || '')
    setEditDesc(item.description || '')
    setEditTechniques(
      item.techniques.map(t => t.desc ? `${t.name}：${t.desc}` : t.name).join('\n')
    )
    setEditInheritors(
      item.inheritors.map(i => {
        if (i.desc) return `${i.name}：${i.title || ''}：${i.desc}`
        if (i.title) return `${i.name}：${i.title}`
        return i.name
      }).join('\n')
    )
    setEditCulturalMeaning(item.cultural_meaning || '')
    setEditFiles([])
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingItem || !adminToken) return
    if (!editName.trim()) { message.warning('请输入名称'); return }
    setEditSaving(true)
    try {
      // 解析技法
      const techniques = editTechniques.trim()
        ? editTechniques.split('\n').filter(Boolean).map(line => {
            const idx = line.indexOf('：') >= 0 ? line.indexOf('：') : line.indexOf(':')
            if (idx >= 0) return { name: line.slice(0, idx).trim(), desc: line.slice(idx + 1).trim() }
            return { name: line.trim(), desc: '' }
          })
        : []
      // 解析传承人: 每行 "姓名：称号：简介" 或 "姓名：称号" 或 "姓名"
      const inheritors = editInheritors.trim()
        ? editInheritors.split('\n').filter(Boolean).map(line => {
            const idx1 = line.indexOf('：') >= 0 ? line.indexOf('：') : line.indexOf(':')
            if (idx1 < 0) return { name: line.trim(), title: '', desc: '' }
            const name = line.slice(0, idx1).trim()
            const rest = line.slice(idx1 + 1).trim()
            const idx2 = rest.indexOf('：') >= 0 ? rest.indexOf('：') : rest.indexOf(':')
            if (idx2 >= 0) {
              return { name, title: rest.slice(0, idx2).trim(), desc: rest.slice(idx2 + 1).trim() }
            }
            return { name, title: rest, desc: '' }
          })
        : []

      // 先更新文本信息
      await updateHeritageItem(
        editingItem.id,
        {
          name: editName.trim(),
          category: editCategory,
          region: editRegion || undefined,
          era: editEra || undefined,
          description: editDesc.trim() || undefined,
          techniques,
          inheritors,
          cultural_meaning: editCulturalMeaning.trim() || undefined,
        } as any,
        adminToken,
      )

      // 如有新图片，单独上传替换
      if (editFiles.length > 0) {
        await uploadHeritageImages(editingItem.id, editFiles, adminToken)
      }

      message.success('修改已保存')
      setEditModalOpen(false)
      setEditingItem(null)
      // 刷新筛选选项
      getRegions().then(setRegions).catch(() => {})
      getEras().then(setEras).catch(() => {})
      getCategories().then(setCategories).catch(() => {})
      loadItems(page)
    } catch (err: any) {
      message.error(err.response?.data?.detail || err.message || '保存失败')
      if (err.response?.status === 403) {
        setAdminMode(false)
        setAdminToken(null)
        message.warning('管理员会话已过期，请重新输入密码')
      }
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <Layout style={{ background: 'transparent' }}>
      {/* 左侧分类导航 */}
      <Sider width={160} style={{ background: '#fff', borderRadius: 12, marginRight: 24, padding: '16px 0' }}>
        <div style={{ padding: '0 16px', marginBottom: 8 }}>
          <Text strong>非遗品类</Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[category]}
          style={{ border: 'none' }}
          items={[
            { key: '', label: `全部 (${total})` },
            ...categories.map(c => ({ key: c, label: c })),
          ]}
          onClick={({ key }) => { setCategory(key); setPage(1); loadItems(1) }}
        />
      </Sider>

      <Content>
        {/* 顶部操作栏 */}
        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={6}>
              <Input
                placeholder="搜索藏品名称或描述..."
                prefix={<Search />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onPressEnter={handleSearch}
                allowClear
              />
            </Col>
            <Col xs={12} sm={3}>
              <Select
                placeholder="地区"
                value={region || undefined}
                onChange={v => { setRegion(v || ''); setPage(1); }}
                allowClear
                style={{ width: '100%' }}
                options={regions.map(r => ({ value: r, label: r }))}
              />
            </Col>
            <Col xs={12} sm={3}>
              <Select
                placeholder="年代"
                value={era || undefined}
                onChange={v => { setEra(v || ''); setPage(1); }}
                allowClear
                style={{ width: '100%' }}
                options={eras.map(e => ({ value: e, label: e }))}
              />
            </Col>
            <Col xs={12} sm={3}>
              <Segmented
                options={[
                  { value: 'grid', icon: <LayoutGrid /> },
                  { value: 'waterfall', icon: <List /> },
                ]}
                value={viewMode}
                onChange={v => setViewMode(v as 'grid' | 'waterfall')}
              />
            </Col>
            {isAuthenticated && (
              <Col xs={12} sm={3}>
                <Segmented
                  options={[
                    { value: 'default', label: '默认排序' },
                    { value: 'recommended', label: '为你推荐' },
                  ]}
                  value={sortMode}
                  onChange={v => {
                    setSortMode(v as 'default' | 'recommended')
                    setPage(1)
                    if (v === 'recommended') {
                      import('../services/recommendation').then(({ getModuleRecommendations }) => {
                        getModuleRecommendations('exhibition').then(data => {
                          // 将推荐项映射到 HeritageItem 格式
                          const mapped = data.items.map(r => ({
                            id: r.id,
                            name: r.title,
                            title: r.title,
                            category: r.category,
                            region: r.region || '',
                            era: '',
                            description: '',
                            images: r.image_url ? [r.image_url] : [],
                            item_type: r.item_type,
                            reason: r.reason,
                            score: r.score,
                          } as any))
                          setRecommendedItems(mapped)
                        }).catch(() => {})
                      })
                    }
                  }}
                />
              </Col>
            )}
            <Col xs={12} sm={9} style={{ textAlign: 'right' }}>
              <Space wrap>
                <Button
                  icon={<Maximize />}
                  onClick={() => setExpandOpen(true)}
                  disabled={!isAuthenticated || taskRunning}
                  title="AI 扩充知识库"
                >
                  扩充
                </Button>
                {reviewTotal > 0 && (
                  <Badge count={reviewTotal} size="small" offset={[-4, 4]}>
                    <Button
                      icon={<Check />}
                      onClick={handleOpenReview}
                      type="default"
                    >
                      审核
                    </Button>
                  </Badge>
                )}
                <Button icon={<UploadIcon />} onClick={() => setUploadOpen(true)} disabled={!isAuthenticated}>
                  {isAuthenticated ? '上传作品' : '登录后上传'}
                </Button>
                {adminMode ? (
                  <Button danger onClick={handleExitAdminMode}>退出管理</Button>
                ) : (
                  <Button
                    icon={<Lock />}
                    onClick={() => setPasswordModalOpen(true)}
                  >
                    管理员
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 藏品网格 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : (sortMode === 'recommended' ? recommendedItems : items).length === 0 ? (
          <Empty description={sortMode === 'recommended' ? '暂无个性化推荐，完成更多互动后解锁' : '暂无藏品'} style={{ padding: 60 }} />
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {(sortMode === 'recommended' ? recommendedItems : items).map((item: any, i: number) => (
                <Col
                  key={`${item.item_type || 'heritage'}-${item.id}`}
                  xs={viewMode === 'waterfall' ? 24 : 12}
                  sm={viewMode === 'waterfall' ? 12 : 8}
                  md={viewMode === 'waterfall' ? 8 : 6}
                  lg={viewMode === 'waterfall' ? 6 : 6}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  >
                  <Card
                    hoverable
                    onClick={() => handleItemClick(item)}
                    style={{ borderRadius: 12 }}
                    cover={
                      item.images.length > 0 ? (
                        <div style={{ position: 'relative' }}>
                          <img
                            src={normalizeImageUrl(item.images[0])}
                            alt={item.name}
                            style={{
                              width: '100%',
                              height: viewMode === 'waterfall' ? 280 : 200,
                              objectFit: 'cover',
                              borderTopLeftRadius: 12,
                              borderTopRightRadius: 12,
                            }}
                          />
                          {adminMode ? (
                            <Button
                              type="primary"
                              size="small"
                              icon={<Pencil />}
                              onClick={e => handleOpenEdit(item, e)}
                              style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 2, opacity: 0.9 }}
                            >
                              编辑
                            </Button>
                          ) : (
                            <Button
                              type="text"
                              icon={favIds.has(`${item.item_type || 'heritage'}:${item.id}`) ? <Heart fill="#C41E3A" color="#C41E3A" /> : <Heart />}
                              onClick={e => { e.stopPropagation(); handleToggleFavorite(item) }}
                              style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.8)' }}
                            />
                          )}
                        </div>
                      ) : (
                        <div style={{
                          height: viewMode === 'waterfall' ? 280 : 200,
                          background: '#f5f5f5',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderTopLeftRadius: 12, borderTopRightRadius: 12,
                        }}>
                          <ImageIcon size={48} style={{ color: 'var(--color-border-medium)' }} />
                        </div>
                      )
                    }
                    bodyStyle={{ padding: '12px 16px' }}
                  >
                    <Text strong style={{ fontSize: 'var(--text-sm)' }}>{item.name}</Text>
                    <div style={{ marginTop: 4 }}>
                      <Space size={4} wrap>
                        <Tag color="gold">{item.category}</Tag>
                        {item.region && <Tag icon={<MapPin />} color="blue">{item.region}</Tag>}
                        {item.era && <Tag icon={<Clock />}>{item.era}</Tag>}
                      </Space>
                    </div>
                  </Card>
                  </motion.div>
                </Col>
              ))}
            </Row>
            {total > 12 && (
              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <Pagination current={page} total={total} pageSize={12} onChange={setPage} />
              </div>
            )}
          </>
        )}

        {/* 藏品详情 Drawer */}
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={640}
          title={selectedItem?.name}
          extra={
            selectedItem && (
              <Button
                type={favIds.has(`${selectedItem.item_type || 'heritage'}:${selectedItem.id}`) ? 'primary' : 'default'}
                icon={favIds.has(`${selectedItem.item_type || 'heritage'}:${selectedItem.id}`) ? <Heart fill="var(--color-vermilion)" color="var(--color-vermilion)" /> : <Heart />}
                onClick={() => handleToggleFavorite(selectedItem)}
                danger={favIds.has(`${selectedItem.item_type || 'heritage'}:${selectedItem.id}`)}
              >
                {favIds.has(`${selectedItem.item_type || 'heritage'}:${selectedItem.id}`) ? '取消收藏' : '收藏'}
              </Button>
            )
          }
        >
          {selectedItem && <ItemDetail item={selectedItem} />}
        </Drawer>

        {/* 上传作品 Modal */}
        <Modal
          title="上传非遗作品"
          open={uploadOpen}
          onCancel={() => setUploadOpen(false)}
          onOk={handleUpload}
          confirmLoading={uploading}
          okText="上传"
          width={600}
          style={{ top: 20 }}
        >
          <Form layout="vertical" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
            <Form.Item label="作品标题" required>
              <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="给你的作品起个名字" />
            </Form.Item>
            <Form.Item label="作品图片">
              <Upload
                accept="image/*"
                multiple
                maxCount={5}
                listType="picture-card"
                beforeUpload={(file) => {
                  const isImage = file.type.startsWith('image/')
                  if (!isImage) { message.error('只能上传图片文件'); return false }
                  const isLt10M = (file as any).size / 1024 / 1024 < 10
                  if (!isLt10M) { message.error('图片大小不能超过 10MB'); return false }
                  setUploadFiles(prev => [...prev, file]); return false
                }}
                onRemove={(file) => { setUploadFiles(prev => prev.filter(f => f.name !== file.name)) }}
              >
                <div><UploadIcon /><div style={{ marginTop: 8 }}>上传</div></div>
              </Upload>
            </Form.Item>
            <Form.Item label="分类">
              <Select value={uploadCategory || undefined} onChange={setUploadCategory} placeholder="选择分类" allowClear>
                {categories.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item label="地区">
              <AutoComplete
                value={uploadRegion || undefined}
                onChange={setUploadRegion}
                placeholder="如：江苏（可自定义输入）"
                options={regions.map(r => ({ value: r }))}
                allowClear
              />
            </Form.Item>
            <Form.Item label="年代">
              <AutoComplete
                value={uploadEra || undefined}
                onChange={setUploadEra}
                placeholder="如：清代（可自定义输入）"
                options={eras.map(e => ({ value: e }))}
                allowClear
              />
            </Form.Item>
            <Form.Item label="描述">
              <Input.TextArea value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} placeholder="介绍一下你的作品..." rows={3} />
            </Form.Item>
            <Form.Item label="工艺技法" extra="每行一个，格式：技法名：描述（如 掐丝：用细铜丝掐出花纹...）">
              <Input.TextArea value={uploadTechniques} onChange={e => setUploadTechniques(e.target.value)} placeholder="技法名：描述&#10;技法名：描述" rows={3} />
            </Form.Item>
            <Form.Item label="传承人" extra="每行一个，格式：姓名：称号：简介（如 张大师：国家级非遗传承人：从事该技艺40余年...）">
              <Input.TextArea value={uploadInheritors} onChange={e => setUploadInheritors(e.target.value)} placeholder="姓名：称号：简介&#10;姓名：称号：简介" rows={3} />
            </Form.Item>
            <Form.Item label="文化寓意">
              <Input.TextArea value={uploadCulturalMeaning} onChange={e => setUploadCulturalMeaning(e.target.value)} placeholder="这件作品有什么文化寓意..." rows={3} />
            </Form.Item>
          </Form>
        </Modal>

        {/* 扩充知识库 Modal */}
        <Modal
          title="AI 扩充知识库"
          open={expandOpen}
          onCancel={() => {
            setExpandOpen(false)
            // 关闭时不清空偏好，方便下次打开继续调整
          }}
          onOk={handleStartExpansion}
          okText="开始扩充"
          cancelText="取消"
          width={560}
        >
          <div style={{ padding: '4px 0' }}>
            {/* 偏好品类 */}
            <Form.Item label="偏好品类" extra="不选则自动轮询全部品类">
              <Select
                mode="multiple"
                placeholder="选择你感兴趣的非遗品类..."
                value={expandCategories}
                onChange={setExpandCategories}
                options={categories.map(c => ({ label: c, value: c }))}
                allowClear
                style={{ width: '100%' }}
                maxTagCount={6}
              />
            </Form.Item>

            {/* 偏好地域 */}
            <Form.Item label="偏好地域" extra="输入后按回车添加，如「江苏苏州」「四川成都」">
              <Select
                mode="tags"
                placeholder="输入感兴趣的地域..."
                value={expandRegions}
                onChange={setExpandRegions}
                style={{ width: '100%' }}
                maxTagCount={5}
              />
            </Form.Item>

            {/* 偏好年代 */}
            <Form.Item label="偏好年代" extra="不选则不限制年代">
              <Checkbox.Group
                options={['商周', '秦汉', '魏晋南北朝', '隋唐', '宋元', '明清', '近现代']}
                value={expandEras}
                onChange={v => setExpandEras(v as string[])}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}
              />
            </Form.Item>

            {/* 自定义关键词 */}
            <Form.Item label="自定义关键词" extra="输入你最想了解的非遗名称或主题，用逗号分隔">
              <Input.TextArea
                placeholder="如：蜀绣、景德镇瓷器、龙泉宝剑、苗族银饰..."
                value={expandKeywords}
                onChange={e => setExpandKeywords(e.target.value)}
                rows={2}
                style={{ width: '100%' }}
              />
            </Form.Item>

            {/* 扩充数量 */}
            <Form.Item label="扩充数量" extra="建议每次 3-5 个，便于逐一审核">
              <Input
                type="number"
                min={1}
                max={30}
                value={expandCount}
                onChange={e => setExpandCount(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                style={{ width: '100%' }}
              />
            </Form.Item>

            {taskRunning && (
              <div style={{
                background: 'var(--color-bg-hover, #F5F5F0)',
                borderRadius: 8,
                padding: 12,
                marginTop: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spin size="small" />
                  <Text>正在搜索中...</Text>
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">已找到 {taskProgress.items_found} 个项目</Text>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* 审核 Drawer */}
        <Drawer
          title={
            <Space>
              <span>知识库扩充审核</span>
              <Tag color="orange">{reviewTotal} 待审核</Tag>
            </Space>
          }
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          width={680}
          extra={
            <Button
              icon={<RefreshCw />}
              onClick={() => handleLoadReviewQueue(reviewPage)}
              loading={reviewLoading}
            >
              刷新
            </Button>
          }
        >
          {reviewLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
          ) : reviewItems.length === 0 ? (
            <Empty description="暂无待审核项目">
              {taskRunning && <Text type="secondary">扩充任务进行中，请稍后刷新查看...</Text>}
            </Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reviewItems.map(item => (
                <Card
                  key={item.id}
                  size="small"
                  title={
                    <Space>
                      <Text strong>{item.name}</Text>
                      <Tag color="gold">{item.category}</Tag>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button
                        type="primary"
                        size="small"
                        icon={<Check />}
                        loading={approving === item.id}
                        onClick={() => handleApproveItem(item.id, item.name)}
                      >
                        通过
                      </Button>
                      <Button
                        danger
                        size="small"
                        icon={<X />}
                        onClick={() => handleRejectItem(item.id, item.name)}
                        disabled={approving === item.id}
                      >
                        拒绝
                      </Button>
                    </Space>
                  }
                  style={{ borderRadius: 8 }}
                >
                  <Row gutter={[16, 8]}>
                    <Col span={12}>
                      <Text type="secondary">地区: </Text>
                      <Text>{item.region || '—'}</Text>
                    </Col>
                    <Col span={12}>
                      <Text type="secondary">时代: </Text>
                      <Text>{item.era || '—'}</Text>
                    </Col>
                    {item.description && (
                      <Col span={24}>
                        <Text type="secondary">简介: </Text>
                        <Paragraph ellipsis={{ rows: 3, expandable: true }} style={{ margin: 0 }}>
                          {item.description}
                        </Paragraph>
                      </Col>
                    )}
                    {item.techniques.length > 0 && (
                      <Col span={24}>
                        <Text type="secondary">技法: </Text>
                        {item.techniques.map((t, i) => (
                          <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{t.name}</Tag>
                        ))}
                      </Col>
                    )}
                    {item.inheritors.length > 0 && (
                      <Col span={24}>
                        <Text type="secondary">传承人: </Text>
                        {item.inheritors.map((t, i) => (
                          <Tag key={i} color="green" style={{ marginBottom: 4 }}>{t.name}</Tag>
                        ))}
                      </Col>
                    )}
                    <Col span={24}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Text type="secondary" style={{ flexShrink: 0 }}>图片: </Text>
                        {item.images.length > 0 ? (
                          <Image.PreviewGroup>
                            <Space>
                              {item.images.slice(0, 4).map((img, i) => (
                                <Image
                                  key={i}
                                  src={`/static/${img}`}
                                  width={64}
                                  height={64}
                                  style={{ objectFit: 'cover', borderRadius: 4 }}
                                  fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjBmMGVjIi8+PHRleHQgeD0iNDAiIHk9IjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxMiI+5Zu+54mHPC90ZXh0Pjwvc3ZnPg=="
                                />
                              ))}
                            </Space>
                          </Image.PreviewGroup>
                        ) : (
                          <Tag>暂无图片</Tag>
                        )}
                        <Upload
                          accept="image/*"
                          showUploadList={false}
                          multiple
                          maxCount={5}
                          beforeUpload={async (file) => {
                            const isImage = file.type.startsWith('image/')
                            if (!isImage) { message.error('只能上传图片'); return false }
                            const isLt10M = (file as any).size / 1024 / 1024 < 10
                            if (!isLt10M) { message.error('图片不能超过10MB'); return false }
                            try {
                              const result = await uploadQueueImages(item.id, [file])
                              // Update local state so images refresh
                              setReviewItems(prev => prev.map(ri =>
                                ri.id === item.id ? { ...ri, images: result.images } : ri
                              ))
                              message.success('图片已更新')
                            } catch { message.error('图片上传失败') }
                            return false
                          }}
                        >
                          <Button size="small" icon={<UploadIcon />}>替换图片</Button>
                        </Upload>
                      </div>
                    </Col>
                    {item.cultural_meaning && (
                      <Col span={24}>
                        <Text type="secondary">文化寓意: </Text>
                        <Text>{item.cultural_meaning}</Text>
                      </Col>
                    )}
                  </Row>
                </Card>
              ))}
              {reviewTotal > 20 && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Pagination
                    current={reviewPage}
                    total={reviewTotal}
                    pageSize={20}
                    onChange={handleLoadReviewQueue}
                    size="small"
                  />
                </div>
              )}
            </div>
          )}
        </Drawer>

        {/* 管理员密码验证 Modal */}
        <Modal
          title="管理员验证"
          open={passwordModalOpen}
          onCancel={() => { setPasswordModalOpen(false); setAdminPassword('') }}
          onOk={handleAdminVerify}
          confirmLoading={adminVerifying}
          okText="验证"
          cancelText="取消"
          width={360}
        >
          <div style={{ padding: '8px 0' }}>
            <Text type="secondary">请输入管理员密码以进入编辑模式</Text>
            <Input.Password
              prefix={<Lock />}
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              onPressEnter={handleAdminVerify}
              placeholder="管理员密码"
              style={{ marginTop: 12 }}
              autoFocus
            />
          </div>
        </Modal>

        {/* 管理员编辑 Modal */}
        <Modal
          title={editingItem ? `编辑: ${editingItem.name}` : '编辑非遗项目'}
          open={editModalOpen}
          onCancel={() => { setEditModalOpen(false); setEditingItem(null) }}
          onOk={handleSaveEdit}
          confirmLoading={editSaving}
          okText="保存修改"
          width={640}
          style={{ top: 20 }}
        >
          {editingItem && (
            <Form layout="vertical" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
              <Form.Item label="名称" required>
                <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="非遗项目名称" />
              </Form.Item>
              <Form.Item label="分类">
                <Select value={editCategory || undefined} onChange={setEditCategory} placeholder="选择分类" allowClear>
                  {categories.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="地区">
                <AutoComplete
                  value={editRegion || undefined}
                  onChange={setEditRegion}
                  placeholder="如：江苏苏州"
                  options={regions.map(r => ({ value: r }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item label="年代">
                <AutoComplete
                  value={editEra || undefined}
                  onChange={setEditEra}
                  placeholder="如：清代"
                  options={eras.map(e => ({ value: e }))}
                  allowClear
                />
              </Form.Item>
              <Form.Item label="描述">
                <Input.TextArea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="介绍这个非遗项目..." rows={3} />
              </Form.Item>
              <Form.Item label="工艺技法" extra="每行一个，格式：技法名：描述">
                <Input.TextArea value={editTechniques} onChange={e => setEditTechniques(e.target.value)} placeholder="技法名：描述" rows={3} />
              </Form.Item>
              <Form.Item label="传承人" extra="每行一个，格式：姓名：称号：简介">
                <Input.TextArea value={editInheritors} onChange={e => setEditInheritors(e.target.value)} placeholder="姓名：称号：简介" rows={3} />
              </Form.Item>
              <Form.Item label="文化寓意">
                <Input.TextArea value={editCulturalMeaning} onChange={e => setEditCulturalMeaning(e.target.value)} placeholder="文化寓意..." rows={3} />
              </Form.Item>
              <Form.Item label="图片">
                <div style={{ marginBottom: 8 }}>
                  {editingItem.images.length > 0 ? (
                    <Image.PreviewGroup>
                      <Space wrap>
                        {editingItem.images.map((img, i) => (
                          <Image
                            key={i}
                            src={normalizeImageUrl(img)}
                            width={80}
                            height={80}
                            style={{ objectFit: 'cover', borderRadius: 4 }}
                          />
                        ))}
                      </Space>
                    </Image.PreviewGroup>
                  ) : (
                    <Text type="secondary">暂无图片</Text>
                  )}
                </div>
                <Upload
                  accept="image/*"
                  multiple
                  maxCount={5}
                  listType="picture-card"
                  beforeUpload={(file) => {
                    const isImage = file.type.startsWith('image/')
                    if (!isImage) { message.error('只能上传图片文件'); return false }
                    const isLt10M = (file as any).size / 1024 / 1024 < 10
                    if (!isLt10M) { message.error('图片大小不能超过 10MB'); return false }
                    setEditFiles(prev => [...prev, file]); return false
                  }}
                  onRemove={(file) => { setEditFiles(prev => prev.filter(f => f.name !== file.name)) }}
                >
                  {editFiles.length < 5 && (
                    <div><UploadIcon /><div style={{ marginTop: 8 }}>上传新图片</div></div>
                  )}
                </Upload>
                {editFiles.length > 0 && (
                  <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                    已选择 {editFiles.length} 张新图片，保存后将替换现有图片
                  </Text>
                )}
              </Form.Item>
            </Form>
          )}
        </Modal>
      </Content>
    </Layout>
  )
}

// ========== 藏品详情内容 ==========

function ItemDetail({ item }: { item: HeritageItem }) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  // 品类 → 传承人 映射
  const CATEGORY_TO_INHERITOR: Record<string, string> = {
    '剪纸': 'paper_cutter',
    '刺绣': 'embroidery_lady',
    '苏绣': 'embroidery_lady',
    '陶瓷': 'ceramic_master',
    '青瓷': 'ceramic_master',
    '皮影': 'shadow_puppet',
    '皮影戏': 'shadow_puppet',
  }

  const inheritorId = CATEGORY_TO_INHERITOR[item.category]

  return (
    <div>
      {/* 图片轮播 */}
      {item.images.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <Image.PreviewGroup>
            <Row gutter={[8, 8]}>
              {item.images.map((img, i) => (
                <Col span={item.images.length === 1 ? 24 : 12} key={i}>
                  <Image src={normalizeImageUrl(img)} alt={`${item.name} ${i + 1}`}
                    style={{ width: '100%', borderRadius: 8 }} />
                </Col>
              ))}
            </Row>
          </Image.PreviewGroup>
        </div>
      ) : (
        <Empty description="暂无图片" style={{ marginBottom: 24 }} />
      )}

      {/* 基础信息 */}
      <Space wrap size={4} style={{ marginBottom: 16 }}>
        <Tag color="#C41E3A" style={{ fontSize: 'var(--text-sm)' }}>{item.category}</Tag>
        {item.region && <Tag icon={<MapPin />}>{item.region}</Tag>}
        {item.era && <Tag icon={<Clock />}>{item.era}</Tag>}
      </Space>

      {/* 与传承人对话按钮 */}
      {isAuthenticated && inheritorId && (
        <div style={{ marginBottom: 16 }}>
          <Button
            icon={<MessageCircle />}
            onClick={() => navigate(`/workshop?persona=${inheritorId}`)}
            style={{
              borderColor: 'var(--color-gold)',
              color: 'var(--color-gold)',
            }}
          >
            与{inheritorId === 'culture_guide' ? '文化向导' : '传承人'}对话
          </Button>
        </div>
      )}

      {/* 简介 — 可滚动 */}
      {item.description && (
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ fontSize: 15 }}>📖 简介</Text>
          <div style={{
            marginTop: 8, lineHeight: 1.9, maxHeight: 300, overflowY: 'auto',
            padding: '12px 16px', background: '#fafaf8', borderRadius: 8,
            border: '1px solid #f0ebe0',
          }}>
            <Paragraph style={{ margin: 0, color: '#4a3f35' }}>{item.description}</Paragraph>
          </div>
        </div>
      )}

      {/* 工艺技法 — 折叠效果 */}
      {item.techniques.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Collapse
            ghost
            expandIconPosition="end"
            items={[{
              key: 'techniques',
              label: <Text strong style={{ fontSize: 15 }}>🔧 工艺技法 ({item.techniques.length}项)</Text>,
              children: (
                <div>
                  {item.techniques.map((t, i) => (
                    <Card key={i} size="small" style={{ marginBottom: 8, background: '#fafaf8', borderRadius: 8 }}>
                      <Text strong style={{ color: '#C41E3A' }}>{t.name}</Text>
                      {t.desc && (
                        <Paragraph style={{ margin: '8px 0 0', color: '#5a5045', lineHeight: 1.7 }}>
                          {t.desc}
                        </Paragraph>
                      )}
                    </Card>
                  ))}
                </div>
              ),
            }]}
          />
        </div>
      )}

      {/* 传承人 — 折叠效果 */}
      {item.inheritors.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Collapse
            ghost
            expandIconPosition="end"
            items={[{
              key: 'inheritors',
              label: <Text strong style={{ fontSize: 15 }}>👤 传承人 ({item.inheritors.length}位)</Text>,
              children: (
                <div>
                  {item.inheritors.map((inh, i) => (
                    <Card key={i} size="small" style={{ marginBottom: 8, background: '#fafaf8', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong>{inh.name}</Text>
                        {inh.title && <Tag color="gold">{inh.title}</Tag>}
                      </div>
                      {inh.desc && (
                        <Paragraph style={{ margin: '8px 0 0', color: '#5a5045', lineHeight: 1.7 }}>
                          {inh.desc}
                        </Paragraph>
                      )}
                    </Card>
                  ))}
                </div>
              ),
            }]}
          />
        </div>
      )}

      {/* 文化寓意 — 可滚动 */}
      {item.cultural_meaning && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 15 }}>🎭 文化寓意</Text>
          <div style={{
            marginTop: 8, lineHeight: 1.9, maxHeight: 300, overflowY: 'auto',
            padding: '12px 16px', background: '#fafaf8', borderRadius: 8,
            border: '1px solid #f0ebe0',
          }}>
            <Paragraph style={{ margin: 0, color: '#4a3f35' }}>{item.cultural_meaning}</Paragraph>
          </div>
        </div>
      )}
    </div>
  )
}
