import { colors } from '../styles/theme'

const ss = {
  panel: { width: 220, background: colors.surface, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 },
  header: { padding: '14px 14px 10px', fontSize: 11, letterSpacing: '0.1em', color: colors.textDim, textTransform: 'uppercase', fontWeight: 500, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  members: { padding: '10px 10px 6px', display: 'flex', gap: 6, borderBottom: `1px solid ${colors.border}` },
  memberDot: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: '#fff' },
  messages: { flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 },
  msg: { display: 'flex', flexDirection: 'column', gap: 3 },
  msgName: { fontSize: 10, color: colors.textDim, letterSpacing: '0.04em' },
  bubble: { background: colors.elevated, borderRadius: '10px 10px 10px 2px', padding: '7px 10px', fontSize: 12, color: colors.textMid, lineHeight: 1.5, border: `1px solid ${colors.border}`, maxWidth: 160 },
  bubbleMine: { background: colors.accentDim, border: `1px solid ${colors.accentBorder}`, borderRadius: '10px 10px 2px 10px', color: '#e8a882' },
  inputWrap: { padding: 10, borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 6, alignItems: 'center' },
  input: { flex: 1, background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: colors.text, outline: 'none', fontFamily: 'inherit' },
  sendBtn: { width: 28, height: 28, borderRadius: 8, background: colors.accent, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12 },
}

export default function ChatPanel({ groupName, members, messages, chatMsg, onMsgChange, onSend }) {
  return (
    <div style={ss.panel}>
      <div style={ss.header}>
        <span>{groupName || 'Chat'}</span>
        <span style={{ cursor: 'pointer', fontSize: 16 }}>⋯</span>
      </div>
      <div style={ss.members}>
        {members.map(([letter, color]) => (
          <div key={letter} style={{ ...ss.memberDot, background: color }}>{letter}</div>
        ))}
      </div>
      <div style={ss.messages}>
        {messages.map(msg => (
          <div key={msg.id} style={{ ...ss.msg, alignItems: msg.mine ? 'flex-end' : 'flex-start' }}>
            <span style={ss.msgName}>{msg.from}</span>
            <div style={{ ...ss.bubble, ...(msg.mine ? ss.bubbleMine : {}) }}>{msg.text}</div>
          </div>
        ))}
      </div>
      <div style={ss.inputWrap}>
        <input
          style={ss.input}
          placeholder="Type..."
          value={chatMsg}
          onChange={e => onMsgChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
        />
        <button style={ss.sendBtn} onClick={onSend}>→</button>
      </div>
    </div>
  )
}
