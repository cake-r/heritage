/** Live2D 调试页面 — 隔离测试模型加载，排除其他组件/CSS 干扰
 *
 * 访问: http://localhost:5173/live2d-test
 *
 * 测试维度:
 * 1. Cubism Core CDN 是否加载成功 (window.Live2DCubismCore)
 * 2. PIXI + pixi-live2d-display 动态导入是否成功
 * 3. model3.json / moc3 / texture 是否能正常 fetch
 * 4. WebGL 上下文创建 + 模型渲染
 * 5. 中文路径 vs URL 编码路径
 * 6. 不同容器尺寸下的表现
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Button, Space, Tag, Typography, Divider, Alert, Input, Switch } from 'antd'
import {
  CheckCircle, XCircle, Loader2,
  Play, FileText,
} from 'lucide-react'
import Live2DCanvas from '../components/companion/Live2DCanvas'
import type { Live2DCanvasHandle } from '../components/companion/Live2DCanvas'

const { Title, Text, Paragraph } = Typography

// ── 两种路径方案 ──
const MODEL_PATH_RAW = '/live2d/yuezhengling/乐正绫10live2d.model3.json'
const MODEL_PATH_ENCODED = '/live2d/yuezhengling/%E4%B9%90%E6%AD%A3%E7%BB%AB10live2d.model3.json'

type StepStatus = 'idle' | 'running' | 'ok' | 'fail'

interface DiagnosticStep {
  key: string
  label: string
  status: StepStatus
  detail: string
}

export default function Live2DTest() {
  // ── 诊断步骤 ──
  const [steps, setSteps] = useState<DiagnosticStep[]>([
    { key: 'cdn', label: 'Cubism Core CDN 全局变量', status: 'idle', detail: '' },
    { key: 'pixi', label: 'PIXI + live2d-display 动态导入', status: 'idle', detail: '' },
    { key: 'model_json', label: 'model3.json 抓取', status: 'idle', detail: '' },
    { key: 'moc3', label: 'moc3 文件抓取', status: 'idle', detail: '' },
    { key: 'texture', label: '贴图 PNG 抓取', status: 'idle', detail: '' },
    { key: 'physics', label: '物理文件抓取', status: 'idle', detail: '' },
    { key: 'webgl', label: 'WebGL 上下文', status: 'idle', detail: '' },
    { key: 'model_load', label: '模型加载 + 渲染', status: 'idle', detail: '' },
  ])

  const updateStep = useCallback((key: string, status: StepStatus, detail: string) => {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, status, detail } : s))
  }, [])

  // ── 参数配置 ──
  const [modelPath, setModelPath] = useState(MODEL_PATH_RAW)
  const [useEncodedPath, setUseEncodedPath] = useState(false)
  const [canvasSize, setCanvasSize] = useState(300)
  const [showDebugCanvas, setShowDebugCanvas] = useState(false)
  const live2dRef = useRef<Live2DCanvasHandle>(null)
  const [logLines, setLogLines] = useState<string[]>([])

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString()
    setLogLines(prev => [...prev.slice(-99), `[${ts}] ${msg}`])
    console.log(`[Live2DTest] ${msg}`)
  }, [])

  // ── 诊断流程 ──
  const runDiagnostics = useCallback(async () => {
    // 重置
    setSteps(prev => prev.map(s => ({ ...s, status: 'idle' as StepStatus, detail: '' })))
    setLogLines([])
    addLog('开始诊断...')

    // Step 1: CDN
    updateStep('cdn', 'running', '检查 window.Live2DCubismCore...')
    await new Promise(r => setTimeout(r, 200))
    const core = (window as any).Live2DCubismCore
    if (core) {
      const version = core.Version || 'unknown'
      updateStep('cdn', 'ok', `Cubism Core v${version} (CDN 加载成功)`)
      addLog(`✅ Cubism Core 版本: ${version}`)
    } else {
      updateStep('cdn', 'fail', 'window.Live2DCubismCore 不存在!')
      addLog('❌ Cubism Core 未加载! 检查 CDN script 标签')
      return
    }

    // Step 2: 动态导入
    updateStep('pixi', 'running', 'import pixi.js + pixi-live2d-display...')
    try {
      const PIXI = await import('pixi.js')
      // 🔴 关键: pixi-live2d-display 需要 window.PIXI 来获取 Ticker.shared
      ;(window as any).PIXI = PIXI
      addLog(`✅ PIXI v${PIXI.VERSION} 导入成功`)
      // 注意: 必须使用 cubism4 子模块，主入口 index.es.js 会检查 Cubism 2
      const l2d = await import('pixi-live2d-display/cubism4')
      addLog(`✅ pixi-live2d-display/cubism4 导入成功 (Live2DModel: ${typeof l2d.Live2DModel})`)
      updateStep('pixi', 'ok', `PIXI ${PIXI.VERSION} + pixi-live2d-display/cubism4`)
    } catch (e: any) {
      updateStep('pixi', 'fail', `导入失败: ${e.message}`)
      addLog(`❌ 导入失败: ${e.message}`)
      return
    }

    // Step 3-6: 文件抓取
    const resolvedPath = useEncodedPath ? MODEL_PATH_ENCODED : MODEL_PATH_RAW
    addLog(`使用模型路径: ${resolvedPath}`)

    // step 3: model3.json
    updateStep('model_json', 'running', `抓取 ${resolvedPath}...`)
    try {
      const resp = await fetch(resolvedPath)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      updateStep('model_json', 'ok', `Version=${json.Version}, FileReferences: ${Object.keys(json.FileReferences).join(',')}`)
      addLog(`✅ model3.json Version=${json.Version}, Groups: ${json.Groups?.length || 0}`)
    } catch (e: any) {
      updateStep('model_json', 'fail', e.message)
      addLog(`❌ model3.json 抓取失败: ${e.message}`)
      return
    }

    // step 4: moc3
    const base = resolvedPath.substring(0, resolvedPath.lastIndexOf('/') + 1)
    const mocUrl = base + encodeURIComponent('乐正绫10live2d.moc3')
    updateStep('moc3', 'running', `抓取 ${mocUrl}...`)
    try {
      const resp = await fetch(mocUrl)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const size = (await resp.blob()).size
      updateStep('moc3', 'ok', `${(size / 1024).toFixed(0)} KB`)
      addLog(`✅ moc3: ${(size / 1024).toFixed(0)} KB`)
    } catch (e: any) {
      updateStep('moc3', 'fail', e.message)
      addLog(`❌ moc3 抓取失败: ${e.message}`)
      return
    }

    // step 5: texture
    const texUrl = base + encodeURIComponent('乐正绫10live2d.4096') + '/texture_00.png'
    updateStep('texture', 'running', `抓取 ${texUrl}...`)
    try {
      const resp = await fetch(texUrl)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const size = (await resp.blob()).size
      updateStep('texture', 'ok', `${(size / 1024).toFixed(0)} KB`)
      addLog(`✅ texture: ${(size / 1024).toFixed(0)} KB`)
    } catch (e: any) {
      updateStep('texture', 'fail', e.message)
      addLog(`❌ texture 抓取失败: ${e.message}`)
      return
    }

    // step 6: physics
    const physUrl = base + encodeURIComponent('乐正绫10live2d.physics3.json')
    updateStep('physics', 'running', `抓取 ${physUrl}...`)
    try {
      const resp = await fetch(physUrl)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const json = await resp.json()
      updateStep('physics', 'ok', `v${json.Version}`)
      addLog(`✅ physics3.json OK`)
    } catch (e: any) {
      updateStep('physics', 'fail', e.message)
      addLog(`⚠️ physics 抓取失败: ${e.message} (非致命)`)
    }

    // step 7: WebGL
    updateStep('webgl', 'running', '创建 WebGL 测试上下文...')
    const testCanvas = document.createElement('canvas')
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')
    if (gl) {
      updateStep('webgl', 'ok', `${gl instanceof WebGL2RenderingContext ? 'WebGL 2.0' : 'WebGL 1.0'}`)
      addLog(`✅ WebGL: ${gl instanceof WebGL2RenderingContext ? '2.0' : '1.0'}`)
    } else {
      updateStep('webgl', 'fail', '浏览器不支持 WebGL')
      addLog('❌ WebGL 不可用!')
      return
    }

    // Step 8: 实际模型加载 — 通过渲染组件来测试
    updateStep('model_load', 'running', '启动 Live2DCanvas 组件...')
    addLog('🔄 开始加载模型到 Canvas...')
    setShowDebugCanvas(true)
  }, [updateStep, addLog, useEncodedPath])

  // ── 模型加载成功/失败回调 ──
  const handleModelLoaded = useCallback(() => {
    updateStep('model_load', 'ok', '模型渲染成功! 🎉')
    addLog('✅ 模型加载 + 渲染成功!')
  }, [updateStep, addLog])

  const handleModelError = useCallback((err: Error) => {
    updateStep('model_load', 'fail', err.message)
    addLog(`❌ 模型加载失败: ${err.message}`)
  }, [updateStep, addLog])

  // ── 切换表情测试 ──
  const [testExpr, setTestExpr] = useState('idle')
  const testExpressions = ['idle', 'star', 'sing', 'angry', 'dizzy']

  const expColors: Record<string, string> = {
    idle: 'default', star: 'gold', sing: 'blue', angry: 'red', dizzy: 'orange',
  }

  // ── UI ──
  return (
    <div style={{
      maxWidth: 900,
      margin: '0 auto',
      padding: 24,
      fontFamily: 'var(--font-sans)',
    }}>
      <Title level={3} style={{ marginBottom: 4 }}>Live2D 诊断工具</Title>
      <Text type="secondary" style={{ fontSize: 'var(--text-sm)' }}>
        隔离测试 Live2D 模型加载链路，排除页面其他组件/CSS 干扰
      </Text>

      <Divider style={{ margin: '16px 0' }} />

      {/* ── 控制面板 ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20, alignItems: 'center' }}>
        <Button
          type="primary"
          icon={<Play />}
          onClick={runDiagnostics}
          size="large"
          style={{ background: 'var(--color-vermilion, #B8463A)' }}
        >
          运行完整诊断
        </Button>

        <Space>
          <Text style={{ fontSize: 'var(--text-xs)' }}>URL 编码路径:</Text>
          <Switch
            checked={useEncodedPath}
            onChange={setUseEncodedPath}
            size="small"
          />
        </Space>

        <Space>
          <Text style={{ fontSize: 'var(--text-xs)' }}>Canvas 尺寸:</Text>
          <Input
            type="number"
            min={72}
            max={600}
            value={canvasSize}
            onChange={e => setCanvasSize(Number(e.target.value))}
            style={{ width: 80 }}
            size="small"
          />
        </Space>
      </div>

      {/* ── 模型路径展示 ── */}
      <Alert
        message="当前模型路径"
        description={
          <code style={{ fontSize: 12, wordBreak: 'break-all' }}>
            {useEncodedPath ? MODEL_PATH_ENCODED : MODEL_PATH_RAW}
          </code>
        }
        type="info"
        style={{ marginBottom: 16 }}
      />

      {/* ── 诊断步骤 ── */}
      <Card
        title="诊断步骤"
        size="small"
        style={{ marginBottom: 16 }}
      >
        {steps.map(step => (
          <div
            key={step.key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '6px 0',
              borderBottom: '1px solid var(--color-paper, #F7F4ED)',
              gap: 10,
              fontSize: 'var(--text-sm)',
            }}
          >
            <span style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
              {step.status === 'running' && <Loader2 style={{ color: 'var(--color-gold, #C4A265)' }} />}
              {step.status === 'ok' && <CheckCircle style={{ color: 'var(--color-success, #4A8C5C)' }} />}
              {step.status === 'fail' && <XCircle style={{ color: 'var(--color-vermilion, #B8463A)' }} />}
              {step.status === 'idle' && <span style={{ color: 'var(--gray-300, #ccc)' }}>—</span>}
            </span>
            <strong style={{ minWidth: 180, flexShrink: 0 }}>{step.label}</strong>
            <Text
              type={step.status === 'fail' ? 'danger' : 'secondary'}
              style={{ fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}
            >
              {step.detail || (step.status === 'idle' ? '等待检测...' : '')}
            </Text>
          </div>
        ))}
      </Card>

      {/* ── 模型预览区 ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Card
          title={`Live2D 渲染 (${canvasSize}×${canvasSize})`}
          size="small"
          style={{ flex: 1, minWidth: canvasSize + 80 }}
        >
          {showDebugCanvas ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}>
              <div style={{
                border: '2px dashed var(--gray-300, #ccc)',
                borderRadius: 'var(--radius-lg, 12px)',
                background: 'var(--color-paper, #F7F4ED)',
                display: 'inline-block',
                lineHeight: 0,
              }}>
                <Live2DCanvas
                  ref={live2dRef}
                  modelUrl={useEncodedPath ? MODEL_PATH_ENCODED : MODEL_PATH_RAW}
                  width={canvasSize}
                  height={canvasSize}
                  expression={testExpr as any}
                  noClip
                  onLoad={handleModelLoaded}
                  onError={handleModelError}
                />
              </div>

              {/* 表情切换测试 */}
              <Space size={4}>
                <Text style={{ fontSize: 'var(--text-xs)', marginRight: 4 }}>表情:</Text>
                {testExpressions.map(expr => (
                  <Tag
                    key={expr}
                    color={expColors[expr] || 'default'}
                    style={{
                      cursor: 'pointer',
                      opacity: testExpr === expr ? 1 : 0.5,
                      fontWeight: testExpr === expr ? 600 : 400,
                    }}
                    onClick={() => setTestExpr(expr)}
                  >
                    {expr}
                  </Tag>
                ))}
              </Space>
            </div>
          ) : (
            <div style={{
              width: canvasSize,
              height: canvasSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed var(--gray-300, #ccc)',
              borderRadius: 'var(--radius-lg, 12px)',
              background: 'var(--color-paper, #F7F4ED)',
              color: 'var(--color-ink-secondary, #8B8178)',
              fontSize: 'var(--text-sm)',
            }}>
              点击"运行完整诊断"加载模型
            </div>
          )}
        </Card>

        {/* ── 日志面板 ── */}
        <Card
          title="控制台日志"
          size="small"
          style={{ width: 340, maxHeight: 500, overflow: 'auto' }}
          extra={
            <Button size="small" onClick={() => setLogLines([])}>清空</Button>
          }
        >
          <div style={{
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1.6,
            maxHeight: 420,
            overflow: 'auto',
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: 10,
            borderRadius: 6,
          }}>
            {logLines.length === 0 ? (
              <span style={{ color: '#888' }}>等待诊断...</span>
            ) : (
              logLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: line.includes('❌') ? '#f48771'
                      : line.includes('✅') ? '#89d185'
                      : line.includes('⚠️') ? '#e5c07b'
                      : line.includes('🔄') ? '#61afef'
                      : '#abb2bf',
                  }}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Divider style={{ margin: '16px 0' }} />

      {/* ── 提示 ── */}
      <Alert
        message="排查提示"
        description={
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-xs)' }}>
            <li>打开浏览器 DevTools → <strong>Console</strong> 查看详细错误堆栈</li>
            <li>打开 <strong>Network</strong> 标签页查看 model3.json / moc3 / texture PNG 是否有 404</li>
            <li>切换 <strong>URL 编码路径</strong> 对比中文路径是否导致解析问题</li>
            <li>调整 <strong>Canvas 尺寸</strong> 测试容器大小是否影响渲染</li>
            <li>如果 WebGL 不可用，检查 <code>chrome://gpu</code> 确认硬件加速启用</li>
          </ul>
        }
        type="warning"
        style={{ marginBottom: 16 }}
      />

      <Text type="secondary" style={{ fontSize: 'var(--text-xs)' }}>
        此页面仅用于开发调试，生产环境需移除。
      </Text>
    </div>
  )
}
