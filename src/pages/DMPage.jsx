import { useState } from 'react'
import Titlebar from '../components/Titlebar'
import { colors, s, STATUS_COLOR } from '../styles/theme'

const DM_CONTACTS = [
  { id: 1, name: 'Alex', status: 'online', statusText: 'Typing...', time: null, last: 'Typing...', avatar: 'A', color: '#c97b5a', streak: 5, storage: '3.2 / 20 GB', bio: 'Chronicling nights into words' },
  { id: 2, name: 'Jenny', status: 'idle', statusText: 'Idle', time: '19 min', last: 'Alright, got it!', avatar: 'J', color: '#7a8ec9', streak: 12, storage: '8.1 / 20 GB', bio: 'Words are my home.' },
  { id: 3, name: 'Sam', status: 'online', statusText: "I'll check it out 👍", time: null, last: "I'll check it out 👍", avatar: 'S', color: '#7ab89a', streak: 3, storage: '1.0 / 20 GB', bio: 'Co-writing the future' },
  { id: 4, name: 'Thomas', status: 'online', statusText: 'Catch up later!', time: 'Yesterday', last: 'Catch up later!', avatar: 'T', color: '#b97ab8', streak: 7, storage: '5.5 / 20 GB', bio: 'Lost in prose.' },
  { id: 5, name: 'Lana', status: 'offline', statusText: 'Offline', time: 'Friday', last: 'Happy birthday! 🎂', avatar: 'L', color: '#c9a87a', streak: 1, storage: '0.8 / 20 GB', bio: 'Life is a story, write it well.' },
]

const INIT_MESSAGES = {
  1: [{ id: 1, from: 'Alex', text: 'Hey, want to catch up later?', mine: false }, { id: 2, from: 'You', text: 'Sure, what time?', mine: true }, { id: 3, from: 'Alex', text: 'How about 7 PM?', mine: false }, { id: 4, from: 'You', text: 'Sounds good! 😄', mine: true }],
  2: [{ id: 1, from: 'Jenny', text: 'Alright, got it!', mine: false }],
  3: [{ id: 1, from: 'Sam', text: "I'll check it out 👍", mine: false }],
  4: [{ id: 1, from: 'Thomas', text: 'Catch up later!', mine: false }],
  5: [{ id: 1, from: 'Lana', text: 'Happy birthday! 🎂', mine: false }],
}

const ss = {
  layout: { display: 'flex', flex: 1, overflow: 'hidden' },
  rail: { width: 56, background: '#0d0d12', borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 6, flexShrink: 0 },
  railBtn: { width: 36, height: 36, borderRadius: 10, background: colors.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 },
  railDivider: { width: 28, height: 1, background: colors.border, margin: '2px 0' },
  railAvatar: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', transition: 'all 0.2s' },
  pip: { width: 8, height: 8, borderRadius: '50%', position: 'absolute', bottom: 2, right: 2 },
  sidebar: { width: 200, background: colors.surface, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader: { padding: '14px 14px 8px', fontSize: 12, fontWeight: 600, color: colors.textMid, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}` },
  search: { margin: '8px 10px', background: colors.elevated, borderRadius: 8, padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'center', border: `1px solid ${colors.border}` },
  contact: { display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', cursor: 'pointer', transition: 'background 0.15s' },
  contactActive: { background: 'rgba(201,123,90,0.1)', borderLeft: '2px solid #c97b5a' },
  avatar: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dmName: { fontSize: 13, fontWeight: 500, color: colors.text },
  dmTime: { fontSize: 10, color: colors.textDim },
  dmLast: { fontSize: 11, color: colors.textDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  self: { padding: '10px 12px', borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 10 },
  chat: { flex: 1, display: 'flex', flexDirection: 'column', background: colors.bg },
  chatHeader: { height: 52, padding: '0 16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: colors.surface },
  messages: { flex: 1, overflowY: 'auto', padding: '16px 20px' },
  bubble: { background: colors.elevated, borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: 13, color: '#c0b8b0', lineHeight: 1.5, border: `1px solid ${colors.border}`, maxWidth: 380 },
  bubbleMine: { background: 'rgba(201,123,90,0.18)', border: `1px solid ${colors.accentBorder}`, borderRadius: '16px 16px 4px 16px', color: '#e8c4a8' },
  inputWrap: { padding: '12px 16px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 10, alignItems: 'center', background: colors.surface },
  input: { flex: 1, background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: colors.text, outline: 'none', fontFamily: 'inherit' },
  sendBtn: { width: 36, height: 36, borderRadius: 10, background: colors.accent, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15 },
  profile: { width: 220, background: colors.surface, borderLeft: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', gap: 10, flexShrink: 0 },
  profileAvatar: { width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  profileName: { fontSize: 15, fontWeight: 700, color: colors.text, letterSpacing: '0.06em' },
  profileBio: { fontSize: 11, color: colors.textDim, textAlign: 'center', lineHeight: 1.5 },
  profileDivider: { width: '100%', height: 1, background: colors.border, margin: '4px 0' },
  profileRow: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' },
  profileLabel: { fontSize: 12, color: colors.textMid },
  profileBtn: { width: 34, height: 34, borderRadius: 8, background: colors.elevated, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15 },
}

export default function DMPage({ onGoHome }) {
  const [activeDM, setActiveDM] = useState(1)
  const [dmMessages, setDmMessages] = useState(INIT_MESSAGES)
  const [dmInput, setDmInput] = useState('')

  const contact = DM_CONTACTS.find(c => c.id === activeDM)

  const sendDM = () => {
    if (!dmInput.trim()) return
    setDmMessages(p => ({ ...p, [activeDM]: [...(p[activeDM] || []), { id: Date.now(), from: 'You', text: dmInput, mine: true }] }))
    setDmInput('')
  }

  return (
    <div style={s.root}>
      <Titlebar />
      <div style={ss.layout}>
        {/* Rail */}
        <div style={ss.rail}>
          <div style={ss.railBtn} onClick={onGoHome} title="Home">🏠</div>
          <div style={ss.railDivider} />
          {DM_CONTACTS.map(c => (
            <div key={c.id} style={{ ...ss.railAvatar, background: c.color + '33', border: activeDM === c.id ? `2px solid ${c.color}` : '2px solid transparent' }} onClick={() => setActiveDM(c.id)}>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.avatar}</span>
              <div style={{ ...ss.pip, background: STATUS_COLOR[c.status] }} />
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div style={ss.sidebar}>
          <div style={ss.sidebarHeader}><span>DMs</span><span style={{ cursor: 'pointer', fontSize: 18, color: colors.accent }}>+</span></div>
          <div style={ss.search}><span style={{ fontSize: 12, color: colors.textDim }}>🔍</span><span style={{ fontSize: 12, color: colors.textDim }}>Search</span></div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {DM_CONTACTS.map(c => (
              <div key={c.id} style={{ ...ss.contact, ...(activeDM === c.id ? ss.contactActive : {}) }} onClick={() => setActiveDM(c.id)}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ ...ss.avatar, background: c.color + '33' }}><span style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{c.avatar}</span></div>
                  <div style={{ ...ss.pip, bottom: 1, right: 1, position: 'absolute', background: STATUS_COLOR[c.status], border: '2px solid #16161d' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={ss.dmName}>{c.name}</span>
                    {c.time && <span style={ss.dmTime}>{c.time}</span>}
                  </div>
                  <div style={ss.dmLast}>{c.last}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={ss.self}>
            <div style={{ ...ss.avatar, background: '#c97b5a33', flexShrink: 0 }}><span style={{ fontSize: 15, fontWeight: 700, color: colors.accent }}>V</span></div>
            <span style={{ fontSize: 13, color: colors.textMid, fontWeight: 500 }}>VALIENTN</span>
            <div style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 16, color: colors.textDim }}>👤</div>
          </div>
        </div>

        {/* Chat area */}
        <div style={ss.chat}>
          <div style={ss.chatHeader}>
            <div style={{ ...ss.avatar, background: contact.color + '33', flexShrink: 0 }}><span style={{ fontSize: 15, fontWeight: 700, color: contact.color }}>{contact.avatar}</span></div>
            <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{contact.name}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
              {['🎙️', '📹', '⚙️', '⋯'].map(i => <span key={i} style={{ cursor: 'pointer', fontSize: 16, color: colors.textDim }}>{i}</span>)}
            </div>
          </div>
          <div style={ss.messages}>
            {(dmMessages[activeDM] || []).map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.mine ? 'flex-end' : 'flex-start', marginBottom: 10, alignItems: 'flex-end', gap: 8 }}>
                {!msg.mine && <div style={{ ...ss.avatar, background: contact.color + '33', flexShrink: 0 }}><span style={{ fontSize: 13, fontWeight: 700, color: contact.color }}>{contact.avatar}</span></div>}
                <div style={{ ...ss.bubble, ...(msg.mine ? ss.bubbleMine : {}) }}>{msg.text}</div>
              </div>
            ))}
          </div>
          <div style={ss.inputWrap}>
            <span style={{ fontSize: 16, color: colors.textDim, cursor: 'pointer' }}>😊</span>
            <input style={ss.input} placeholder="Type a message..." value={dmInput} onChange={e => setDmInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendDM()} />
            <span style={{ fontSize: 16, color: colors.textDim, cursor: 'pointer' }}>🖼️</span>
            <button style={ss.sendBtn} onClick={sendDM}>➤</button>
          </div>
        </div>

        {/* Profile panel */}
        <div style={ss.profile}>
          <div style={{ ...ss.profileAvatar, background: contact.color + '33' }}><span style={{ fontSize: 36, fontWeight: 700, color: contact.color }}>{contact.avatar}</span></div>
          <div style={ss.profileName}>{contact.name.toUpperCase()}</div>
          <div style={ss.profileBio}>{contact.bio}</div>
          <div style={ss.profileDivider} />
          <div style={ss.profileRow}><div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[contact.status] }} /><span style={ss.profileLabel}>{contact.statusText}</span></div>
          <div style={ss.profileRow}><span>🌙</span><span style={ss.profileLabel}>✨ {contact.streak} Day Streak</span></div>
          <div style={ss.profileRow}><span>📁</span><span style={ss.profileLabel}>{contact.storage}</span></div>
          <div style={ss.profileDivider} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {['🎙️', 'ℹ️', '📞', '⚙️'].map(i => <div key={i} style={ss.profileBtn}>{i}</div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
