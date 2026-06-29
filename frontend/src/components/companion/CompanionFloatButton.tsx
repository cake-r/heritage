/** AI 伴游悬浮按钮 — 右下角 FloatButton + 红点通知 */

import { FloatButton } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useCompanion } from '../../contexts/CompanionContext'

export default function CompanionFloatButton() {
  const { hasHighConfidence, openDrawer, loading } = useCompanion()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 2 }} // 延迟出现，不抢占页面加载注意力
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
      }}
    >
      <motion.div
        animate={hasHighConfidence ? {
          y: [0, -4, 0],
        } : {}}
        transition={{
          repeat: hasHighConfidence ? Infinity : 0,
          duration: 2,
          ease: 'easeInOut',
        }}
      >
        <FloatButton
          icon={<RobotOutlined />}
          type="primary"
          onClick={openDrawer}
          tooltip={loading ? '正在思考...' : hasHighConfidence ? '有新建议' : 'AI 伴游'}
          style={{
            width: 56,
            height: 56,
            boxShadow: hasHighConfidence
              ? '0 4px 20px rgba(184, 70, 58, 0.4)'
              : '0 2px 10px rgba(0, 0, 0, 0.15)',
          }}
          badge={hasHighConfidence ? {
            dot: true,
            color: '#B8463A',
          } : undefined}
        />
      </motion.div>
    </motion.div>
  )
}
