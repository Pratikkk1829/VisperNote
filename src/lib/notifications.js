const canUseNotifications = () => typeof window !== 'undefined' && 'Notification' in window

const settingOn = (key, fallback = true) => {
  try { return localStorage.getItem(key) !== 'false' } catch { return fallback }
}

const playPing = () => {
  if (!settingOn('vn_notif_sound', false)) return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(740, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
    setTimeout(() => ctx.close?.(), 280)
  } catch {}
}

export const requestNotificationPermission = async () => {
  if (!canUseNotifications()) return 'unsupported'
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}

export const isMention = (text = '', user = {}) => {
  const candidates = [
    user.username,
    user.display_name,
    user.name,
    user.email?.split('@')[0],
  ].filter(Boolean).map(v => String(v).toLowerCase().replace(/^@/, ''))

  const body = String(text).toLowerCase()
  return candidates.some(name => body.includes(`@${name}`))
}

export const notifyApp = async ({ type = 'message', title, body, tag, user, icon }) => {
  if (type === 'message' && !settingOn('vn_notif_msg', true)) return
  if (type === 'mention' && !settingOn('vn_notif_mention', true)) return

  playPing()
  if (!canUseNotifications()) return

  const permission = await requestNotificationPermission().catch(() => 'denied')
  if (permission !== 'granted') return

  try {
    const notification = new Notification(title || 'VisperNote', {
      body,
      tag,
      icon,
      silent: true,
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch {}
}
