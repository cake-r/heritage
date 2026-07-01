/** 系统配置 — 热更新配置项 */

import { useEffect, useState } from 'react'
import { Card, InputNumber, Slider, Switch, Button, Typography, message, Spin, Divider } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { fetchConfig, updateConfig } from '../../services/admin'

const { Title, Text } = Typography

export default function ConfigPanel() {
  const [config, setConfig] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchConfig().then((c) => {
      setConfig(c)
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async (key: string, value: any) => {
    setSaving(true)
    try {
      await updateConfig({ [key]: value })
      message.success('配置已保存')
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />

  const rateLimits = config.rate_limits || {}
  const circuitBreaker = config.circuit_breaker || {}
  const companion = config.companion || {}
  const recommendation = config.recommendation || {}

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>系统配置</Title>

      <Card title="用户日配额" style={{ marginBottom: 16 }}>
        {Object.entries(rateLimits).map(([key, value]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 12 }}>
            <Text style={{ width: 120 }}>{key}</Text>
            <InputNumber
              min={0} max={1000} value={value as number}
              onChange={(v) => setConfig({ ...config, rate_limits: { ...rateLimits, [key]: v || 0 } })}
            />
          </div>
        ))}
        <Button icon={<SaveOutlined />} type="primary" loading={saving}
          onClick={() => handleSave('rate_limits', rateLimits)}>保存限流配额</Button>
      </Card>

      <Card title="熔断器" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Text>连续失败阈值: {circuitBreaker.threshold || 5}</Text>
          <Slider
            min={1} max={20} value={circuitBreaker.threshold || 5}
            onChange={(v) => setConfig({ ...config, circuit_breaker: { ...circuitBreaker, threshold: v } })}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text>恢复时间 (秒): {circuitBreaker.recovery_time || 300}</Text>
          <Slider
            min={60} max={1800} step={30} value={circuitBreaker.recovery_time || 300}
            onChange={(v) => setConfig({ ...config, circuit_breaker: { ...circuitBreaker, recovery_time: v } })}
          />
        </div>
        <Button icon={<SaveOutlined />} type="primary" loading={saving}
          onClick={() => handleSave('circuit_breaker', circuitBreaker)}>保存熔断器</Button>
      </Card>

      <Card title="伴游频率控制" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <Text>默认冷却 (秒): {companion.cooldown_default || 180}</Text>
          <Slider min={30} max={600} step={15} value={companion.cooldown_default || 180}
            onChange={(v) => setConfig({ ...config, companion: { ...companion, cooldown_default: v } })} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text>高价值事件冷却 (秒): {companion.cooldown_high_value || 45}</Text>
          <Slider min={15} max={300} step={15} value={companion.cooldown_high_value || 45}
            onChange={(v) => setConfig({ ...config, companion: { ...companion, cooldown_high_value: v } })} />
        </div>
        <Button icon={<SaveOutlined />} type="primary" loading={saving}
          onClick={() => handleSave('companion', companion)}>保存伴游配置</Button>
      </Card>

      <Card title="推荐系统">
        <div style={{ marginBottom: 12 }}>
          <Text>探索比例: {recommendation.explore_ratio || 0.2}</Text>
          <Slider min={0} max={1} step={0.05} value={recommendation.explore_ratio || 0.2}
            onChange={(v) => setConfig({ ...config, recommendation: { ...recommendation, explore_ratio: v } })} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text>冷启动阈值: {recommendation.cold_start_threshold || 5}</Text>
          <Slider min={1} max={20} value={recommendation.cold_start_threshold || 5}
            onChange={(v) => setConfig({ ...config, recommendation: { ...recommendation, cold_start_threshold: v } })} />
        </div>
        <Button icon={<SaveOutlined />} type="primary" loading={saving}
          onClick={() => handleSave('recommendation', recommendation)}>保存推荐配置</Button>
      </Card>
    </div>
  )
}
