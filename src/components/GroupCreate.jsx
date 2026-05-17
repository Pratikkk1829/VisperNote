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

export default function GroupCreate({ friends = [], onClose, onCreate }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📔')
  const [color, setColor] = useState('#c97b5a')
  const [layout, setLayout] = useState('diary')
  const [selectedFriends, setSelectedFriends] = useState([])

  const canCreate = name.trim().length > 0

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
          <h2 style={ss.title}>Create New Diary</h2>
          <button style={ss.close} onClick={onClose}>✕</button>
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
                <button key={i} style={{ ...ss.iconBtn, background: icon === i ? color + '33' : cv.elevated, borderColor: icon === i ? color : cv.border }} onClick={() => setIcon(i)}>
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
                <button key={l.id} style={{ ...ss.layoutBtn, borderColor: layout === l.id ? color : cv.border }} onClick={() => setLayout(l.id)}>
                  <span style={ss.layoutIcon}>{l.icon}</span>
                  <span style={ss.layoutName}>{l.label}</span>
                  <span style={ss.layoutDesc}>{l.desc}</span>
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
                  return (
                    <div key={f.id} style={{ ...ss.friendRow, background: isSelected ? color + '22' : cv.elevated }} onClick={() => toggleFriend(f.id)}>
                      <div style={ss.friendAvatar}>{f.username?.[0] || '?'}</div>
                      <div style={ss.friendName}>{f.username || f.display_name}</div>
                      {isSelected && <span style={ss.check}>✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={ss.footer}>
          <button style={ss.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{ ...ss.createBtn, background: color, opacity: canCreate ? 1 : 0.5 }} onClick={handleCreate} disabled={!canCreate}>
            Create Diary
          </button>
        </div>
      </div>
    </div>
  )
}

const ss = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 },
  modal: { width: 480, background: cv.surface, border: `1px solid ${cv.border}`, borderRadius: 16, overflow: 'hidden' },
  header: { padding: '16px 20px', borderBottom: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: 600 },
  close: { fontSize: 20, cursor: 'pointer', color: cv.textDim },
  body: { padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '65vh', overflowY: 'auto' },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 11.5, fontWeight: 700, color: cv.textDim, letterSpacing: '0.5px' },
  input: { background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 15, color: cv.text },
  iconGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 },
  iconBtn: { height: 46, borderRadius: 10, fontSize: 22, border: '1px solid transparent' },
  colorGrid: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  colorSwatch: { width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' },
  layoutGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  layoutBtn: { padding: 12, borderRadius: 12, textAlign: 'left', border: '1px solid transparent' },
  layoutIcon: { fontSize: 24, display: 'block', marginBottom: 6 },
  layoutName: { fontWeight: 600, fontSize: 14 },
  layoutDesc: { fontSize: 11.5, color: cv.textDim },
  friendsList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' },
  friendRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10, cursor: 'pointer' },
  friendAvatar: { width: 32, height: 32, borderRadius: '50%', background: cv.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  friendName: { flex: 1, fontSize: 14 },
  check: { color: '#4ade80', fontWeight: 700 },
  footer: { padding: '16px 20px', borderTop: `1px solid ${cv.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: { padding: '9px 20px', borderRadius: 10, background: 'transparent', border: `1px solid ${cv.border}`, color: cv.textMid },
  createBtn: { padding: '9px 24px', borderRadius: 10, border: 'none', color: '#fff', fontWeight: 600 }
}