let audioCtx = null
let lastClickAt = 0

const getCtx = () => {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!audioCtx) audioCtx = new AudioCtx()
  if (audioCtx.state === 'suspended') audioCtx.resume?.()
  return audioCtx
}

export const playButtonPress = () => {
  const now = Date.now()
  if (now - lastClickAt < 60) return
  lastClickAt = now

  try {
    const ctx = getCtx()
    if (!ctx) return

    const t = ctx.currentTime
    const gain = ctx.createGain()
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()

    // Very soft, short tick — barely audible
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04)

    filter.type = 'lowpass'
    filter.frequency.value = 1200

    // Very low gain — subtle
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.018, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc.start(t)
    osc.stop(t + 0.06)
  } catch {}
}

export const installButtonSounds = () => {
  if (typeof window === 'undefined') return () => {}
  const handler = (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    // Only fire on actual buttons and elements with pointer cursor
    const el = target.closest('button, [role="button"], [data-click-sound]')
    if (!el || el.hasAttribute?.('disabled') || el.getAttribute?.('aria-disabled') === 'true') return
    playButtonPress()
  }
  window.addEventListener('pointerdown', handler, true)
  return () => window.removeEventListener('pointerdown', handler, true)
}