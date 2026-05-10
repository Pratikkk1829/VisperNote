import { useState, useEffect, useRef } from 'react'
import Titlebar from '../components/Titlebar'
import { colors, cv, s, THEMES, applyTheme } from '../styles/theme'
import { supabase } from '../lib/supabase'

const SECTIONS = [
  { id: 'profile',       icon: '👤', label: 'Profile' },
  { id: 'appearance',    icon: '🎨', label: 'Appearance' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'privacy',       icon: '🔒', label: 'Privacy' },
]

const FONTS = ['DM Sans', 'Inter', 'Georgia', 'Lora', 'Courier New']

function Toggle({ val, onChange }) {
  return (
    <div onClick={() => onChange(!val)} style={{ width: 38, height: 22, borderRadius: 11, cursor: 'pointer', position: 'relative', background: val ? cv.accent : cv.elevated, border: `1px solid ${val ? cv.accent : cv.border}`, transition: 'all 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s', transform: val ? 'translateX(16px)' : 'translateX(0)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
    </div>
  )
}

function ToggleRow({ label, desc, val, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${cv.border}` }}>
      <div><div style={{ fontSize: 13, fontWeight: 500, color: cv.text, marginBottom: 3 }}>{label}</div><div style={{ fontSize: 11, color: cv.textDim }}>{desc}</div></div>
      <Toggle val={val} onChange={onChange} />
    </div>
  )
}

export default function SettingsPage({ onBack, user, onUpdateUser }) {
  const [sec, setSec]           = useState('profile')
  const [saving, setSaving]     = useState(false)
  const [confirmModal, setConfirmModal] = useState(null) // 'logout' | 'delete' | null
  const [saveMsg, setSaveMsg]   = useState('')
  const [displayName, setDisplayName] = useState(user?.display_name || user?.name || '')
  const [username, setUsername]       = useState(user?.username || '')
  const [bio, setBio]                 = useState(user?.bio || '')
  const [avatarUrl, setAvatarUrl]     = useState(user?.avatar_url || user?.avatar || '')
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [cropModal, setCropModal]         = useState(null) // { src, crop:{x,y,scale} } or null
  const [crop, setCrop]                   = useState({ x: 0, y: 0, scale: 1 })
  const cropImgRef                        = useRef(null)
  const fileRef = useRef(null)
  const [activeTheme, setActiveTheme] = useState(() => { try { return localStorage.getItem('vn_theme') || 'default' } catch { return 'default' } })
  const [font, setFont]       = useState(() => { try { return localStorage.getItem('vn_font') || 'DM Sans' } catch { return 'DM Sans' } })
  const [fontSize, setFontSz] = useState(() => { try { return Number(localStorage.getItem('vn_fontSize') || 13) } catch { return 13 } })
  const [chatColor, setChatColor] = useState(() => { try { return localStorage.getItem('vn_chat_color') || '#c97b5a' } catch { return '#c97b5a' } })
  const [notifMsg, setNotifMsg]     = useState(() => localStorage.getItem('vn_notif_msg') !== 'false')
  const [notifMention, setNotifMen] = useState(() => localStorage.getItem('vn_notif_mention') !== 'false')
  const [notifSound, setNotifSnd]   = useState(() => localStorage.getItem('vn_notif_sound') === 'true')
  const [showOnline, setShowOnline]     = useState(user?.show_online ?? true)
  const [showStreak, setShowStreak]     = useState(user?.show_streak ?? true)
  const [readReceipts, setReadReceipts] = useState(user?.read_receipts ?? true)

  useEffect(() => {
    setDisplayName(user?.display_name || user?.name || '')
    setUsername(user?.username || '')
    setBio(user?.bio || '')
    setAvatarUrl(user?.avatar_url || user?.avatar || '')
    setShowOnline(user?.show_online ?? true)
    setShowStreak(user?.show_streak ?? true)
    setReadReceipts(user?.read_receipts ?? true)
  }, [user?.id])

  const flash = (msg) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 2500) }

  const saveProfile = async () => {
    setSaving(true)
    try {
      let finalAvatar = avatarUrl

      // Convert uploaded file to base64 data URL — no storage bucket needed
      if (avatarPreview && fileRef.current?.files?.[0]) {
        const file = fileRef.current.files[0]
        finalAvatar = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target.result)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      }

      const updates = {
        username: username.trim(),
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: finalAvatar || null,
      }
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (error) {
        // Fallback: try minimal update if schema is limited
        const { error: e2 } = await supabase.from('profiles').update({ username: username.trim(), avatar_url: finalAvatar || null }).eq('id', user.id)
        if (e2) throw e2
      }
      onUpdateUser?.({ ...user, ...updates, name: displayName.trim() || username.trim(), avatar: finalAvatar, avatar_url: finalAvatar })
      setAvatarUrl(finalAvatar || ''); setAvatarPreview(null)
      flash('Profile saved!')
    } catch (e) { console.error('Save error:', e); flash('Error — try again') }
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  const handleDeleteAccount = async () => {
    await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    window.location.reload()
  }

  const removeAvatar = async () => {
    setAvatarPreview(null); setAvatarUrl('')
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    onUpdateUser?.({ ...user, avatar_url: null, avatar: null })
    flash('Avatar removed')
  }

  const handleTheme = (id) => { setActiveTheme(id); applyTheme(id) }

  const handleFont = (f) => { setFont(f); localStorage.setItem('vn_font', f); document.documentElement.style.setProperty('--vn-font', f) }

  const handleFontSize = (sz) => { setFontSz(sz); localStorage.setItem('vn_fontSize', sz); document.documentElement.style.setProperty('--vn-font-size', sz + 'px') }

  const savePrivacy = async () => {
    const updates = { show_online: showOnline, show_streak: showStreak, read_receipts: readReceipts }
    await supabase.from('profiles').update(updates).eq('id', user.id)
    onUpdateUser?.({ ...user, ...updates }); flash('Privacy saved!')
  }

  const initials = (s) => (s || '?')[0].toUpperCase()
  const inp = { background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: colors.text, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', userSelect: 'text' }

  return (
    <>
    <div style={{ ...s.root, background: colors.bg, color: colors.text }}>
      <Titlebar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div style={{ width: 210, background: colors.surface, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', padding: '12px 0', flexShrink: 0 }}>
          <div style={{ padding: '8px 16px', fontSize: 13, color: colors.accent, fontWeight: 500, cursor: 'pointer', marginBottom: 8 }} onClick={onBack}>← Back</div>
          <div style={{ padding: '6px 16px 4px', fontSize: 10, letterSpacing: '0.1em', color: colors.textDim, fontWeight: 600 }}>SETTINGS</div>
          {SECTIONS.map(s => (
            <div key={s.id} onClick={() => setSec(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', fontSize: 13, color: sec === s.id ? colors.accent : colors.textMid, borderRadius: 8, margin: '0 6px', background: sec === s.id ? colors.accentDim : 'transparent', transition: 'all 0.15s' }}>
              <span style={{ fontSize: 15 }}>{s.icon}</span>{s.label}
            </div>
          ))}
          {saveMsg && <div style={{ margin: '16px 10px 0', padding: '8px 12px', background: colors.accentDim, border: `1px solid ${colors.accentBorder}`, borderRadius: 8, fontSize: 11, color: colors.accent, textAlign: 'center' }}>{saveMsg}</div>}
        </div>

        {/* Main */}
        <div style={{ flex: 1, overflowY: 'auto', background: colors.bg, padding: '0 0 60px' }}>
          <div style={{ maxWidth: 560, padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Profile ── */}
            {sec === 'profile' && (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: colors.text, paddingBottom: 12, borderBottom: `1px solid ${colors.border}` }}>Profile</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: colors.textDim }}>AVATAR</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 700, flexShrink: 0, overflow: 'hidden', border: `2px solid ${colors.accentBorder}` }}>
                    {avatarPreview ? <img src={avatarPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : avatarUrl ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : initials(displayName || username)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button style={{ padding: '7px 16px', borderRadius: 8, background: colors.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>Choose pfp</button>
                    <button style={{ padding: '7px 16px', borderRadius: 8, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textMid, fontSize: 13, cursor: 'pointer' }} onClick={removeAvatar}>Remove avatar</button>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return
                      const r = new FileReader()
                      r.onload = ev => { setCrop({ x: 0, y: 0, scale: 1 }); setCropModal({ src: ev.target.result }) }
                      r.readAsDataURL(f)
                      e.target.value = ''
                    }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: colors.textDim }}>DISPLAY NAME</div>
                <input style={inp} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" />
                <div style={{ fontSize: 11, color: colors.textDim }}>This is how others see you in shared diaries</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: colors.textDim }}>USERNAME</div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.textDim, fontSize: 13, pointerEvents: 'none' }}>@</span>
                  <input style={{ ...inp, paddingLeft: 26 }} value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9._]/g, ''))} placeholder="username" />
                </div>
                <div style={{ fontSize: 11, color: colors.textDim }}>Unique — used for invites and mentions</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: colors.textDim }}>BIO</div>
                <textarea style={{ ...inp, height: 88, resize: 'none', lineHeight: 1.5 }} value={bio} onChange={e => setBio(e.target.value)} placeholder="A little something about you..." maxLength={160} />
                <div style={{ fontSize: 11, color: colors.textDim }}>{bio.length}/160 characters</div>
              </div>
              <button disabled={saving} style={{ padding: '9px 20px', borderRadius: 9, background: colors.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-start' }} onClick={saveProfile}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </>)}

            {/* ── Appearance ── */}
            {sec === 'appearance' && (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: colors.text, paddingBottom: 12, borderBottom: `1px solid ${colors.border}` }}>Appearance</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: colors.textDim }}>THEME</div>
                {THEMES.map(t => (
                  <div key={t.id} onClick={() => handleTheme(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, cursor: 'pointer', border: activeTheme === t.id ? `1.5px solid ${colors.accent}` : `1.5px solid ${colors.border}`, background: activeTheme === t.id ? colors.accentDim : colors.elevated, transition: 'all 0.15s' }}>
                    <span style={{ fontSize: 22 }}>{t.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: activeTheme === t.id ? colors.accent : colors.text }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: colors.textDim }}>{t.desc}</div>
                    </div>
                    {activeTheme === t.id && <span style={{ fontSize: 14, color: colors.accent }}>✓</span>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: colors.textDim }}>FONT</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FONTS.map(f => (
                    <div key={f} onClick={() => handleFont(f)} style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: f, border: font === f ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`, background: font === f ? colors.accentDim : colors.elevated, color: font === f ? colors.accent : colors.textMid, transition: 'all 0.15s' }}>{f}</div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: colors.textDim }}>FONT SIZE — {fontSize}px</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: colors.textDim }}>A</span>
                  <input type="range" min={11} max={18} value={fontSize} onChange={e => handleFontSize(Number(e.target.value))} style={{ flex: 1, accentColor: colors.accent }} />
                  <span style={{ fontSize: 18, color: colors.textDim }}>A</span>
                </div>
                <div style={{ fontSize, fontFamily: font, color: colors.textMid, padding: '10px 14px', background: colors.elevated, borderRadius: 8 }}>
                  The quick brown fox jumps over the lazy dog.
                </div>

                {/* Chat bubble color */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, color: colors.textDim, marginBottom: 10 }}>CHAT BUBBLE COLOR</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {['#c97b5a','#7a8ec9','#7ab89a','#b97ab8','#e05555','#c9a87a','#39FF14','#00FFC6','#ffffff','#E0AFA0'].map(color => (
                      <div key={color} onClick={() => { setChatColor(color); localStorage.setItem('vn_chat_color', color) }}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: color, cursor: 'pointer', border: chatColor === color ? '3px solid #fff' : '2px solid rgba(255,255,255,0.15)', transition: 'transform 0.15s', transform: chatColor === color ? 'scale(1.2)' : 'scale(1)' }} />
                    ))}
                    <input type="color" value={chatColor} onChange={e => { setChatColor(e.target.value); localStorage.setItem('vn_chat_color', e.target.value) }}
                      style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'transparent', padding: 0 }} title="Custom color" />
                  </div>
                  {/* Preview */}
                  <div style={{ marginTop: 10, display: 'inline-flex', background: colors.accentDim, borderRadius: '10px 10px 2px 10px', padding: '6px 12px', fontSize: 12, color: chatColor, border: `1px solid rgba(255,255,255,0.1)` }}>
                    Hey this is how your messages look! 👋
                  </div>
                </div>
              </div>
            </>)}

            {/* ── Notifications ── */}
            {sec === 'notifications' && (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: colors.text, paddingBottom: 12, borderBottom: `1px solid ${colors.border}` }}>Notifications</div>
              <div style={{ fontSize: 11, color: colors.textDim }}>Changes are saved automatically.</div>
              <ToggleRow label="New messages" desc="When someone sends a message in a shared diary" val={notifMsg} onChange={v => { setNotifMsg(v); localStorage.setItem('vn_notif_msg', v) }} />
              <ToggleRow label="Mentions" desc="When someone @mentions you in a diary or chat" val={notifMention} onChange={v => { setNotifMen(v); localStorage.setItem('vn_notif_mention', v) }} />
              <ToggleRow label="Notification sounds" desc="Play a sound when you receive a notification" val={notifSound} onChange={v => { setNotifSnd(v); localStorage.setItem('vn_notif_sound', v) }} />
            </>)}

            {/* ── Privacy ── */}
            {sec === 'privacy' && (<>
              <div style={{ fontSize: 20, fontWeight: 600, color: colors.text, paddingBottom: 12, borderBottom: `1px solid ${colors.border}` }}>Privacy</div>
              <ToggleRow label="Show online status" desc="Let others see when you're active" val={showOnline} onChange={setShowOnline} />
              <ToggleRow label="Show streak count" desc="Display your writing streak on your profile" val={showStreak} onChange={setShowStreak} />
              <ToggleRow label="Read receipts" desc="Let others know when you've read their messages" val={readReceipts} onChange={setReadReceipts} />
              <button style={{ padding: '9px 20px', borderRadius: 9, background: colors.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }} onClick={savePrivacy}>Save privacy settings</button>
              <div style={{ marginTop: 16, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e05555', marginBottom: 12 }}>Danger Zone</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textMid, fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start' }}
                    onClick={() => setConfirmModal('logout')}>
                    Log out
                  </button>
                  <button style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: '1px solid #e05555', color: '#e05555', fontSize: 13, cursor: 'pointer', alignSelf: 'flex-start' }}
                    onClick={() => setConfirmModal('delete')}>
                    Delete account
                  </button>
                </div>
              </div>
            </>)}

          </div>
        </div>
      </div>
    </div>

    {/* Confirm modal */}
    {confirmModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        onClick={() => setConfirmModal(null)}>
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '28px 32px', width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 17, fontWeight: 600, color: confirmModal === 'delete' ? '#e05555' : colors.text }}>
            {confirmModal === 'logout' ? '👋 Log out?' : '🗑️ Delete account?'}
          </div>
          <div style={{ fontSize: 13, color: colors.textDim, lineHeight: 1.5 }}>
            {confirmModal === 'logout'
              ? 'You will be signed out of VisperNote. You can log back in anytime.'
              : 'This will permanently delete your account and all your data. This cannot be undone.'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textMid, fontSize: 13, cursor: 'pointer' }}
              onClick={() => setConfirmModal(null)}>Cancel</button>
            <button style={{ padding: '8px 18px', borderRadius: 8, background: confirmModal === 'delete' ? '#e05555' : colors.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => { setConfirmModal(null); confirmModal === 'logout' ? handleLogout() : handleDeleteAccount() }}>
              {confirmModal === 'logout' ? 'Log out' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Crop / Resize Avatar Modal ── */}
    {cropModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
        onClick={() => setCropModal(null)}>
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 20, padding: '28px 28px 24px', width: 380, display: 'flex', flexDirection: 'column', gap: 20 }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>Choose pfp</div>

          {/* Preview circle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${colors.accentBorder}`, flexShrink: 0, background: colors.elevated }}>
              <img ref={cropImgRef} src={cropModal.src} alt=""
                style={{ width: `${100 * crop.scale}%`, height: `${100 * crop.scale}%`, objectFit: 'cover', marginLeft: `${crop.x}%`, marginTop: `${crop.y}%`, display: 'block' }} />
            </div>
            <div style={{ fontSize: 11, color: colors.textDim, lineHeight: 1.6 }}>
              Drag the sliders to reposition and resize your profile picture.
            </div>
          </div>

          {/* Scale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: colors.textDim, fontWeight: 600, letterSpacing: '0.08em' }}>ZOOM — {Math.round(crop.scale * 100)}%</div>
            <input type="range" min={100} max={300} value={Math.round(crop.scale * 100)}
              onChange={e => setCrop(c => ({ ...c, scale: Number(e.target.value) / 100 }))}
              style={{ accentColor: colors.accent, width: '100%' }} />
          </div>

          {/* X offset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: colors.textDim, fontWeight: 600, letterSpacing: '0.08em' }}>HORIZONTAL</div>
            <input type="range" min={-100} max={0} value={crop.x}
              onChange={e => setCrop(c => ({ ...c, x: Number(e.target.value) }))}
              style={{ accentColor: colors.accent, width: '100%' }} />
          </div>

          {/* Y offset */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: colors.textDim, fontWeight: 600, letterSpacing: '0.08em' }}>VERTICAL</div>
            <input type="range" min={-100} max={0} value={crop.y}
              onChange={e => setCrop(c => ({ ...c, y: Number(e.target.value) }))}
              style={{ accentColor: colors.accent, width: '100%' }} />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: `1px solid ${colors.border}`, color: colors.textMid, fontSize: 13, cursor: 'pointer' }}
              onClick={() => setCropModal(null)}>Cancel</button>
            <button style={{ padding: '8px 20px', borderRadius: 8, background: colors.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              onClick={() => {
                // Render cropped image to canvas → data URL
                const img = new Image()
                img.onload = () => {
                  const SIZE = 256
                  const canvas = document.createElement('canvas')
                  canvas.width = SIZE; canvas.height = SIZE
                  const ctx = canvas.getContext('2d')
                  ctx.beginPath(); ctx.arc(SIZE/2, SIZE/2, SIZE/2, 0, Math.PI*2); ctx.clip()
                  const scale = crop.scale
                  const sw = img.naturalWidth / scale
                  const sh = img.naturalHeight / scale
                  const sx = (-crop.x / 100) * img.naturalWidth / scale
                  const sy = (-crop.y / 100) * img.naturalHeight / scale
                  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE)
                  setAvatarPreview(canvas.toDataURL('image/png'))
                  setCropModal(null)
                }
                img.src = cropModal.src
              }}>Confirm</button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}