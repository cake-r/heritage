/** AI 伴游悬浮按钮 — Live2D 版，可拖拽移动 + 右键缩放 + 红点通知
 *
 * 唯一 Live2D 实例，Drawer 打开时不隐藏，表情随用户操作自动切换。
 * 边缘弱化：无可见圆形边框，模型自然融入页面背景。
 * 交互：左键拖拽移动 / 右键拖拽缩放 / 点击打开伴游面板。
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Popover } from 'antd'
import { motion } from 'framer-motion'
import { useCompanion } from '../../contexts/CompanionContext'
import Live2DCanvas from './Live2DCanvas'
import type { Live2DCanvasHandle } from './Live2DCanvas'

const INTRO_SHOWN_KEY = 'companion_intro_shown'
const BASE_SIZE = 240           // 基准尺寸（原 120 × 2）
const MIN_SCALE = 0.35          // 最小缩放（≈84px）
const MAX_SCALE = 2.5           // 最大缩放（≈600px）
const DRAG_THRESHOLD = 4        // 移动超过此像素才算拖拽
const RESIZE_SPEED = 0.006      // 右键拖拽灵敏度

export default function CompanionFloatButton() {
  const {
    hasHighConfidence, openDrawer, loading, chatLoading, chatMessages,
    expression, lipSync,
  } = useCompanion()
  const [showIntro, setShowIntro] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [hovering, setHovering] = useState(false)
  const live2dRef = useRef<Live2DCanvasHandle>(null)

  // ──── 拖拽 & 缩放状态 ────
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState(() => ({
    x: window.innerWidth - BASE_SIZE - 24,
    y: window.innerHeight - BASE_SIZE - 24,
  }))
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 })
  const resizeStartRef = useRef({ mouseY: 0, startScale: 1 })
  const dragDistRef = useRef(0)  // 累计移动距离，区分点击与拖拽

  const currentSize = Math.round(BASE_SIZE * scale)

  // 窗口 resize 时约束位置不超出视口
  useEffect(() => {
    const handleResize = () => {
      setPosition(p => ({
        x: Math.min(p.x, window.innerWidth - currentSize),
        y: Math.min(p.y, window.innerHeight - currentSize),
      }))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [currentSize])

  // ──── 全屏目光跟随：鼠标在屏幕任意位置，眼球都追踪 ────
  useEffect(() => {
    if (!modelReady || isDragging || isResizing) return

    const handleGlobalMouse = (e: MouseEvent) => {
      const cx = position.x + currentSize / 2
      const cy = position.y + currentSize / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      // 以半屏作为最大偏移范围，映射到 -1~1
      const rangeX = window.innerWidth * 0.5
      const rangeY = window.innerHeight * 0.5
      const lookAtX = Math.max(-1, Math.min(1, dx / rangeX))
      const lookAtY = Math.max(-1, Math.min(1, dy / rangeY))
      live2dRef.current?.updateParams({ lookAtX, lookAtY })
    }

    const handleLeave = () => {
      live2dRef.current?.updateParams({ lookAtX: 0, lookAtY: 0 })
    }

    window.addEventListener('mousemove', handleGlobalMouse, { passive: true })
    document.addEventListener('mouseleave', handleLeave)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouse)
      document.removeEventListener('mouseleave', handleLeave)
    }
  }, [modelReady, isDragging, isResizing, position, currentSize])

  // ──── 鼠标事件：拖拽 / 缩放 / 点击 ────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      // 左键 — 开始拖拽
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        posX: position.x,
        posY: position.y,
      }
      dragDistRef.current = 0
      setIsDragging(true)
      e.preventDefault()
    }
  }, [position])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 右键 — 开始缩放
    resizeStartRef.current = {
      mouseY: e.clientY,
      startScale: scale,
    }
    setIsResizing(true)
  }, [scale])

  useEffect(() => {
    const firstIntro = localStorage.getItem(INTRO_SHOWN_KEY)
    if (!firstIntro) {
      const timer = setTimeout(() => {
        setShowIntro(true)
        localStorage.setItem(INTRO_SHOWN_KEY, '1')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleModelLoad = useCallback(() => {
    setModelReady(true)
    setModelError(null)
  }, [])

  // 全局 mouseMove / mouseUp（拖拽和缩放期间）
  useEffect(() => {
    if (!isDragging && !isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.mouseX
        const dy = e.clientY - dragStartRef.current.mouseY
        dragDistRef.current = Math.abs(dx) + Math.abs(dy)
        const size = BASE_SIZE * scale
        setPosition({
          x: Math.max(-size * 0.3, Math.min(window.innerWidth - size * 0.7, dragStartRef.current.posX + dx)),
          y: Math.max(-size * 0.3, Math.min(window.innerHeight - size * 0.7, dragStartRef.current.posY + dy)),
        })
      }
      if (isResizing) {
        const dy = resizeStartRef.current.mouseY - e.clientY
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, resizeStartRef.current.startScale + dy * RESIZE_SPEED))
        setScale(newScale)
        // 缩放后约束位置
        const newSize = BASE_SIZE * newScale
        setPosition(p => ({
          x: Math.min(p.x, window.innerWidth - newSize * 0.7),
          y: Math.min(p.y, window.innerHeight - newSize * 0.7),
        }))
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (isDragging && dragDistRef.current < DRAG_THRESHOLD) {
        // 没有明显移动 → 视为点击
        if (showIntro) setShowIntro(false)
        openDrawer()
      }
      setIsDragging(false)
      setIsResizing(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, scale, showIntro, openDrawer, position])

  const hasUnread = chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === 'assistant'
  const showIndicator = hasHighConfidence || hasUnread
  const tooltipText =
    loading || chatLoading ? '正在思考...'
    : hasHighConfidence ? '有新建议'
    : hasUnread ? '伴游有新消息'
    : isResizing ? `缩放: ${Math.round(scale * 100)}%`
    : `AI 伴游 · 拖拽移动 · 右键缩放`

  const handleMouseEnter = useCallback(() => setHovering(true), [])
  const handleMouseLeave = useCallback(() => setHovering(false), [])

  const liveParams = { lipSync }

  // 当前交互光标
  const cursorStyle = isDragging ? 'grabbing' : isResizing ? 'ns-resize' : hovering ? 'grab' : 'pointer'

  const button = (
    <button
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={modelError ? `模型加载失败: ${modelError}` : tooltipText}
      aria-label="AI 伴游"
      style={{
        position: 'relative',
        width: currentSize,
        height: currentSize,
        padding: 0,
        cursor: cursorStyle,
        background: 'transparent',
        border: 'none',
        transition: isDragging || isResizing
          ? 'none'
          : 'box-shadow 0.5s, transform 0.2s',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      <Live2DCanvas
        ref={live2dRef}
        width={currentSize}
        height={currentSize}
        expression={expression}
        liveParams={liveParams}
        enableMouseTracking={false}
        noClip
        onLoad={handleModelLoad}
        onError={(err) => {
          console.error('[Live2D FloatButton] Model load error:', err)
          setModelReady(false)
          setModelError(err.message)
        }}
        style={{
          opacity: modelReady ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      />

      {!modelReady && (
        <span style={{
          position: 'absolute',
          color: '#fff',
          fontSize: currentSize * 0.3,
          lineHeight: 1,
        }}>
          🤖
        </span>
      )}

      {/* 缩放百分比指示器 */}
      {isResizing && (
        <span style={{
          position: 'absolute',
          bottom: currentSize * 0.12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.65)',
          color: '#fff',
          padding: '1px 8px',
          borderRadius: 10,
          fontSize: Math.max(10, currentSize * 0.06),
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 3,
        }}>
          {Math.round(scale * 100)}%
        </span>
      )}

    </button>
  )

  return (
    <motion.div
      key="companion-float"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: 2 }}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
      }}
    >
      <motion.div
        animate={{
          scale: showIndicator && !isDragging && !isResizing ? [1, 1.04, 1] : 1,
        }}
        transition={{
          scale: showIndicator
            ? { repeat: Infinity, duration: 2, ease: 'easeInOut' }
            : { duration: 0.2 },
        }}
      >
        {showIntro ? (
          <Popover
            content={
              <div style={{ maxWidth: 200, fontSize: 'var(--text-sm)' }}>
                我是<strong>灵儿</strong>，你的 AI 导游 ✨<br />
                点击我可以聊天、左键拖拽移动、右键拖拽缩放
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
