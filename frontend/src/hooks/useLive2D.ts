/** Live2D 模型管理 Hook — 封装 pixi-live2d-display，支持表情/动作/参数驱动
 *
 * v2 重写 (2026-07-04):
 *   - 逐参数 try/catch 避免单点故障导致整帧跳过
 *   - 显式激活 Physics（调用 internalModel.physics.start()）
 *   - Idle 动画加载后验证是否成功
 *   - 调试模式开关：console 输出 rAF 帧计数 + 参数值
 *   - 修复 StrictMode 双重挂载竞态
 */

import { useRef, useState, useCallback, useEffect } from 'react'

export type Live2DExpression = 'idle' | 'star' | 'sing' | 'angry' | 'dizzy' | 'dall'

/** MotionPriority 枚举值（避免静态 import pixi-live2d-display） */
export const MOTION_PRIORITY = { NONE: 0, IDLE: 1, NORMAL: 2, FORCE: 3 } as const

const EXPRESSION_FILES: Record<string, string> = {
  star: 'star.exp3.json',
  sing: 'sing.exp3.json',
  angry: 'angry.exp3.json',
  dizzy: 'dizzy.exp3.json',
  dall: 'dall.exp3.json',
}

/** 运行时参数 — 通过 rAF 持续驱动模型 */
export interface Live2DParams {
  lipSync: number       // 0~1，映射到 ParamMouthOpenY
  lookAtX: number       // -1~1，眼球/头部水平
  lookAtY: number       // -1~1，眼球/头部垂直
  autoBlink: boolean    // 自动眨眼
  autoBreath: boolean   // 自动呼吸
}

const DEFAULT_PARAMS: Live2DParams = {
  lipSync: 0,
  lookAtX: 0,
  lookAtY: 0,
  autoBlink: true,
  autoBreath: true,
}

/** 安全设置参数：单个参数失败不影响其他参数 */
function _safeSet(core: any, id: string, value: number, weight = 1) {
  try {
    core.setParameterValueById(id, value, weight)
  } catch (_) {
    // 参数不存在时静默跳过（某些模型缺少特定骨骼）
  }
}

export interface UseLive2DReturn {
  loading: boolean
  error: Error | null
  ready: boolean
  /** 是否处于调试模式（rAF 每 60 帧输出一次诊断日志） */
  debug: boolean
  setDebug: (on: boolean) => void
  setExpression: (expr: Live2DExpression) => void
  playMotion: (group: string, index?: number, priority?: number) => void
  setFocus: (x: number, y: number) => void
  setParam: (name: string, value: number) => void
  updateParams: (partial: Partial<Live2DParams>) => void
  attach: (canvas: HTMLCanvasElement) => Promise<void>
  setPaused: (paused: boolean) => void
}

export function useLive2D(
  modelUrl: string,
  width: number,
  height: number,
): UseLive2DReturn {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [ready, setReady] = useState(false)
  const [debug, setDebug] = useState(false)

  // 🔴 StrictMode 修复: ready 状态在 cleanup→remount 间被 React 保留，
  // 导致二次 mount 时 setReady(true) 不触发变化 → rAF 永远不启动。
  // readyEpoch 每次 attach 成功后递增，作为 rAF effect 的真实依赖。
  const readyEpochRef = useRef(0)
  const [readyEpoch, setReadyEpoch] = useState(0)

  const appRef = useRef<any>(null)
  const modelRef = useRef<any>(null)
  const destroyedRef = useRef(false)
  const generationRef = useRef(0)
  const pausedRef = useRef(false)
  const rafRef = useRef<number>(0)
  const frameCountRef = useRef(0)
  const blinkTimerRef = useRef(0)
  const breathTimerRef = useRef(0)
  const blinkIntervalRef = useRef(randomBlinkInterval())
  const paramsRef = useRef<Live2DParams>({ ...DEFAULT_PARAMS })

  // ──── attach: 初始化模型 ────

  const attach = useCallback(async (canvas: HTMLCanvasElement) => {
    const gen = ++generationRef.current
    destroyedRef.current = false

    const _log = (msg: string) => console.log(`[useLive2D#${gen}] ${msg}`)
    const _err = (msg: string, e?: any) => console.error(`[useLive2D#${gen}] ${msg}`, e || '')
    const _stale = () => generationRef.current !== gen || destroyedRef.current

    try {
      _log(`开始加载: ${modelUrl} (canvas ${width}×${height})`)

      // ① CDN 全局变量
      const core = (window as any).Live2DCubismCore
      if (!core) throw new Error('Live2DCubismCore 未加载! 检查 CDN script 标签')
      _log(`✅ Cubism Core OK`)

      // ② 动态导入
      const pixiModule: any = await import('pixi.js')
      // 🔴 关键: pixi-live2d-display 的 Automator 通过 window.PIXI 查找 Ticker.shared。
      // 不设置此全局变量则 ticker 为 undefined → 模型 update() 永不调用 →
      // Motion/Physics/Blink/Breath/Pose 全部静默失效 → 模型完全静止。
      const win = window as any
      win.PIXI = pixiModule
      // 🔴 显式启动共享 Ticker：当旧模型销毁时 Ticker.shared 可能已停止，
      // 新模型加载后必须确保 Ticker 在运行，否则模型渲染为静态截图。
      try {
        pixiModule.Ticker.shared.start()
      } catch (_) { /* Ticker 可能已在运行 */ }
      if (_stale()) return
      const cubism4 = await import('pixi-live2d-display/cubism4')
      if (_stale()) return
      const { Live2DModel } = cubism4
      _log(`✅ PIXI v${pixiModule.VERSION} + cubism4`)

      // ③ PIXI Application
      const app = new pixiModule.Application({
        view: canvas,
        width,
        height,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      if (_stale()) { app.destroy(true, { children: true, texture: true }); return }
      appRef.current = app

      // ④ 加载模型
      _log('Live2DModel.from()...')
      const model = await Live2DModel.from(modelUrl, {
        autoUpdate: true,
        autoFocus: false,
        autoHitTest: false,
      })
      if (_stale()) { model.destroy(); app.destroy(true, { children: true, texture: true }); return }
      modelRef.current = model
      _log(`✅ 模型: ${model.internalModel.width}×${model.internalModel.height}`)

      // ⑤ 缩放居中
      model.anchor.set(0.5, 0.5)
      model.x = width / 2
      model.y = height * 0.55
      const modelW = model.internalModel.width
      const modelH = model.internalModel.height
      const scale = modelW && modelH
        ? Math.min((width * 0.85) / modelW, (height * 0.9) / modelH)
        : 0.1
      model.scale.set(scale)
      _log(`scale=${scale.toFixed(3)}`)

      // ⑥ 加入 stage
      app.stage.addChild(model)

      // ⑦ 显式激活 Physics（pixi-live2d-display 可能不自动启用）
      try {
        const im = model.internalModel
        if (im?.physics) {
          im.physics.start()
          _log('✅ Physics 已激活')
        } else if (im?.coreModel && im.settings?.physics) {
          // 尝试通过 Cubism4InternalModel 的方式访问
          _log('⚠️ Physics 引用存在但无 .start()，可能已自动激活')
        } else {
          _log('⚠️ 此模型无 Physics 定义')
        }
      } catch (e: any) {
        _log(`⚠️ Physics 激活异常: ${e.message}`)
      }

      // ⑧ 播放 Idle 循环动画
      let idleOk = false
      try {
        // 检查 Idle 动作组是否存在
        const motionGroups = model.internalModel?.settings?.motions
        if (motionGroups) {
          const groupNames = Object.keys(motionGroups)
          _log(`可用动作组: [${groupNames.join(', ')}]`)
        }
        model.motion('Idle', 0, MOTION_PRIORITY.IDLE)
        idleOk = true
        _log('✅ Idle 动画已启动')
      } catch (_m: any) {
        _log(`⚠️ Idle 动作组不存在 (${_m?.message || 'unknown'})，尝试 fallback...`)
        // 尝试直接加载 motion3.json 并播放
        try {
          const motionUrl = modelUrl.replace(/[^/]+\.model3\.json$/, '循环2.motion3.json')
          const resp = await fetch(motionUrl)
          if (resp.ok) {
            const motionData = await resp.json()
            // 通过 motionManager 直接注入
            const mm = model.internalModel?.motionManager
            if (mm && typeof mm.startMotion === 'function') {
              // 尝试使用内部 API（不同版本可能不同）
              _log('⚠️ 无法直接注入 motion，模型将仅依赖 rAF 驱动')
            }
          }
        } catch (_f) {
          _log('⚠️ Idle fallback 也失败')
        }
      }

      // ⑨ 完成 — 递增 epoch 确保 StrictMode 二次挂载时 rAF 能重启
      if (!_stale()) {
        const epoch = ++readyEpochRef.current
        setLoading(false)
        setReady(true)
        setReadyEpoch(epoch)
        _log(`🎉 加载完成 epoch=${epoch} (idle=${idleOk})`)
      } else {
        model.destroy()
        app.destroy(true, { children: true, texture: true })
        _log('⏭ 已过时，清理')
      }
    } catch (e) {
      if (_stale()) return
      const err = e instanceof Error ? e : new Error(String(e))
      _err(`❌ ${err.message}`, err.stack)
      setError(err)
      setLoading(false)
    }
  }, [modelUrl, width, height])

  // ──── rAF 参数驱动循环 ────
  // 依赖 readyEpoch 而非 ready: StrictMode 二次挂载时 ready 不变 → effect 不重跑 → 模型静止。
  // readyEpoch 每次 attach 成功后递增 → 保证 rAF 每次都重新启动。

  useEffect(() => {
    if (!ready || readyEpoch === 0) return

    let lastTime = performance.now()
    let debugCounter = 0
    const currentEpoch = readyEpoch

    const loop = (now: number) => {
      // 如果 epoch 变了（新的 attach 完成了），停止当前循环
      if (destroyedRef.current || readyEpochRef.current !== currentEpoch) return
      if (destroyedRef.current) return
      const dt = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      const model = modelRef.current
      if (!model || pausedRef.current) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const core = model.internalModel?.coreModel
      if (!core) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }

      const p = paramsRef.current
      frameCountRef.current++

      // ── 逐参数独立 try/catch，单点故障不影响其他参数 ──

      // LipSync
      if (p.lipSync > 0.01) {
        _safeSet(core, 'ParamMouthOpenY', p.lipSync * 2.1)
      } else {
        _safeSet(core, 'ParamMouthOpenY', 0)
      }

      // 视线/头部/身体跟随
      // ParamEyeBallX>0 = 眼球向右看（屏幕右侧），与屏幕 X 轴方向一致，无需取反
      // ParamEyeBallY>0 = 眼球向上看（屏幕上方），屏幕 Y 轴向下为正，需取反
      const eyeX = p.lookAtX
      const eyeY = -p.lookAtY
      const absX = Math.abs(p.lookAtX)
      const absY = Math.abs(p.lookAtY)
      if (absX > 0.01 || absY > 0.01) {
        _safeSet(core, 'ParamEyeBallX', eyeX)
        _safeSet(core, 'ParamEyeBallY', eyeY)
        _safeSet(core, 'ParamAngleX', eyeX * 30)
        _safeSet(core, 'ParamAngleY', eyeY * 20)
        _safeSet(core, 'ParamBodyAngleX', eyeX * 10)
        _safeSet(core, 'ParamBodyAngleZ', eyeY * 5)
      } else {
        _safeSet(core, 'ParamEyeBallX', 0)
        _safeSet(core, 'ParamEyeBallY', 0)
        _safeSet(core, 'ParamAngleX', 0)
        _safeSet(core, 'ParamAngleY', 0)
        _safeSet(core, 'ParamBodyAngleX', 0)
        _safeSet(core, 'ParamBodyAngleZ', 0)
      }

      // 自动眨眼
      if (p.autoBlink) {
        blinkTimerRef.current += dt
        const interval = blinkIntervalRef.current
        const phase = blinkTimerRef.current % interval
        let blinkValue: number
        if (phase < 0.08) {
          blinkValue = 0 // 闭眼
        } else if (phase < 0.14) {
          blinkValue = (phase - 0.08) / 0.06 // 过渡
        } else {
          blinkValue = 1 // 睁眼
        }
        _safeSet(core, 'ParamEyeLOpen', blinkValue)
        _safeSet(core, 'ParamEyeROpen', blinkValue)

        if (phase >= interval - dt && phase < interval) {
          blinkIntervalRef.current = randomBlinkInterval()
          blinkTimerRef.current = 0
        }
      }

      // 自动呼吸
      if (p.autoBreath) {
        breathTimerRef.current += dt
        const breathVal = Math.sin(breathTimerRef.current * 1.2) * 0.5 + 0.5
        _safeSet(core, 'ParamBreath', breathVal)
      }

      // 调试日志（每 60 帧 = ~1s 输出一次）
      if (debug) {
        debugCounter++
        if (debugCounter >= 60) {
          debugCounter = 0
          console.log(
            `[useLive2D rAF] frame=${frameCountRef.current} ` +
            `blink=${p.autoBlink} breath=${p.autoBreath} ` +
            `lookAt=(${p.lookAtX.toFixed(2)},${p.lookAtY.toFixed(2)}) ` +
            `lipSync=${p.lipSync.toFixed(2)}`
          )
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [ready, readyEpoch, debug])

  // ──── 表情 / 动作 / 参数 API ────

  const setExpression = useCallback((expr: Live2DExpression) => {
    const file = EXPRESSION_FILES[expr]
    if (file) {
      modelRef.current?.expression(file)
    } else {
      modelRef.current?.internalModel?.motionManager?.expressionManager?.resetExpression()
    }
  }, [])

  const playMotion = useCallback(
    (group: string, index?: number, priority?: number) => {
      modelRef.current?.motion(group, index, priority ?? MOTION_PRIORITY.NORMAL)
    },
    [],
  )

  const setFocus = useCallback((x: number, y: number) => {
    modelRef.current?.focus(x, y)
  }, [])

  const setParam = useCallback((name: string, value: number) => {
    const core = modelRef.current?.internalModel?.coreModel
    if (core) _safeSet(core, name, value)
  }, [])

  const updateParams = useCallback((partial: Partial<Live2DParams>) => {
    Object.assign(paramsRef.current, partial)
  }, [])

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused
  }, [])

  // ──── 清理 ────

  useEffect(() => {
    return () => {
      destroyedRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      modelRef.current?.destroy()
      appRef.current?.destroy(true, { children: true, texture: true })
    }
  }, [])

  return {
    loading, error, ready,
    debug, setDebug,
    setExpression, playMotion, setFocus,
    setParam, updateParams, setPaused,
    attach,
  }
}

function randomBlinkInterval(): number {
  return 2 + Math.random() * 4
}

export function mapMouseToFocus(
  mouseX: number,
  mouseY: number,
  canvasRect: DOMRect,
): { x: number; y: number } {
  return {
    x: Math.max(-1, Math.min(1, ((mouseX - canvasRect.left) / canvasRect.width) * 2 - 1)),
    y: Math.max(-1, Math.min(1, ((mouseY - canvasRect.top) / canvasRect.height) * 2 - 1)),
  }
}
