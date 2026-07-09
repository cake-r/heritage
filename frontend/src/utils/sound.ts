/** 按钮点击音效 — Web Audio API 合成，零依赖、零音频文件 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (ctx) return ctx
  try {
    ctx = new AudioContext()
    return ctx
  } catch {
    return null
  }
}

/** 恢复被浏览器挂起的 AudioContext（需在用户手势中调用） */
export function resumeAudioContext(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') {
    c.resume().catch(() => {})
  }
}

/** 播放清脆短击音 — 高频正弦波快速衰减，类似玉石轻碰 */
export function playClick(): void {
  const c = getCtx()
  if (!c) return

  // 确保 context 在 running 状态（浏览器自动挂起策略）
  if (c.state === 'suspended') {
    c.resume().catch(() => {})
  }

  const now = c.currentTime

  // 振荡器 — 双频叠加模拟清脆质感
  const osc1 = c.createOscillator()
  const osc2 = c.createOscillator()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(1200, now)
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(2400, now) // 倍频增加清脆感

  // 增益 — 极短包络
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.12, now)         // 峰值音量
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05) // 50ms 衰减

  osc1.connect(gain)
  osc2.connect(gain)
  gain.connect(c.destination)

  osc1.start(now)
  osc2.start(now)
  osc1.stop(now + 0.05)
  osc2.stop(now + 0.05)
}
