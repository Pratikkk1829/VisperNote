import { useState } from 'react'
import { colors } from '../styles/theme'

const ss = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#1a1a24', border: `1px solid ${colors.border}`, borderRadius: 20, padding: '28px 28px 24px', width: 420, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 32px 80px rgba(0,0,0,0.6)', maxHeight: '88vh', overflowY: 'auto' },
  title: { fontSize: 18, fontWeight: 600, color: colors.text },
  sub: { fontSize: 12, color: colors.textDim, marginTop: 4 },
  label: { fontSize: 11, color: colors.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, display: 'block' },
  input: { width: '100%', background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '10px 13px', fontSize: 13, color: colors.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  iconGrid: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  iconOption: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.15s' },
  inviteAvatar: { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' },
  linkBox: { background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '9px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  linkText: { fontSize: 12, color: colors.textDim, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  copyBtn: { fontSize: 11, color: colors.accent, cursor: 'pointer', fontWeight: 500, background: colors.accentDim, border: `1px solid ${colors.accentBorder}`, borderRadius: 6, padding: '4px 10px', flexShrink: 0 },
  btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  btnCancel: { padding: '9px 18px', borderRadius: 10, border: `1px solid ${colors.border}`, background: 'transparent', color: colors.textMuted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  btnCreate: { padding: '9px 22px', borderRadius: 10, border: 'none', background: colors.accent, color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 600 },
}

const ICONS = ['📔', '✉️', '📜', '🗂️', '🌸', '🌊', '🔥', '🌿', '🌙', '✨', '🎭', '🎨']
const GROUP_COLORS = ['#c97b5a', '#7a8ec9', '#7ab89a', '#b97ab8', '#c9a87a', '#7ac9c9']

const LAYOUTS = [
  { id: 'diary', icon: '📔', label: 'Diary', desc: 'Personal entries with lined pages' },
  { id: 'letter', icon: '✉️', label: 'Letter', desc: 'Classic letter with signature' },
  { id: 'script', icon: '📜', label: 'Script', desc: 'Screenplay / story format' },
  { id: 'project', icon: '🗂️', label: 'Project', desc: 'Kanban board for tracking tasks' },
]

const DM_CONTACTS = [
  { id: 1, avatar: 'A', name: 'Alex', color: '#c97b5a' },
  { id: 2, avatar: 'J', name: 'Jenny', color: '#7a8ec9' },
  { id: 3, avatar: 'S', name: 'Sam', color: '#7ab89a' },
  { id: 4, avatar: 'T', name: 'Thomas', color: '#b97ab8' },
  { id: 5, avatar: 'L', name: 'Lana', color: '#c9a87a' },
]

const genLink = () => 'vispernote.io/join/' + Math.random().toString(36).slice(2, 8).toUpperCase()

export default function GroupCreate({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📔')
  const [groupColor, setGroupColor] = useState('#c97b5a')
  const [layout, setLayout] = useState('diary')
  const [invites, setInvites] = useState([])
  const [tab, setTab] = useState('invite')
  const [link] = useState(genLink)
  const [copied, setCopied] = useState(false)

  const toggleInvite = (id) => setInvites(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleCopy = () => {
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate({ name: name.trim(), icon, color: groupColor, layout, members: invites })
    onClose()
  }

  return (
    <div style={ss.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={ss.modal}>
        <div>
          <div style={ss.title}>Create a Group</div>
          <div style={ss.sub}>A shared space to write together</div>
        </div>

        {/* Name */}
        <div>
          <label style={ss.label}>Group name</label>
          <input style={ss.input} placeholder="e.g. Summer Stories" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>

        {/* Icon */}
        <div>
          <label style={ss.label}>Icon</label>
          <div style={ss.iconGrid}>
            {ICONS.map(ic => (
              <div key={ic} style={{ ...ss.iconOption, background: icon === ic ? groupColor + '33' : colors.elevated, borderColor: icon === ic ? groupColor : 'transparent' }} onClick={() => setIcon(ic)}>{ic}</div>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label style={ss.label}>Color</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {GROUP_COLORS.map(c => (
              <div key={c} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: groupColor === c ? '3px solid #fff' : '3px solid transparent', transition: 'all 0.15s' }} onClick={() => setGroupColor(c)} />
            ))}
          </div>
        </div>

        {/* Layout selector */}
        <div>
          <label style={ss.label}>Layout</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {LAYOUTS.map(l => (
              <div
                key={l.id}
                style={{ padding: '12px 14px', borderRadius: 12, border: `2px solid ${layout === l.id ? groupColor : colors.border}`, background: layout === l.id ? groupColor + '15' : colors.elevated, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'flex-start', gap: 10 }}
                onClick={() => setLayout(l.id)}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{l.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{l.label}</div>
                  <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2, lineHeight: 1.4 }}>{l.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite / link */}
        <div>
          <div style={{ display: 'flex', gap: 0, marginBottom: 12, background: colors.elevated, borderRadius: 10, padding: 4 }}>
            {[['invite', '👥 Invite friends'], ['link', '🔗 Share link']].map(([t, lbl]) => (
              <div key={t} style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: tab === t ? 600 : 400, color: tab === t ? colors.text : colors.textDim, background: tab === t ? colors.surface : 'transparent', transition: 'all 0.15s' }} onClick={() => setTab(t)}>{lbl}</div>
            ))}
          </div>

          {tab === 'invite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DM_CONTACTS.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10, background: invites.includes(c.id) ? c.color + '15' : colors.elevated, border: `1px solid ${invites.includes(c.id) ? c.color + '40' : colors.border}`, cursor: 'pointer', transition: 'all 0.15s' }} onClick={() => toggleInvite(c.id)}>
                  <div style={{ ...ss.inviteAvatar, background: c.color }}>{c.avatar}</div>
                  <span style={{ flex: 1, fontSize: 13, color: colors.text }}>{c.name}</span>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${invites.includes(c.id) ? c.color : colors.border}`, background: invites.includes(c.id) ? c.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', transition: 'all 0.15s' }}>
                    {invites.includes(c.id) ? '✓' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'link' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: colors.textDim }}>Anyone with this link can join the group.</div>
              <div style={ss.linkBox}>
                <span style={ss.linkText}>{link}</span>
                <div style={ss.copyBtn} onClick={handleCopy}>{copied ? '✓ Copied!' : 'Copy'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={ss.btnRow}>
          <button style={ss.btnCancel} onClick={onClose}>Cancel</button>
          <button style={{ ...ss.btnCreate, opacity: name.trim() ? 1 : 0.4, cursor: name.trim() ? 'pointer' : 'default' }} onClick={handleCreate}>Create Group →</button>
        </div>
      </div>
    </div>
  )
}
