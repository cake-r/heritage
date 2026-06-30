/** 首次登录引导弹窗 — 3 步引导 */
import { useState } from 'react'
import { Modal, Steps, Typography, Space } from 'antd'
import { CameraOutlined, MessageOutlined, IdcardOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Paragraph } = Typography

const ONBOARDING_KEY = 'onboarding_shown'

const steps = [
  {
    title: '拍照识物 · 探索非遗',
    icon: <CameraOutlined />,
    description: '拍一张非遗相关的照片——剪纸、刺绣、陶瓷…AI 会自动识别工艺技法，为你讲述背后的故事。',
    route: '/recognition',
    color: '#B8463A',
  },
  {
    title: '对话传承人 · 深入交流',
    icon: <MessageOutlined />,
    description: '进入技艺工坊，选择一位非遗传承人 AI 分身，你可以提问、学习、甚至共创作品。',
    route: '/workshop',
    color: '#C4A265',
  },
  {
    title: '收集护照印章 · 开启修习',
    icon: <IdcardOutlined />,
    description: '每次与非遗互动都会获得印章和 XP 经验值，解锁段位称号，成为非遗守护者。',
    route: '/passport',
    color: '#4A8C5C',
  },
]

export function isOnboardingShown(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === '1'
}

export function markOnboardingShown(): void {
  localStorage.setItem(ONBOARDING_KEY, '1')
}

export default function OnboardingGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState(0)
  const navigate = useNavigate()

  const handleDone = () => {
    markOnboardingShown()
    onClose()
  }

  const handleTry = () => {
    const route = steps[current].route
    handleDone()
    navigate(route)
  }

  return (
    <Modal
      title={
        <span style={{ fontSize: 'var(--text-md)', fontWeight: 600 }}>
          🏮 欢迎来到文博灵境
        </span>
      }
      open={open}
      onCancel={handleDone}
      footer={null}
      width={480}
      centered
      styles={{ body: { padding: '24px 32px' } }}
    >
      <Paragraph
        type="secondary"
        style={{ textAlign: 'center', marginBottom: 24, fontSize: 'var(--text-sm)' }}
      >
        这是一个非遗数字交互平台，AI 将陪你探索传统文化的奥秘。
        <br />
        先从这三步开始吧 👇
      </Paragraph>

      <Steps
        current={current}
        onChange={setCurrent}
        direction="vertical"
        size="small"
        items={steps.map((s, i) => ({
          title: s.title,
          description: current === i ? s.description : '',
          icon: s.icon,
        }))}
        style={{ marginBottom: 24 }}
      />

      {/* 当前步骤的详细描述 */}
      <div
        style={{
          background: 'var(--color-bg-active, #FFF3E0)',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 24,
          borderLeft: `3px solid ${steps[current].color}`,
        }}
      >
        <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.8, color: 'var(--color-ink-secondary, #6B5F52)' }}>
          {steps[current].description}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <Space>
          <span
            onClick={handleDone}
            style={{
              cursor: 'pointer',
              color: 'var(--color-ink-secondary, #6B5F52)',
              fontSize: 'var(--text-sm)',
              textDecoration: 'underline',
            }}
          >
            稍后再说
          </span>
          <span
            onClick={handleTry}
            style={{
              cursor: 'pointer',
              background: steps[current].color,
              color: '#fff',
              padding: '6px 20px',
              borderRadius: 6,
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              border: 'none',
            }}
          >
            去试试 →
          </span>
        </Space>
      </div>
    </Modal>
  )
}
