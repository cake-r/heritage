/** AI 伴游悬浮按钮 — v2 对话式，右下角 FloatButton + 红点通知 */

import { useState, useEffect } from 'react'
import { FloatButton, Popover } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useCompanion } from '../../contexts/CompanionContext'

const INTRO_SHOWN_KEY = 'companion_intro_shown'

export default function CompanionFloatButton() {
  const { hasHighConfidence, openDrawer, loading, chatLoading, chatMessages } = useCompanion()
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    // 延迟 3 秒后显示介绍气泡（首次）
    const shown = localStorage.getItem(INTRO_SHOWN_KEY)
    if (!shown) {
      const timer = setTimeout(() => {
        setShowIntro(true)
        localStorage.setItem(INTRO_SHOWN_KEY, '1')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  const hasUnread = chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === 'assistant'
  const showIndicator = hasHighConfidence || hasUnread

  const button = (
    <FloatButton
      icon={<RobotOutlined />}
      type="primary"
      onClick={() => {
        if (showIntro) setShowIntro(false)
        openDrawer()
      }}
      tooltip={
        loading || chatLoading ? '正在思考...'
        : hasHighConfidence ? '有新建议'
        : hasUnread ? '伴游有新消息'
        : 'AI 伴游'
      }
      style={{
        width: 56,
        height: 56,
        boxShadow: showIndicator
          ? '0 4px 20px rgba(184, 70, 58, 0.4)'
          : '0 2px 10px rgba(0, 0, 0, 0.15)',
      }}
      badge={showIndicator ? {
        dot: true,
        color: '#B8463A',
      } : undefined}
    />
  )

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 2 }}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
      }}
    >
      <motion.div
        animate={showIndicator ? { y: [0, -4, 0] } : {}}
        transition={{
          repeat: showIndicator ? Infinity : 0,
          duration: 2,
          ease: 'easeInOut',
        }}
      >
        {showIntro ? (
          <Popover
            content={
              <div style={{ maxWidth: 200, fontSize: 'var(--text-sm)' }}>
                我是<strong>灵儿</strong>，你的 AI 导游 ✨<br />
                点击我可以聊天、获取非遗知识推荐
              </div>
            }
            title="👋 初次见面"
            open
            onOpenChange={(open) => { if (!open) setShowIntro(false) }}
            placement="left"
          >
            {button}
          </Popover>
        ) : (
          button
        )}
      </motion.div>
    </motion.div>
  )
}
