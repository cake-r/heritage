/** Live2D Canvas 组件 — 初始化 PixiJS + Live2D 模型，响应 expression prop + 参数驱动
 *
 * v2 (2026-07-04):
 *   - canvas pointerEvents='none' 确保鼠标事件穿透到容器 div
 *   - 暴露 debug prop → 控制台 rAF 诊断日志
 *   - 加载完成/失败状态更清晰
 */

import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { useLive2D, mapMouseToFocus } from '../../hooks/useLive2D'
import type { Live2DExpression, Live2DParams } from '../../hooks/useLive2D'

export type { Live2DExpression }

export interface Live2DCanvasHandle {
  setExpression: (expr: Live2DExpression) => void
  playMotion: (group: string, index?: number, priority?: number) => void
  setFocus: (x: number, y: number) => void
  setParam: (name: string, value: number) => void
  updateParams: (partial: Partial<Live2DParams>) => void
}

interface Live2DCanvasProps {
  modelUrl?: string
  width: number
  height: number
  expression?: Live2DExpression
  liveParams?: Partial<Live2DParams>
  enableMouseTracking?: boolean
  onTap?: () => void
  className?: string
  style?: React.CSSProperties
  onLoad?: () => void
  onError?: (error: Error) => void
  noClip?: boolean
  /** 开启 rAF 调试日志（控制台每 60 帧输出一次参数状态） */
  debug?: boolean
}

const DEFAULT_MODEL = '/live2d/yuezhengling/乐正绫10live2d.model3.json'

const Live2DCanvas = forwardRef<Live2DCanvasHandle, Live2DCanvasProps>(
  function Live2DCanvas(
    {
      modelUrl = DEFAULT_MODEL,
      width,
      height,
      expression = 'idle',
      liveParams,
      enableMouseTracking = false,
      onTap,
      className,
      style,
      onLoad,
      onError,
      noClip = false,
      debug = false,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const attachedRef = useRef(false)

    const {
      loading, error, ready,
      setExpression, playMotion, setFocus,
      setParam, updateParams, setPaused, attach,
      setDebug,
    } = useLive2D(modelUrl, width, height)

    // 同步 debug 开关
    useEffect(() => { setDebug(debug) }, [debug, setDebug])

    // ── 创建 canvas 并初始化 ──
    useEffect(() => {
      const container = containerRef.current
      if (!container || attachedRef.current) return
      attachedRef.current = true

      const canvas = document.createElement('canvas')
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.display = 'block'
      // 🔴 关键: pointerEvents='none' 让鼠标事件穿透 canvas，
      // 由容器 div 统一处理 mousemove/mouseleave/click
      canvas.style.pointerEvents = 'none'
      container.appendChild(canvas)

      attach(canvas)

      return () => {
        if (container.contains(canvas)) {
          container.removeChild(canvas)
        }
        attachedRef.current = false
      }
    }, [attach])

    // ── Page Visibility API ──
    useEffect(() => {
      const handleVisibility = () => setPaused(document.hidden)
      document.addEventListener('visibilitychange', handleVisibility)
      return () => document.removeEventListener('visibilitychange', handleVisibility)
    }, [setPaused])

    // ── 加载回调 ──
    useEffect(() => { if (ready) onLoad?.() }, [ready])
    useEffect(() => { if (error) onError?.(error) }, [error])

    // ── expression prop → 表情切换 ──
    useEffect(() => {
      if (!ready) return
      setExpression(expression)
    }, [expression, ready, setExpression])

    // ── liveParams → 同步到 rAF ──
    useEffect(() => {
      if (!ready || !liveParams) return
      updateParams(liveParams)
    }, [ready, liveParams, updateParams])

    // ── 鼠标视线跟踪 ──
    useEffect(() => {
      if (!enableMouseTracking || !ready) return
      const container = containerRef.current
      if (!container) return

      const handleMouse = (e: MouseEvent) => {
        const rect = container!.getBoundingClientRect()
        const { x, y } = mapMouseToFocus(e.clientX, e.clientY, rect)
        updateParams({ lookAtX: x, lookAtY: y })
      }
      const handleLeave = () => {
        updateParams({ lookAtX: 0, lookAtY: 0 })
      }
      container.addEventListener('mousemove', handleMouse)
      container.addEventListener('mouseleave', handleLeave)
      return () => {
        container.removeEventListener('mousemove', handleMouse)
        container.removeEventListener('mouseleave', handleLeave)
      }
    }, [enableMouseTracking, ready, updateParams])

    // ── 点击/触摸 ──
    const handleClick = useCallback((e: React.MouseEvent) => {
      if (onTap) {
        e.stopPropagation()
        onTap()
      }
    }, [onTap])

    // ── 暴露方法 ──
    useImperativeHandle(ref, () => ({
      setExpression, playMotion, setFocus, setParam, updateParams,
    }), [setExpression, playMotion, setFocus, setParam, updateParams])

    return (
      <div
        ref={containerRef}
        className={className}
        onClick={handleClick}
        style={{
          position: 'relative',
          width,
          height,
          overflow: 'hidden',
          borderRadius: noClip ? undefined : '50%',
          cursor: onTap ? 'pointer' : undefined,
          ...style,
        }}
      >
        {/* 加载中 */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-paper, #F7F4ED)',
            color: 'var(--color-ink-secondary, #8B8178)',
            fontSize: 14,
            zIndex: 1,
          }}>
            ...
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-paper, #F7F4ED)',
            color: 'var(--color-vermilion, #B8463A)',
            fontSize: 10,
            padding: 4,
            zIndex: 1,
            textAlign: 'center',
            lineHeight: 1.3,
          }}>
            <span style={{ fontSize: 16, marginBottom: 2 }}>⚠️</span>
            <span style={{ wordBreak: 'break-all', maxWidth: '100%', overflow: 'hidden' }}>
              {width < 100
                ? (error.message?.length > 30 ? error.message.slice(0, 30) + '…' : error.message)
                : error.message}
            </span>
          </div>
        )}
      </div>
    )
  },
)

export default Live2DCanvas
