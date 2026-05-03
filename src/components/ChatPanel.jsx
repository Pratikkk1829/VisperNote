import { useState, useRef, useCallback, useEffect } from 'react'
import { colors } from '../styles/theme'

const MIN_WIDTH = 160
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 220

export default function ChatPanel({
  groupName,
  members = [],
  messages = [],
  chatMsg = '',
  onMsgChange,
  onSend,
}) {
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const [handleHovered, setHandleHovered] = useState(false)
  const startX = useRef(0)
  const startWidth = useRef(DEFAULT_WIDTH)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    startX.current = e.clientX
    startWidth.current = width
    setIsResizing(true)
  }, [width])

  useEffect(() => {
    if (!isResizing) return
    const onMouseMove = (e) => {
      const delta = e.clientX - startX.current
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setWidth(newWidth)
    }
    const onMouseUp = () => setIsResizing(false)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isResizing])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend?.()
    }
  }

  const showHandle = handleHovered || isResizing

  return (
    <div style={{ ...s.panel, width, flexShrink: 0, position: 'relative' }}>
      {/* Header */}
      <div style={s.header}>
        <span>Chat</span>
        <span style={{ cursor: 'pointer', fontSize: 16, color: colors.textDim }}>⋯</span>
      </div>

      {/* Members */}
      <div style={s.members}>
        {members.map(([label, color]) => (
          <div key={label} style={{ ...s.memberDot, background: color }}>{label}</div>
        ))}
        <div style={{ fontSize: 11, color: colors.textDim, marginLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName}</div>
      </div>

      {/* Messages */}
      <div style={s.messages}>
        {messages.map(msg => (
          <div key={msg.id} style={{ ...s.msg, alignItems: msg.mine ? 'flex-end' : 'flex-start' }}>
            <span style={s.msgName}>{msg.from}</span>
            <div style={{ ...s.bubble, ...(msg.mine ? s.bubbleMine : {}) }}>{msg.text}</div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={s.inputWrap}>
        <input
          style={s.input}
          placeholder="Type..."
          value={chatMsg}
          onChange={e => onMsgChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button style={s.sendBtn} onClick={() => onSend?.()}>→</button>
      </div>

      {/* RIGHT-EDGE resize handle */}
      <div
        style={{
          ...s.resizeHandle,
          opacity: showHandle ? 1 : 0,
          background: isResizing ? colors.accent : 'rgba(201,123,90,0.45)',
        }}
        onMouseDown={onMouseDown}
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
      >
        {showHandle && (
          <div style={s.gripDots}>
            {[0,1,2].map(i => <div key={i} style={s.gripDot} />)}
          </div>
        )}
      </div>

      {/* Wider invisible hit target */}
      <div
        style={s.resizeHitTarget}
        onMouseDown={onMouseDown}
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
      />
    </div>
  )
}

const s = {
  panel: { background: colors.surface, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', position: 'relative' },
  header: { padding: '14px 14px 10px', fontSize: 11, letterSpacing: '0.1em', color: colors.textDim, textTransform: 'uppercase', fontWeight: 500, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  members: { padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'center', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 },
  memberDot: { width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#fff', flexShrink: 0 },
  messages: { flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 },
  msg: { display: 'flex', flexDirection: 'column', gap: 3 },
  msgName: { fontSize: 10, color: colors.textDim, letterSpacing: '0.04em' },
  bubble: { background: colors.elevated, borderRadius: '10px 10px 10px 2px', padding: '7px 10px', fontSize: 12, color: colors.textMid, lineHeight: 1.5, border: `1px solid ${colors.border}`, maxWidth: '85%', wordBreak: 'break-word', userSelect: 'text' },
  bubbleMine: { background: colors.accentDim, border: `1px solid ${colors.accentBorder}`, borderRadius: '10px 10px 2px 10px', color: '#e8a882' },
  inputWrap: { padding: 10, borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, minWidth: 0, overflow: 'hidden' },
  input: { flex: 1, minWidth: 0, background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: colors.text, outline: 'none', fontFamily: 'inherit', userSelect: 'text' },
  sendBtn: { width: 28, height: 28, borderRadius: 8, background: colors.accent, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 13, flexShrink: 0 },
  resizeHandle: { position: 'absolute', top: 0, right: 0, width: 3, height: '100%', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s, background 0.15s', zIndex: 10, borderRadius: '0 2px 2px 0' },
  gripDots: { display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' },
  gripDot: { width: 3, height: 3, borderRadius: '50%', background: '#fff', opacity: 0.8 },
  resizeHitTarget: { position: 'absolute', top: 0, right: -4, width: 10, height: '100%', cursor: 'col-resize', zIndex: 9 },
}

