import { useState } from 'react'
import { colors, cv } from '../styles/theme'

const ICONS = ['📔', '✉️', '📜', '🗂️', '🌸', '🌊', '🔥', '🌿', '🌙', '✨', '🎭', '🎨']
const GROUP_COLORS = ['#c97b5a', '#7a8ec9', '#7ab89a', '#b97ab8', '#c9a87a', '#7ac9c9']
const LAYOUTS = [
  { id: 'diary', icon: '📔', label: 'Diary', desc: 'Entries, dates, moods, and shared memories' },
  { id: 'letter', icon: '✉️', label: 'Letter', desc: 'A softer format for notes and long messages' },
  { id: 'script', icon: '📜', label: 'Script', desc: 'Scenes, dialogue, and story sessions' },
  { id: 'project', icon: '🗂️', label: 'Project', desc: 'Task-like writing with a tidy board feel' },
]

const friendName = (friend) => friend?.display_name || friend?.name || friend?.username || 'Unknown friend'
const friendHandle = (friend) => friend?.username ? `@${friend.username}` : ''
const friendAvatar = (friend) => friend?.avatar_url || friend?.avatar || friend?.photo_url || ''

export default function GroupCreate({ friends = [], onClose, onCreate }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📔')
  const [color, setColor] = useState('#c97b5a')
  const [layout, setLayout] = useState('diary')
  const [selectedFriends, setSelectedFriends] = useState([])

  const canCreate = name.trim().length > 0
  const currentLayout = LAYOUTS.find(item => item.id === layout) || LAYOUTS[0]

  const toggleFriend = (id) => {
    setSelectedFriends(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleCreate = () => {
    if (!canCreate) return

    onCreate({
      name: name.trim(),
      icon,
      color,
      layout,
      inviteIds: selectedFriends
    })

    onClose()
  }

  return (
    <div style={ss.overlay} onClick={onClose}>
      <div style={ss.modal} onClick={e => e.stopPropagation()}>
        <div style={ss.header}>
          <div style={ss.headerPreview}>
            <div style={{ ...ss.previewIcon, background: color + '24', borderColor: color }}>{icon}</div>
            <div style={ss.headerCopy}>
              <h2 style={ss.title}>Create New Diary</h2>
              <div style={ss.subtitle}>{currentLayout.label} space</div>
            </div>
          </div>
          <button style={ss.close} onClick={onClose}>×</button>
        </div>

        <div style={ss.body}>
          <input
            style={ss.input}
            placeholder="Diary name (e.g. Summer Vacation 2026)"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />

          {/* Icon Picker */}
          <div style={ss.section}>
            <label style={ss.label}>Icon</label>
            <div style={ss.iconGrid}>
              {ICONS.map(i => (
                <button key={i} style={{ ...ss.iconBtn, background: icon === i ? color + '33' : cv.elevated, borderColor: icon === i ? color : cv.border, boxShadow: icon === i ? `0 0 0 1px ${color}55 inset` : 'none' }} onClick={() => setIcon(i)}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div style={ss.section}>
            <label style={ss.label}>Accent Color</label>
            <div style={ss.colorGrid}>
              {GROUP_COLORS.map(c => (
                <button key={c} style={{ ...ss.colorSwatch, background: c, border: color === c ? '2px solid #fff' : 'none' }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>

          {/* Layout */}
          <div style={ss.section}>
            <label style={ss.label}>Layout</label>
            <div style={ss.layoutGrid}>
              {LAYOUTS.map(l => (
                <button key={l.id} style={{ ...ss.layoutBtn, ...(layout === l.id ? { borderColor: color, background: color + '16' } : {}) }} onClick={() => setLayout(l.id)}>
                  <span style={ss.layoutIconWrap}>{l.icon}</span>
                  <span style={ss.layoutText}>
                    <span style={ss.layoutName}>{l.label}</span>
                    <span style={ss.layoutDesc}>{l.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Invite Friends */}
          {friends.length > 0 && (
            <div style={ss.section}>
              <label style={ss.label}>Invite Friends ({selectedFriends.length})</label>
              <div style={ss.friendsList}>
                {friends.map(f => {
                  const isSelected = selectedFriends.includes(f.id)
                  const name = friendName(f)
                  const avatar = friendAvatar(f)
                  return (
                    <div key={f.id} style={{ ...ss.friendRow, background: isSelected ? color + '22' : cv.elevated }} onClick={() => toggleFriend(f.id)}>
                      <div style={{ ...ss.friendAvatar, background: avatar ? cv.elevated : `linear-gradient(145deg, ${color}55, ${cv.elevated})`, borderColor: isSelected ? color : cv.border }}>
                        {avatar
                          ? <img src={avatar} alt={name} style={ss.friendAvatarImg} />
                          : <span>{(name[0] || '?').toUpperCase()}</span>
                        }
                      </div>
                      <div style={ss.friendInfo}>
                        <div style={ss.friendName}>{name}</div>
                        {friendHandle(f) && <div style={ss.friendHandle}>{friendHandle(f)}</div>}
                      </div>
                      <span style={{ ...ss.inviteToggle, ...(isSelected ? { background: color, borderColor: color, color: '#fff' } : {}) }}>{isSelected ? '✓' : '+'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={ss.footer}>
          <button style={ss.cancelBtn} onClick={onClose}>Cancel</button>
          <button className="vn-process-btn" style={{ ...ss.createBtn, background: color, opacity: canCreate ? 1 : 0.5 }} onClick={handleCreate} disabled={!canCreate}>
            Create Diary
          </button>
        </div>
      </div>
    </div>
  )
}

const ss = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 },
  modal: { width: 'min(560px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 56px)', background: cv.surface, border: `1px solid ${cv.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 28px 80px rgba(0,0,0,0.48)', display: 'flex', flexDirection: 'column' },
  header: { padding: '20px 22px', borderBottom: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'color-mix(in srgb, var(--vn-accent) 8%, var(--vn-surface))' },
  headerPreview: { display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 },
  previewIcon: { width: 52, height: 52, borderRadius: 14, border: '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 },
  headerCopy: { minWidth: 0 },
  title: { fontSize: 18, fontWeight: 800, margin: 0, lineHeight: 1.2 },
  subtitle: { marginTop: 4, fontSize: 12, color: cv.textDim },
  close: { width: 36, height: 36, borderRadius: 10, border: `1px solid ${cv.border}`, background: cv.elevated, fontSize: 24, lineHeight: '30px', cursor: 'pointer', color: cv.textDim },
  body: { padding: 'clamp(14px, 2.1vh, 20px) 22px 18px', display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2vh, 20px)', minHeight: 0, overflowY: 'auto' },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 11.5, fontWeight: 800, color: cv.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' },
  input: { background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, color: cv.text, outline: 'none' },
  iconGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 9 },
  iconBtn: { height: 'clamp(40px, 5.8vh, 52px)', borderRadius: 11, fontSize: 23, border: '1px solid transparent', cursor: 'pointer', color: cv.text },
  colorGrid: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  colorSwatch: { width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', boxShadow: '0 0 0 1px rgba(0,0,0,0.2) inset' },
  layoutGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  layoutBtn: { minHeight: 'clamp(78px, 10vh, 92px)', padding: 14, borderRadius: 12, textAlign: 'left', border: `1px solid ${cv.border}`, background: cv.elevated, color: cv.text, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' },
  layoutIconWrap: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cv.accentDim, fontSize: 22, flexShrink: 0 },
  layoutText: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  layoutName: { fontWeight: 800, fontSize: 14 },
  layoutDesc: { fontSize: 12, lineHeight: 1.35, color: cv.textDim },
  friendsList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, maxHeight: 'min(230px, 24vh)', overflowY: 'auto', paddingRight: 2 },
  friendRow: { display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, border: `1px solid ${cv.border}`, cursor: 'pointer', minWidth: 0 },
  friendAvatar: { width: 38, height: 38, borderRadius: 12, background: cv.accentDim, border: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, overflow: 'hidden', flexShrink: 0, color: '#fff' },
  friendAvatarImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  friendInfo: { flex: 1, minWidth: 0 },
  friendName: { fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  friendHandle: { fontSize: 11, color: cv.textDim, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  inviteToggle: { width: 24, height: 24, borderRadius: 8, border: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cv.textDim, fontWeight: 800, flexShrink: 0 },
  footer: { padding: '16px 22px', borderTop: `1px solid ${cv.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: cv.panel },
  cancelBtn: { padding: '10px 22px', borderRadius: 10, background: 'transparent', border: `1px solid ${cv.border}`, color: cv.textMid, cursor: 'pointer' },
  createBtn: { padding: '10px 26px', borderRadius: 10, border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer' }
}
