import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card, Upload, Typography, Spin, Tabs, Tag, Button,
  Row, Col, Space, message, Empty, Progress, Tooltip,
} from 'antd'
import {
  Inbox, RefreshCw, Image,
  FlaskConical, Volume2, ChevronRight,
  History, Zap, Lightbulb,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import AudioPlayer from '../components/recognition/AudioPlayer'
import AgentTimeline from '../components/common/AgentTimeline'
import ExplainPanel from '../components/common/ExplainPanel'
import {
  uploadAndRecognize, getDetail, getHistory,
  type RecognitionResult, type RecognitionListItem,
} from '../services/recognition'
import { getItems, type HeritageItem } from '../services/exhibition'
import { normalizeImageUrl } from '../utils/imageUrl'
import { getCategoryColor } from '../utils/categoryColors'
import { WindowLatticePattern } from '../components/decoration'

const { Dragger } = Upload
const { Title, Text } = Typography

type Step = 'upload' | 'loading' | 'result'

// ==================== 非遗冷知识库（每日轮换） ====================

const ICH_FACTS = [
  { category: '刺绣', fact: '苏绣的一根丝线可以劈成 1/128，比头发丝还细十倍，工匠能在米粒大小的空间绣出完整图案。' },
  { category: '陶瓷', fact: '景德镇高岭土因最早发现于江西高岭村而得名，英文单词 "Kaolin" 即源于此，是全球陶瓷原料的标准术语。' },
  { category: '剪纸', fact: '中国剪纸最早可追溯到公元 6 世纪的北朝时期，新疆吐鲁番出土的"对马团花"是最早的剪纸实物。' },
  { category: '皮影', fact: '皮影戏是世界上最早的电影雏形——利用光影原理在一块幕布后操纵剪影，比卢米埃尔兄弟的电影早了一千多年。' },
  { category: '织锦', fact: '南京云锦每天只能织出 5-6 厘米，有"寸锦寸金"之说，是中国古代丝织工艺的巅峰代表。' },
  { category: '金属', fact: '景泰蓝（铜胎掐丝珐琅）在明代景泰年间达到顶峰，"景泰"二字由此而来，一件大器需经过 108 道工序。' },
  { category: '漆器', fact: '福州脱胎漆器用麻布和漆灰层层裱褙，完成后再将内部泥胎打碎取出，成品轻如鸿毛却坚如金石。' },
  { category: '竹编', fact: '东阳竹编的"劈篾"绝技可将一根竹子劈成 1200 多条竹丝，细到可以穿过针眼。' },
  { category: '雕塑', fact: '曲阳石雕有 2000 多年历史，故宫、天安门前的金水桥栏杆、人民英雄纪念碑浮雕均出自曲阳匠人之手。' },
  { category: '泥塑', fact: '天津泥人张创始于清道光年间，创始人张明山捏一个泥人只需 15 分钟，且从不打草稿，全凭默记于心。' },
  { category: '民间美术', fact: '内画鼻烟壶要用特制的弯头毛笔伸入壶口（仅黄豆大小），在壶内壁反向作画，被誉为"不可思议的艺术"。' },
  { category: '戏曲', fact: '昆曲是中国最古老的剧种之一，被称为"百戏之祖"，京剧、川剧、越剧等均受其影响。' },
  { category: '年画', fact: '杨柳青年画的制作要经过勾、刻、印、绘、裱五道工序，其中"开脸"（画人物面部）必须由最有经验的画师手工完成。' },
  { category: '蓝印花布', fact: '南通蓝印花布的蓝色来自板蓝根的叶子发酵制成的靛蓝染料，一匹布要浸染 8-10 次才能达到理想的蓝色。' },
  { category: '紫砂', fact: '宜兴紫砂壶具有独特的双层气孔结构，"既不夺香，又无熟汤气"，泡茶隔夜不馊，是公认的最佳茶具材质。' },
  { category: '篆刻', fact: '篆刻艺术将书法（篆书）、章法（构图）和刀法（刻功）三者合一，一方好印需在方寸之间体现"书从印入、印从书出"的意境。' },
  { category: '唐三彩', fact: '唐三彩并非只有三种颜色——"三"在古代汉语中意为"多"，实际釉色包括黄、绿、白、蓝、赭、黑等多种。' },
  { category: '书法', fact: '中国书法有 3000 多年历史，从甲骨文到狂草，共有篆、隶、楷、行、草五种主要书体，每一笔都承载着书写者的情感与修养。' },
  { category: '陶瓷', fact: '龙泉青瓷的"梅子青"釉色需要在 1300℃ 的还原焰中烧成，釉层中的微小气泡和未熔石英颗粒产生了玉石般的温润质感。' },
  { category: '织锦', fact: '宋锦与南京云锦、四川蜀锦并称中国三大名锦，宋锦以图案精美、色彩典雅著称，常用于装裱书画和制作高档服饰。' },
  { category: '雕塑', fact: '寿山石雕讲究"相石取巧"——雕刻师要先反复观察石料的颜色纹理，依石造型，将石料的天然色彩巧妙融入作品之中。' },
  { category: '金属', fact: '苗族银饰制作中，一枚精美的银冠需要熔炼、锻打、拉丝、编结等 30 多道工序，一套完整的盛装银饰重达 10-15 公斤。' },
  { category: '漆器', fact: '平遥推光漆器最关键的是"推光"工序——用砖灰、麻油手工反复打磨数十遍，直到漆面光可鉴人，触之如玉。' },
  { category: '剪纸', fact: '河北蔚县剪纸不同于其他剪纸的"单色剪刻"，采用"阴刻为主、阳刻为辅、点染上色"的独特工艺，被称为"彩色剪纸"。' },
  { category: '民间美术', fact: '自贡龚扇（竹丝扇）用细如发丝的竹丝编织，一把扇子需要上千根竹丝，编织一个月才能完成，薄如蝉翼、轻如鸿毛。' },
  { category: '泥塑', fact: '惠山泥人最著名的"大阿福"造型已有 400 多年历史，传说中阿福是为民除害的神童，胖乎乎的造型寓意团圆和吉祥。' },
  { category: '皮影', fact: '华县皮影选用上等牛皮，要经过刮、磨、洗、刻、染、熨等 24 道工序，一件精美皮影需要雕刻 3000 多刀才能完成。' },
  { category: '竹编', fact: '潍坊风筝制作技艺包括扎、糊、绘、放四大工序，最长的龙头蜈蚣风筝可达数百米，需要几十人合力放飞。' },
  { category: '年画', fact: '桃花坞木版年画采用"饾版水印"技法，一幅年画最多需要 20 多块色版套印，每种颜色一块版，层层叠加、精准对位。' },
  { category: '陶瓷', fact: '宋代汝窑天青釉瓷器传世不足百件，其"雨过天青云破处"的釉色至今无法被完全复制，每一件都是无价之宝。' },
  { category: '刺绣', fact: '粤绣（广绣）以构图饱满、色彩艳丽著称，常用金线、银线绣制，一件龙袍的刺绣有时需要多名绣工合作数年才能完成。' },
]

/** 根据日期获取每日冷知识（同一天所有人看到同一条） */
function getDailyFact() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return ICH_FACTS[dayOfYear % ICH_FACTS.length]
}

// ==================== 快速体验示例（从展厅 API 动态获取） ====================

const SAMPLE_CATEGORIES: Record<string, { icon: string; desc: string }> = {
  '剪纸': { icon: '✂️', desc: '传统民间剪纸艺术' },
  '苏绣': { icon: '🧵', desc: '精细雅洁的刺绣工艺' },
  '陶瓷': { icon: '🏺', desc: '千年瓷都的匠心之作' },
  '皮影': { icon: '🎭', desc: '光影中的千年故事' },
  '织锦': { icon: '🧶', desc: '寸锦寸金的织造技艺' },
  '金属': { icon: '🔔', desc: '精雕细琢的金属工艺' },
  '漆器': { icon: '🪔', desc: '传承千年的髹漆技艺' },
  'default': { icon: '🏛️', desc: '探索非遗文化瑰宝' },
}

// ==================== 主页面 ====================

export default function Recognition() {
  const [step, setStep] = useState<Step>('upload')
  const [result, setResult] = useState<RecognitionResult | null>(null)
  const [previewImage, setPreviewImage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // 最近识别记录
  const [recentRecords, setRecentRecords] = useState<RecognitionListItem[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)

  // 快速体验示例（从展厅 API 动态获取）
  const [sampleImages, setSampleImages] = useState<{ url: string; label: string; icon: string; desc: string; id: number }[]>([])
  const [samplesLoading, setSamplesLoading] = useState(false)

  // 每日冷知识
  const dailyFact = getDailyFact()

  // 支持 ?id=xxx 从个人中心跳转查看详情
  useEffect(() => {
    const idParam = searchParams.get('id')
    if (idParam) {
      const id = parseInt(idParam, 10)
      if (!isNaN(id)) {
        setStep('loading')
        setError('')
        getDetail(id).then(data => {
          setResult(data)
          setPreviewImage(data.image_url)
          setStep('result')
        }).catch(err => {
          setError(err.message || '加载识别记录失败')
          setStep('upload')
        })
      }
    }
  }, [searchParams])

  // 获取最近识别记录
  useEffect(() => {
    if (step === 'upload') {
      setRecordsLoading(true)
      getHistory(1, 3)
        .then(data => {
          const items = Array.isArray(data) ? data : (data?.items || [])
          setRecentRecords(items.slice(0, 3))
        })
        .catch(() => {
          // 静默失败，不影响主流程
        })
        .finally(() => setRecordsLoading(false))
    }
  }, [step])

  // 获取展厅数据作为快速体验示例（与数字展厅同步）
  useEffect(() => {
    if (step === 'upload' && sampleImages.length === 0) {
      setSamplesLoading(true)
      getItems({ page_size: 6, page: 1 })
        .then(data => {
          const items = (data?.items || []).filter((it: HeritageItem) => it.images && it.images.length > 0)
          const samples = items.slice(0, 3).map((it: HeritageItem) => {
            const meta = SAMPLE_CATEGORIES[it.category] || SAMPLE_CATEGORIES['default']
            return {
              url: it.images[0],
              label: it.name.length > 8 ? it.name.slice(0, 8) + '...' : it.name,
              icon: meta.icon,
              desc: meta.desc,
              id: it.id,
            }
          })
          if (samples.length > 0) setSampleImages(samples)
        })
        .catch(() => {
          // 静默失败，不影响主流程
        })
        .finally(() => setSamplesLoading(false))
    }
  }, [step, sampleImages.length])

  // 加载识别详情（复用公共跳转逻辑）
  const loadDetail = async (id: number) => {
    setStep('loading')
    setError('')
    try {
      const data = await getDetail(id)
      setResult(data)
      setPreviewImage(data.image_url)
      setStep('result')
    } catch (err: any) {
      setError(err.message || '加载识别记录失败')
      setStep('upload')
    }
  }

  const handleUpload = async (file: RcFile) => {
    const rawFile = file as unknown as File

    // 前端校验
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const fileType = rawFile.type || ''
    if (!allowedTypes.includes(fileType)) {
      message.error('请上传 JPG / PNG / WebP 格式的图片')
      return false
    }
    if ((rawFile.size || 0) > 10 * 1024 * 1024) {
      message.error('图片大小不能超过 10MB')
      return false
    }

    // 预览
    const previewUrl = URL.createObjectURL(rawFile)
    setPreviewImage(previewUrl)
    setStep('loading')
    setError('')

    try {
      setUploadProgress(0)
      const data = await uploadAndRecognize(rawFile, (pct) => {
        setUploadProgress(pct)
      })
      setResult(data)
      setStep('result')
      window.dispatchEvent(new CustomEvent('companion:action', { detail: { action: 'just_completed_recognition' } }))
      window.dispatchEvent(new CustomEvent('cultivation:check'))
    } catch (err: any) {
      const errMsg = err.message || ''
      let displayMsg: string
      if (errMsg.includes('网络') || errMsg.includes('连接') || errMsg.includes('超时')) {
        displayMsg = '网络连接失败，请检查网络后重试'
      } else if (errMsg.includes('图片') || errMsg.includes('图像') || errMsg.includes('格式') || errMsg.includes('大小')) {
        displayMsg = `图片不符合要求：${errMsg}`
      } else if (errMsg.includes('非遗') || errMsg.includes('识别') || errMsg.includes('内容')) {
        displayMsg = `未能识别到非遗内容：${errMsg}`
      } else {
        displayMsg = errMsg || '识别失败，请尝试上传更清晰的非遗相关图片'
      }
      setError(displayMsg)
      setStep('upload')
      message.error(displayMsg)
    }

    return false
  }

  // 快速体验：点击示例图片直接识别
  const handleSampleClick = async (sample: { url: string; label: string; icon: string; desc: string }) => {
    setPreviewImage(sample.url)
    setStep('loading')
    setError('')
    setUploadProgress(0)

    try {
      const response = await fetch(sample.url)
      if (!response.ok) throw new Error('示例图片加载失败')
      const blob = await response.blob()
      const file = new File([blob], `sample_${sample.label}.jpg`, {
        type: blob.type || 'image/jpeg',
      })

      const data = await uploadAndRecognize(file, (pct) => setUploadProgress(pct))
      setResult(data)
      setStep('result')
      window.dispatchEvent(new CustomEvent('companion:action', { detail: { action: 'just_completed_recognition' } }))
      window.dispatchEvent(new CustomEvent('cultivation:check'))
    } catch (err: any) {
      const errMsg = err.message || ''
      const displayMsg = errMsg.includes('示例') || errMsg.includes('fetch')
        ? '示例图片加载失败，请手动上传图片'
        : (errMsg || '识别失败，请重试')
      setError(displayMsg)
      setStep('upload')
      message.error(displayMsg)
    }
  }

  const handleRetry = () => {
    setResult(null)
    setError('')
    setStep('upload')
  }

  return (
    <>
      {/* 全视口纹样背景 — fixed 覆盖 Header/Sider/边距 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <WindowLatticePattern opacity={0.22} />
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>📷 非遗智能识别与讲解</Title>
        {step === 'result' && (
          <Space>
            <Button
              icon={<FlaskConical />}
              onClick={() => navigate(`/pattern-engine?recognition_id=${result?.id}`)}
              disabled={!result?.pattern_names || result.pattern_names.length === 0}
            >
              纹样基因重组
            </Button>
            <Button icon={<RefreshCw />} onClick={handleRetry}>重新识别</Button>
          </Space>
        )}
      </div>

      {/* === 上传区 === */}
      {step === 'upload' && (
        <>
          <Card style={{ borderRadius: 12 }}>
            {error && (
              <div style={{
                marginBottom: 16, padding: 12,
                background: 'var(--color-bg-active, #FFF3E0)',
                borderRadius: 8,
                color: 'var(--color-error, #C5533B)',
                borderTop: '1px solid var(--color-vermilion, #B8463A)',
                borderRight: '1px solid var(--color-vermilion, #B8463A)',
                borderBottom: '1px solid var(--color-vermilion, #B8463A)',
                borderLeft: '3px solid var(--color-vermilion, #B8463A)',
              }}>
                ⚠️ {error}
              </div>
            )}
            <Dragger
              accept="image/jpeg,image/png,image/webp"
              maxCount={1}
              beforeUpload={handleUpload as any}
              showUploadList={false}
              style={{ padding: 48 }}
            >
              <p className="ant-upload-drag-icon">
                <Inbox style={{ fontSize: 64, color: 'var(--color-vermilion, #B8463A)' }} />
              </p>
              <p style={{ fontSize: 18, marginTop: 16 }}>点击或拖拽上传非遗手工艺品图片</p>
              <p style={{ color: '#999' }}>支持 JPG / PNG / WebP · 最大 10MB · 图片尺寸 ≥ 200px</p>
            </Dragger>
          </Card>

          {/* === 最近识别记录 === */}
          <Card
            title={<span style={{ fontSize: 20 }}><History style={{ marginRight: 8 }} />最近识别</span>}
            extra={
              recentRecords.length > 0 && (
                <Button type="link" size="small" onClick={() => navigate('/user-center/recognition')}>
                  查看全部 →
                </Button>
              )
            }
            style={{ borderRadius: 12, marginTop: 16 }}
          >
            {recordsLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin size="small" />
              </div>
            ) : recentRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Image style={{ fontSize: 32, color: '#ccc', marginBottom: 8 }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 17 }}>
                    还没有识别记录，上传第一张图片开始体验吧
                  </Text>
                </div>
              </div>
            ) : (
              <Row gutter={12}>
                {recentRecords.map(record => (
                  <Col key={record.id} xs={24} sm={8}>
                    <Card
                      hoverable
                      size="small"
                      style={{ borderRadius: 8 }}
                      onClick={() => loadDetail(record.id)}
                    >
                      <img
                        src={normalizeImageUrl(record.image_url)}
                        alt={record.category || '识别记录'}
                        style={{
                          width: '100%', height: 120, objectFit: 'cover',
                          borderRadius: 6, background: 'var(--color-paper)',
                        }}
                      />
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tag color={getCategoryColor(record.category)} style={{ margin: 0, fontSize: 14 }}>
                          {record.category}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {new Date(record.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        </Text>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Card>

          {/* === 快速体验区 === */}
          <Card
            title={<span><Zap style={{ marginRight: 8 }} />快速体验</span>}
            style={{ borderRadius: 12, marginTop: 16 }}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 'var(--text-sm)' }}>
              没有合适的非遗图片？点击下方示例，一键体验 AI 智能识别
            </Text>
            {samplesLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>加载示例中...</Text>
              </div>
            ) : sampleImages.length > 0 ? (
              <Row gutter={12}>
                {sampleImages.map(sample => (
                  <Col key={sample.url} xs={24} sm={8}>
                    <Tooltip title={`点击识别：${sample.label}`}>
                      <Card
                        hoverable
                        size="small"
                        style={{ borderRadius: 8, textAlign: 'center' }}
                        onClick={() => handleSampleClick(sample)}
                      >
                        <img
                          src={normalizeImageUrl(sample.url)}
                          alt={sample.label}
                          style={{
                            width: '100%', height: 120, objectFit: 'cover',
                            borderRadius: 6, background: 'var(--color-paper)',
                          }}
                        />
                        <div style={{ marginTop: 8 }}>
                          <Text strong style={{ fontSize: 'var(--text-sm)' }}>
                            {sample.icon} {sample.label}
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
                            {sample.desc}
                          </Text>
                        </div>
                      </Card>
                    </Tooltip>
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty description="暂无示例，请手动上传图片" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>

          {/* === 非遗冷知识 === */}
          <Card style={{ borderRadius: 12, marginTop: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: `linear-gradient(135deg, ${getCategoryColor(dailyFact.category)}, ${getCategoryColor(dailyFact.category)}44)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
                boxShadow: `0 2px 8px rgba(${parseInt(getCategoryColor(dailyFact.category).slice(1, 3), 16)}, ${parseInt(getCategoryColor(dailyFact.category).slice(3, 5), 16)}, ${parseInt(getCategoryColor(dailyFact.category).slice(5, 7), 16)}, 0.25)`,
              }}>
                <Lightbulb style={{ color: '#fff' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
                    💡 非遗冷知识
                  </Text>
                  <Tag
                    color={getCategoryColor(dailyFact.category)}
                    style={{ marginLeft: 8, fontSize: 11, lineHeight: '18px' }}
                  >
                    {dailyFact.category}
                  </Tag>
                </div>
                <Text style={{ fontSize: 'var(--text-sm)', lineHeight: 1.8, color: 'var(--color-ink-secondary)' }}>
                  你知道吗？{dailyFact.fact}
                </Text>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* === 加载态 === */}
      {step === 'loading' && (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '60px 40px' }}>
          {previewImage && (
            <img
              src={previewImage}
              alt="预览"
              style={{ maxHeight: 200, borderRadius: 8, marginBottom: 32, boxShadow: 'var(--shadow-md, 0 4px 12px rgba(30,27,24,0.08))' }}
            />
          )}
          <Spin size="large" />
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div style={{ maxWidth: 300, margin: '16px auto' }}>
              <Progress percent={uploadProgress} size="small" strokeColor="var(--color-vermilion, #B8463A)" />
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-secondary, #6B5F52)' }}>
                上传中 {uploadProgress}%
              </div>
            </div>
          )}
          <p style={{ marginTop: 24, fontSize: 18, fontWeight: 500 }}>AI 正在深度分析中...</p>
          <div style={{ color: 'var(--color-ink-secondary, #6B5F52)', marginTop: 12 }}>
            <p style={{ margin: 4 }}>
              <FlaskConical /> 分析纹样特征与技法细节
            </p>
            <p style={{ margin: 4 }}>
              <Image /> 匹配非遗品类数据库
            </p>
            <p style={{ margin: 4 }}>
              <Volume2 /> 生成文化讲解与语音
            </p>
          </div>
        </Card>
      )}

      {/* === 结果展示 === */}
      {step === 'result' && result && (
        <ResultDisplay result={result} previewImage={previewImage} navigate={navigate} />
      )}
    </div>
    </>
  )
}

// ==================== 结果展示子组件 ====================

function ResultDisplay({
  result, previewImage, navigate,
}: {
  result: RecognitionResult
  previewImage: string
  navigate: (path: string) => void
}) {
  return (
    <div>
      {/* Agent 执行追踪 */}
      <AgentTimeline
        steps={result.agent_steps}
        executionId={result.execution_id}
        compact
        maxHeight={300}
      />

      {/* 上方: 图片区 */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Tabs
          items={[
            {
              key: 'original',
              label: '原图',
              children: (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={result.image_url || previewImage}
                    alt="上传图片"
                    style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }}
                  />
                </div>
              ),
            },
            {
              key: 'heatmap',
              label: <span><FlaskConical /> 特征热力图</span>,
              children: result.heatmap_url ? (
                <HeatmapViewer
                  src={result.heatmap_url}
                  features={result.heatmap_data}
                />
              ) : (
                <Empty description="暂无热力图数据" />
              ),
            },
          ]}
        />

        {/* 识别结果摘要 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderTop: '1px solid var(--color-border-light, #E8E4D8)' }}>
          <Tag color="#B8463A" style={{ fontSize: 16, padding: '4px 16px' }}>
            🏷 {result.category}
          </Tag>
          <Tag color="blue">置信度 {(result.confidence * 100).toFixed(1)}%</Tag>
          <Space size={4}>
            {result.features?.map(f => (
              <Tag key={f} color="gold">{f}</Tag>
            ))}
          </Space>
        </div>
      </Card>

      {/* 中部: AI讲解 + 语音 */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <AudioPlayer src={result.voice_url} title={`${result.category} — 语音讲解`} />

        <Tabs
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'history',
              label: '📜 历史渊源',
              children: <MarkdownContent content={result.explanation?.history || ''} />,
            },
            {
              key: 'technique',
              label: '🔧 制作工艺',
              children: <MarkdownContent content={result.explanation?.technique || ''} />,
            },
            {
              key: 'inheritor',
              label: '👤 传承人故事',
              children: <MarkdownContent content={result.explanation?.inheritor || ''} />,
            },
            {
              key: 'meaning',
              label: '🎭 文化寓意',
              children: <MarkdownContent content={result.explanation?.meaning || ''} />,
            },
          ]}
        />
      </Card>

      {/* 下部: Top3候选 + 关联推荐 */}
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="🏆 Top 3 候选" style={{ borderRadius: 12, marginBottom: 16 }}>
            {(result.top3 || []).map((item, i) => (
              <div
                key={item.category}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: i < (result.top3 || []).length - 1 ? '1px solid var(--color-border-light, #E8E4D8)' : 'none',
                }}
              >
                <Space>
                  <Tag color={i === 0 ? '#B8463A' : 'default'}>{i + 1}</Tag>
                  <Text strong={i === 0}>{item.category}</Text>
                </Space>
                <Text type="secondary">{(item.confidence * 100).toFixed(1)}%</Text>
              </div>
            ))}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="🔗 关联推荐" style={{ borderRadius: 12, marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>相关文创</Text>
            <div style={{ marginBottom: 16 }}>
              {result.related?.creations?.map(c => (
                <Button
                  key={c.style}
                  type="link"
                  size="small"
                  icon={<ChevronRight />}
                  onClick={() => navigate(`/creative-studio?style=${encodeURIComponent(c.style)}`)}
                >
                  {c.label}
                </Button>
              ))}
            </div>

            <Text type="secondary" style={{ fontSize: 12 }}>展厅藏品</Text>
            {result.related?.exhibits?.length > 0 ? (
              result.related.exhibits.map(e => (
                <Button
                  key={e.id}
                  type="link"
                  size="small"
                  icon={<ChevronRight />}
                  onClick={() => navigate(`/exhibition?id=${e.id}`)}
                >
                  {e.name}
                </Button>
              ))
            ) : (
              <Text type="secondary">暂无关联藏品</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Phase C: XAI 推理路径可视化 */}
      <ExplainPanel module="recognition" recordId={result.id} compact />
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  if (!content) return <Empty description="暂无内容" />
  return (
    <div style={{ lineHeight: 2, fontSize: 15 }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

// ==================== 热力图交互组件 ====================

interface HeatmapFeature {
  name: string
  x: number
  y: number
  label: string
}

function HeatmapViewer({ src, features }: { src: string; features: HeatmapFeature[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  if (!features || features.length === 0) {
    return (
      <div style={{ textAlign: 'center' }}>
        <img
          src={src}
          alt="热力图"
          style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }}
        />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', display: 'inline-block',
        maxWidth: '100%', margin: '0 auto',
      }}
    >
      <img
        src={src}
        alt="热力图"
        style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8, display: 'block' }}
      />

      {/* 交互热点覆盖层 */}
      {features.map((f, i) => {
        const dotSize = 28 + (features.length - i) * 4
        const isHovered = hovered === f.name

        return (
          <div
            key={f.name}
            onMouseEnter={() => setHovered(f.name)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: 'absolute',
              left: `${f.x * 100}%`,
              top: `${f.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            <div style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: `rgba(255, 255, 255, ${isHovered ? 0.9 : 0.6})`,
              border: `2px solid ${isHovered ? '#C41E3A' : 'rgba(255,255,255,0.8)'}`,
              boxShadow: isHovered
                ? '0 0 16px rgba(196,30,58,0.8), 0 0 32px rgba(196,30,58,0.4)'
                : '0 0 8px rgba(255,255,255,0.5)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                color: isHovered ? '#C41E3A' : '#fff',
                fontSize: 'var(--text-xs)',
                fontWeight: 'bold',
                textShadow: isHovered ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
              }}>
                {i + 1}
              </span>
            </div>

            {/* Hover Tooltip */}
            {isHovered && (
              <div style={{
                position: 'absolute',
                left: 20,
                top: -12,
                background: 'rgba(26,26,46,0.95)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 'var(--text-sm)',
                whiteSpace: 'nowrap',
                zIndex: 20,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                border: '1px solid rgba(201,169,110,0.4)',
                pointerEvents: 'none',
              }}>
                <div style={{ fontWeight: 'bold', color: '#C9A96E', marginBottom: 2 }}>
                  🔍 {f.name}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--text-xs)', maxWidth: 220, whiteSpace: 'normal' }}>
                  {f.label}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <div style={{
        position: 'absolute', bottom: 8, right: 12,
        background: 'rgba(0,0,0,0.7)', color: '#fff',
        padding: '6px 12px', borderRadius: 6, fontSize: 'var(--text-xs)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C9A96E' }} />
        悬停编号查看特征详情
      </div>
    </div>
  )
}
