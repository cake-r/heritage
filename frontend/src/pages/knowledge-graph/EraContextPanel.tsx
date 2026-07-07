import { useEffect, useState } from 'react'
import { Card, Typography, Spin, Empty, Tag, Divider } from 'antd'
import { History, Building2, Globe, Wrench } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getEraContext, type EraContext } from '../../services/knowledgeGraph'

const { Text, Paragraph } = Typography

interface EraContextPanelProps {
  era: string
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  politics: <Building2 />,
  economy: <Globe />,
  culture: <History />,
  craft_relevance: <Wrench />,
}

const SECTION_LABELS: Record<string, string> = {
  politics: '政治格局',
  economy: '经济状况',
  culture: '文化特征',
  craft_relevance: '非遗技艺',
}

export default function EraContextPanel({ era }: EraContextPanelProps) {
  const [context, setContext] = useState<EraContext | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!era) return
    setLoading(true)
    getEraContext(era)
      .then(setContext)
      .catch(() => setContext(null))
      .finally(() => setLoading(false))
  }, [era])

  if (loading) {
    return (
      <Card
        size="small"
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-light)',
          background: 'var(--color-paper-white)',
        }}
        styles={{ body: { padding: 16, textAlign: 'center' } }}
      >
        <Spin size="small" tip="加载时代背景..." />
      </Card>
    )
  }

  if (!context) {
    return (
      <Card
        size="small"
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-light)',
          background: 'var(--color-paper-white)',
        }}
        styles={{ body: { padding: 16 } }}
      >
        <Empty description="暂无时代背景数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    )
  }

  const sections = (['politics', 'economy', 'culture', 'craft_relevance'] as const)
    .filter(key => context[key])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={era}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <Card
          size="small"
          title={
            <span style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: 2,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink)',
            }}>
              📜 {context.era} · 时代背景
            </span>
          }
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-gold-light, #E8D5B0)',
            background: 'linear-gradient(180deg, var(--color-paper-white, #FFFDF9) 0%, #FFF9EE 100%)',
            maxHeight: 520,
            overflowY: 'auto',
          }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          {sections.map((key, idx) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.08 }}
            >
              <div style={{ marginBottom: idx < sections.length - 1 ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: 'var(--color-vermilion, #B8463A)', fontSize: 14 }}>
                    {SECTION_ICONS[key]}
                  </span>
                  <Text strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink)' }}>
                    {SECTION_LABELS[key]}
                  </Text>
                  {key === 'craft_relevance' && (
                    <Tag color="volcano" style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px' }}>
                      核心
                    </Tag>
                  )}
                </div>
                <Paragraph
                  style={{
                    margin: 0,
                    fontSize: 'var(--text-xs)',
                    lineHeight: 1.85,
                    color: 'var(--color-ink-tertiary, #5A4F42)',
                    textAlign: 'justify',
                  }}
                >
                  {context[key]}
                </Paragraph>
                {idx < sections.length - 1 && <Divider style={{ margin: '10px 0 6px' }} />}
              </div>
            </motion.div>
          ))}
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
