/** Live2D 绝对纯净测试 — 零 useLive2D / 零 Live2DCanvas / 零 zustand store
 *
 * 只用一个 useEffect 直接操作 PIXI + pixi-live2d-display。
 * 如果这里模型能动，说明 bug 在 hook/component/store 层。
 * 如果这里也不动，说明问题在模型文件/runtime 层。
 */

import { useRef, useEffect, useState } from 'react'
import { Card, Button, Space, Tag, Typography, Alert } from 'antd'

const { Text } = Typography

const W = 400
const H = 400
const MODEL_URL = '/live2d/yuezhengling/乐正绫10live2d.model3.json'

export default function Live2DBlank() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('⏳ 等待启动...')
  const [logs, setLogs] = useState<string[]>([])
  const appRef = useRef<any>(null)
  const modelRef = useRef<any>(null)
  const cmRef = useRef<any>(null)
  const rafRef = useRef<number>(0)
  const blinkRef = useRef({ last: 0, interval: 3000 })
  const frameRef = useRef(0)

  const addLog = (msg: string) => setLogs(l => [...l.slice(-99), msg])

  useEffect(() => {
    let cancelled = false

    async function init() {
      addLog('=== 纯净测试启动 ===')

      // 1. Cubism Core
      const core = (window as any).Live2DCubismCore
      if (!core) { setStatus('❌ Cubism Core 未加载'); return }
      addLog('✅ Cubism Core OK')

      // 2. 导入
      const [PIXI, cubism4] = await Promise.all([
        import('pixi.js'),
        import('pixi-live2d-display/cubism4'),
      ])
      // 🔴 关键: pixi-live2d-display 通过 window.PIXI.Ticker.shared 驱动内部 update()
      ;(window as any).PIXI = PIXI
      if (cancelled) return
      const { Live2DModel } = cubism4
      addLog(`✅ PIXI v${PIXI.VERSION}`)

      // 3. WebGL
      const tc = document.createElement('canvas')
      const gl = tc.getContext('webgl2') || tc.getContext('webgl')
      if (!gl) { setStatus('❌ WebGL 不可用'); return }
      addLog(`✅ WebGL ${gl instanceof WebGL2RenderingContext ? '2.0' : '1.0'}`)

      // 4. 验证资源
      for (const url of [
        MODEL_URL,
        MODEL_URL.replace('乐正绫10live2d.model3.json', '乐正绫10live2d.moc3'),
        MODEL_URL.replace('乐正绫10live2d.model3.json', '乐正绫10live2d.4096/texture_00.png'),
      ]) {
        const r = await fetch(url)
        addLog(`${r.ok ? '✅' : '❌'} ${url.split('/').pop()} HTTP ${r.status} (${r.headers.get('content-length') || '?'}B)`)
      }
      if (cancelled) return

      // 5. PIXI App
      const canvas = document.createElement('canvas')
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.display = 'block'
      canvas.style.pointerEvents = 'none'
      containerRef.current?.appendChild(canvas)

      const app = new PIXI.Application({
        view: canvas, width: W, height: H,
        backgroundAlpha: 0, antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })
      appRef.current = app
      addLog('✅ PIXI App 创建完成')

      // 6. 加载模型
      setStatus('⏳ 加载模型...')
      let model
      try {
        model = await Live2DModel.from(MODEL_URL, {
          autoUpdate: true, autoFocus: false, autoHitTest: false,
        })
      } catch (e: any) {
        setStatus(`❌ 模型加载失败: ${e.message}`)
        addLog(`❌ ${e.message}`)
        return
      }
      if (cancelled) { model.destroy(); app.destroy(true); return }

      modelRef.current = model
      const im = model.internalModel
      const cm = im?.coreModel
      cmRef.current = cm
      addLog(`✅ 模型: ${im.width}×${im.height}`)
      addLog(`  core: ${cm ? '✅' : '❌'}  physics: ${im.physics ? '✅' : '❌'}`)
      addLog(`  motions: ${im.settings?.motions ? Object.keys(im.settings.motions).join(',') : '无'}`)

      // 7. 缩放居中
      model.anchor.set(0.5, 0.5)
      model.x = W / 2
      model.y = H * 0.55
      const s = Math.min((W * 0.85) / im.width, (H * 0.9) / im.height)
      model.scale.set(s)
      app.stage.addChild(model)

      // 8. Physics
      try { im.physics?.start(); addLog('✅ Physics 激活'); } catch { addLog('⚠️ Physics 无 .start()'); }

      // 9. Idle 动画
      try {
        const groups = im.settings?.motions ? Object.keys(im.settings.motions) : []
        if (groups.length > 0) {
          model.motion(groups[0], 0, 1)
          addLog(`✅ Idle: "${groups[0]}"`)
        } else {
          addLog('⚠️ 无动作组')
        }
      } catch (e: any) { addLog(`⚠️ Idle 失败: ${e.message}`) }

      // 10. 手动 rAF — 完全独立，不依赖任何 hook state
      setStatus('✅ 运行中')
      addLog('🎉 启动 rAF 循环')

      const loop = (now: number) => {
        frameRef.current++
        const c = cmRef.current
        if (!c) { rafRef.current = requestAnimationFrame(loop); return }

        // 眨眼
        const bl = blinkRef.current
        if (now - bl.last > bl.interval) {
          bl.last = now
          bl.interval = 2000 + Math.random() * 4000
        }
        const elapsed = now - bl.last
        if (elapsed < 80) {
          c.setParameterValueById('ParamEyeLOpen', 0)
          c.setParameterValueById('ParamEyeROpen', 0)
        } else if (elapsed < 140) {
          c.setParameterValueById('ParamEyeLOpen', (elapsed - 80) / 60)
          c.setParameterValueById('ParamEyeROpen', (elapsed - 80) / 60)
        }

        // 呼吸
        if (frameRef.current % 2 === 0) {
          c.setParameterValueById('ParamBreath', Math.sin(now * 0.0012) * 0.5 + 0.5)
        }

        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    init()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      modelRef.current?.destroy()
      appRef.current?.destroy(true, { children: true, texture: true })
    }
  }, [])

  // 手动测试
  const doBlink = () => {
    const cm = cmRef.current
    if (!cm) return
    cm.setParameterValueById('ParamEyeLOpen', 0)
    cm.setParameterValueById('ParamEyeROpen', 0)
    setTimeout(() => {
      cm.setParameterValueById('ParamEyeLOpen', 1)
      cm.setParameterValueById('ParamEyeROpen', 1)
    }, 150)
    addLog('手动眨眼 (如果眼睛闭合说明参数驱动正常)')
  }

  const doLookAt = () => {
    const cm = cmRef.current
    if (!cm) return
    const x = (Math.random() - 0.5) * 2
    const y = (Math.random() - 0.5) * 2
    cm.setParameterValueById('ParamEyeBallX', x)
    cm.setParameterValueById('ParamEyeBallY', y)
    cm.setParameterValueById('ParamAngleX', x * 30)
    cm.setParameterValueById('ParamAngleY', y * 20)
    addLog(`视线 (${x.toFixed(2)}, ${y.toFixed(2)})`)
  }

  const doExpression = (exp: string) => {
    try {
      modelRef.current?.expression(`${exp}.exp3.json`)
      addLog(`表情: ${exp}`)
    } catch { addLog(`表情失败: ${exp}`) }
  }

  return (
    <div style={{ maxWidth: 800, margin: '24px auto', padding: 16 }}>
      <h2>Live2D 纯净测试（零抽象层）</h2>
      <Alert
        message={status}
        type={status.includes('✅') ? 'success' : status.includes('❌') ? 'error' : 'info'}
        style={{ marginBottom: 12 }}
      />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* 模型渲染 */}
        <Card title="渲染区" size="small" style={{ width: 440 }}>
          <div
            ref={containerRef}
            style={{
              width: W, height: H,
              border: '2px dashed #ccc',
              borderRadius: 12,
              background: 'rgba(0,0,0,0.02)',
            }}
          />
          <Space style={{ marginTop: 10 }}>
            <Button size="small" onClick={doBlink}>手动眨眼</Button>
            <Button size="small" onClick={doLookAt}>随机视线</Button>
            <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => doExpression('star')}>星星眼</Tag>
            <Tag color="orange" style={{ cursor: 'pointer' }} onClick={() => doExpression('dizzy')}>晕</Tag>
            <Tag color="red" style={{ cursor: 'pointer' }} onClick={() => doExpression('angry')}>生气</Tag>
            <Tag color="purple" style={{ cursor: 'pointer' }} onClick={() => doExpression('sing')}>唱歌</Tag>
          </Space>
        </Card>

        {/* 日志 */}
        <Card
          title="日志"
          size="small"
          style={{ width: 320, maxHeight: 500, overflow: 'auto' }}
          extra={<Button size="small" onClick={() => setLogs([])}>清空</Button>}
        >
          <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6, maxHeight: 420, overflow: 'auto' }}>
            {logs.length === 0 ? <Text type="secondary">等待...</Text> :
              logs.map((l, i) => (
                <div key={i} style={{
                  color: l.startsWith('❌') ? '#f44336' : l.startsWith('✅') ? '#4caf50' : l.startsWith('⚠️') ? '#ff9800' : '#888'
                }}>
                  {l}
                </div>
              ))
            }
          </div>
        </Card>
      </div>
    </div>
  )
}
