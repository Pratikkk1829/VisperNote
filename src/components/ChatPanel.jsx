import { useState, useReducer, useRef, useCallback, useEffect } from 'react'
import { colors, cv } from '../styles/theme'

const MIN_WIDTH = 160
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 240

const QUICK_EMOJIS = ['😂', '❤️', '👍']

const ss = {
  header: { padding: '10px 14px 10px', fontSize: 12, color: cv.text, fontWeight: 600, borderBottom: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 42 },
  messages: { flex: 1, overflowY: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column' },
  inputWrap: { padding: 10, borderTop: `1px solid ${cv.border}`, display: 'flex', flexDirection: 'column', gap: 6 },
  replyBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--vn-grad-elevated, var(--vn-elevated))', borderRadius: 10, fontSize: 11, color: cv.textDim, borderLeft: `3px solid ${cv.accent}`, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.025)' },
  sendBtn: { width: 28, height: 28, borderRadius: 8, background: 'var(--vn-grad-btn, var(--vn-accent))', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 12, flexShrink: 0, boxShadow: 'var(--vn-glow-accent)' },
  ctxMenu: { position: 'fixed', background: 'var(--vn-grad-surface, #1e1b26)', border: `1px solid ${cv.border}`, borderRadius: 12, padding: '6px 0', minWidth: 180, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' },
  ctxItem: { padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' },
  ctxDivider: { height: 1, background: cv.border, margin: '4px 0' },
  settingsModal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 },
  modal: { background: 'var(--vn-grad-surface, #1a1a24)', border: `1px solid ${cv.border}`, borderRadius: 20, width: 360, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', overflow: 'hidden', animation: 'vnModalBloom 0.22s cubic-bezier(0.2,0.9,0.2,1) both' },
  modalHeader: { padding: '20px 22px 14px', borderBottom: `1px solid ${cv.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 15, fontWeight: 600, color: cv.text },
  modalBody: { padding: 20, display: 'flex', flexDirection: 'column', gap: 10 },
  modalBtn: { padding: '10px 14px', borderRadius: 10, border: `1px solid ${cv.border}`, background: cv.elevated, color: cv.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' },
  inviteLinkBox: { display: 'flex', gap: 8, background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 10, padding: 6, alignItems: 'center' },
  inviteLinkText: { flex: 1, minWidth: 0, color: cv.textMid, fontSize: 11.5, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'all' },
  copyLinkBtn: { padding: '7px 12px', background: 'var(--vn-grad-btn, var(--vn-accent))', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'transform 0.14s, background 0.2s' },
}

const avatarColor = (name) => {
  const palette = ['#c97b5a','#7a8ec9','#7ab89a','#b97ab8','#c9a87a','#7ac9c9']
  if (!name) return palette[0]
  return palette[name.charCodeAt(0) % palette.length]
}

const initials = (name) => (name || '?').slice(0, 2).toUpperCase()

function MsgBubble({ msg, prev, myId, ownerId, onReply, onForward, onDelete, onReact, onPin, onEdit, width, chatColor = '#e8a882' }) {
  const [hovered, setHovered] = useState(false)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)
  const mine = msg.mine
  // Show avatar+name if: no previous msg, different sender, OR same sender but >6 min gap
  const timeDiff = prev?.created_at && msg.created_at && prev.from === msg.from
    ? (new Date(msg.created_at) - new Date(prev.created_at)) / 1000 / 60
    : 0
  const showAvatar = !prev || prev.from !== msg.from || timeDiff > 6

  const handleMouseEnter = (e) => { setHovered(true); setShiftHeld(e.shiftKey) }
  const handleMouseMove  = (e) => { setShiftHeld(e.shiftKey) }
  const handleMouseLeave = () => { setHovered(false); setShiftHeld(false) }
  const handleCtx = (e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }

  const canDelete = mine || myId === ownerId
  const canEdit   = mine

  const time = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  const bubble = {
    background: 'transparent',
    borderRadius: 0,
    padding: '2px 0',
    fontSize: 12.5,
    color: mine ? chatColor : cv.text,
    lineHeight: 1.55,
    border: 'none',
    maxWidth: width - 72,
    wordBreak: 'break-word',
    position: 'relative',
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'flex-start',
        padding: showAvatar ? '8px 10px 1px' : '1px 10px 1px',
        gap: 8, position: 'relative',
        background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleCtx}
    >
      {/* Avatar column — fixed width so messages align even when avatar hidden */}
      <div style={{ width: 34, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {showAvatar && (
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: avatarColor(msg.from),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: '#fff',
            border: mine ? `2px solid ${cv.accentBorder}` : '2px solid transparent',
            overflow: 'hidden', flexShrink: 0,
          }}>
            {msg.avatar
              ? <img src={msg.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials(msg.from)
            }
          </div>
        )}
        {/* Time — hover only for grouped (non-header) messages */}
        {hovered && !showAvatar && <span style={{ fontSize: 9, color: cv.textDim, opacity: 0.55, whiteSpace: 'nowrap', marginTop: 4 }}>{time}</span>}
      </div>

      {/* Message content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Name row — only on first message of group, time shown inline */}
        {showAvatar && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: mine ? cv.accent : cv.text }}>
              {msg.from}
            </span>
            <span style={{ fontSize: 9.5, color: cv.textDim, opacity: 0.6 }}>{time}</span>
          </div>
        )}

        {/* Reply reference with connecting line */}
        {msg.replyTo && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3, position: 'relative', minHeight: 18 }}>
            {/* The curved connector line */}
            <div style={{
              width: 24, height: 14,
              borderTop: `2px solid ${cv.textDim}`,
              borderLeft: `2px solid ${cv.textDim}`,
              borderTopLeftRadius: 10,
              opacity: 0.48,
              flexShrink: 0,
              alignSelf: 'flex-end',
              marginBottom: 3,
            }} />
            <div style={{
              fontSize: 11, color: cv.textDim, opacity: 0.82,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: width - 110,
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 6,
              padding: '2px 7px',
            }}>
              <span style={{ fontWeight: 600, color: cv.accent, marginRight: 4 }}>{msg.replyTo.from}</span>
              {msg.replyTo.text}
            </div>
          </div>
        )}

        {/* Bubble */}
        <div style={bubble}>{msg.text}</div>

        {/* Reactions */}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <div key={emoji} onClick={() => onReact(msg.id, emoji)}
                style={{ background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 10, padding: '1px 6px', fontSize: 11, cursor: 'pointer', display: 'flex', gap: 3, alignItems: 'center' }}>
                {emoji} <span style={{ fontSize: 10, color: cv.textDim }}>{users.length}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hover action bar */}
      {hovered && (
        <div style={{ position: 'absolute', top: -14, right: 10, display: 'flex', gap: 2, background: '#1e1b26', border: `1px solid ${cv.border}`, borderRadius: 10, padding: '2px 6px', zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          {shiftHeld ? (
            <>
              {canEdit && <ActionBtn icon="✏️" tip="Edit" onClick={() => onEdit(msg)} />}
              <ActionBtn icon="↩️" tip="Reply" onClick={() => onReply(msg)} />
              <ActionBtn icon="↪️" tip="Forward" onClick={() => onForward(msg)} />
              {canDelete && <ActionBtn icon="🗑️" tip="Delete" onClick={() => onDelete(msg.id)} danger />}
            </>
          ) : (
            <>
              {QUICK_EMOJIS.map(e => <ActionBtn key={e} icon={e} tip={e} onClick={() => onReact(msg.id, e)} />)}
              <ActionBtn icon="↩️" tip="Reply" onClick={() => onReply(msg)} />
              <ActionBtn icon="↪️" tip="Forward" onClick={() => onForward(msg)} />
              <ActionBtn icon="⋯" tip="More" onClick={(ev) => setCtxMenu({ x: ev.clientX, y: ev.clientY })} />
            </>
          )}
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <CtxMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          items={[
            { label: '↩️  Reply', onClick: () => onReply(msg) },
            { label: '↪️  Forward', onClick: () => onForward(msg) },
            { label: '😊  Add Reaction', onClick: () => {} },
            { label: '📋  Copy Text', onClick: () => navigator.clipboard?.writeText(msg.text) },
            { label: '📌  Pin Message', onClick: () => onPin(msg) },
            ...(canEdit ? [{ label: '✏️  Edit Message', onClick: () => onEdit(msg) }] : []),
            'divider',
            ...(canDelete ? [{ label: '🗑️  Delete Message', onClick: () => onDelete(msg.id), danger: true }] : []),
          ]}
        />
      )}
    </div>
  )
}

function ActionBtn({ icon, tip, onClick, danger }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {hov && <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: '#111', color: '#eee', fontSize: 10, padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 30, animation: 'vnTooltipPop 0.16s cubic-bezier(0.2,0.9,0.2,1) both' }}>{tip}</div>}
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={(e) => { e.stopPropagation(); onClick(e) }}
        style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, cursor: 'pointer', borderRadius: 6, background: hov ? (danger ? 'rgba(232,80,80,0.2)' : 'rgba(255,255,255,0.1)') : 'transparent', transition: 'transform 0.14s, background 0.12s, filter 0.12s', transform: hov ? 'translateY(-1px) scale(1.08)' : 'scale(1)', filter: hov ? 'brightness(1.3)' : 'brightness(1)' }}
      >{icon}</div>
    </div>
  )
}

function CtxMenu({ x, y, onClose, items }) {
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Clamp to viewport
  const left = Math.min(x, window.innerWidth - 200)
  const top  = Math.min(y, window.innerHeight - 300)

  return (
    <div ref={ref} style={{ ...ss.ctxMenu, left, top }} onClick={e => e.stopPropagation()}>
      {items.map((item, i) =>
        item === 'divider'
          ? <div key={i} style={ss.ctxDivider} />
          : <CtxItem key={i} item={item} onClose={onClose} />
      )}
    </div>
  )
}

function CtxItem({ item, onClose }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      style={{ ...ss.ctxItem, background: hov ? 'rgba(255,255,255,0.06)' : 'transparent', color: item.danger ? '#e05555' : cv.text }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => { item.onClick(); onClose() }}
    >{item.label}</div>
  )
}

function SettingsModal({ groupName, onClose, onEditName, inviteCode, pinnedMsgs, members, myId }) {
  const [tab, setTab]           = useState('main')
  const [newName, setNewName]   = useState(groupName || '')
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [friendSearch, setFriendSearch] = useState('')
  const [invited, setInvited]   = useState(new Set())
  const inviteLink = inviteCode ? `vispernote://join/${inviteCode}` : ''

  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Filter members for friend list (exclude self)
  const friendList = (members || []).filter(m =>
    m.id !== myId && m.username?.toLowerCase().includes(friendSearch.toLowerCase())
  )

  return (
    <div style={ss.settingsModal} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        @keyframes vnModalBloom {
          from { opacity: 0; transform: translateY(18px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{ ...ss.modal, width: tab === 'invite' ? 400 : 360 }}>
        <div style={ss.modalHeader}>
          <span style={ss.modalTitle}>
            {tab === 'pinned' ? '📌 Pinned Messages'
              : tab === 'rename' ? '✏️ Rename Diary'
              : tab === 'invite' ? `👥 Invite to "${groupName}"`
              : `⚙️ ${groupName}`}
          </span>
          <span style={{ cursor: 'pointer', color: cv.textDim, fontSize: 13 }} onClick={onClose}>✕</span>
        </div>
        <div style={ss.modalBody}>

          {/* ── Main ── */}
          {tab === 'main' && (
            <>
              <ModalBtn icon="✏️" label="Edit Diary Name" onClick={() => { setTab('rename'); setConfirming(false) }} />
              <ModalBtn icon="👥" label="Invite & Members" onClick={() => setTab('invite')} />
              <div style={ss.inviteLinkBox}>
                <span style={ss.inviteLinkText}>{inviteLink || 'No invite link yet'}</span>
                <button
                  className="vn-process-btn"
                  style={{ ...ss.copyLinkBtn, background: copied ? '#4caf82' : cv.accent }}
                  onClick={copyInvite}
                  disabled={!inviteLink}
                >
                  {copied ? 'Copied' : 'Copy Link'}
                </button>
              </div>
              <ModalBtn icon="📌" label="Pinned Messages" onClick={() => setTab('pinned')} />
            </>
          )}

          {/* ── Rename ── */}
          {tab === 'rename' && !confirming && (
            <>
              <div style={{ cursor: 'pointer', fontSize: 11, color: cv.textDim, marginBottom: 8 }} onClick={() => setTab('main')}>← Back</div>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newName.trim() && setConfirming(true)}
                style={{ background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: cv.text, outline: `1px solid ${cv.accent}`, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
                placeholder="New diary name..."
              />
              <button
                disabled={!newName.trim() || newName.trim() === groupName}
                style={{ marginTop: 4, padding: '9px 0', background: newName.trim() && newName.trim() !== groupName ? cv.accent : cv.elevated, border: 'none', borderRadius: 10, color: newName.trim() && newName.trim() !== groupName ? '#fff' : cv.textDim, fontSize: 13, cursor: newName.trim() && newName.trim() !== groupName ? 'pointer' : 'not-allowed', fontFamily: 'inherit', width: '100%', transition: 'background 0.2s' }}
                onClick={() => newName.trim() && setConfirming(true)}>
                Continue →
              </button>
            </>
          )}

          {tab === 'rename' && confirming && (
            <>
              <div style={{ fontSize: 13, color: cv.text, textAlign: 'center', padding: '8px 0' }}>
                Rename diary to<br/>
                <strong style={{ color: cv.accent, fontSize: 15 }}>"{newName}"</strong>?
              </div>
              <div style={{ fontSize: 11, color: cv.textDim, textAlign: 'center' }}>This will update the name for all members.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: '9px 0', background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 10, color: cv.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Back
                </button>
                <button onClick={() => { onEditName(newName.trim()); onClose() }} style={{ flex: 1, padding: '9px 0', background: cv.accent, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✓ Confirm
                </button>
              </div>
            </>
          )}

          {/* ── Invite ── */}
          {tab === 'invite' && (
            <>
              <div style={{ cursor: 'pointer', fontSize: 11, color: cv.textDim, marginBottom: 8 }} onClick={() => setTab('main')}>← Back</div>
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: cv.textDim }}>🔍</span>
                <input
                  autoFocus
                  value={friendSearch}
                  onChange={e => setFriendSearch(e.target.value)}
                  placeholder="Search members..."
                  style={{ width: '100%', boxSizing: 'border-box', background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 8, padding: '8px 10px 8px 30px', fontSize: 12, color: cv.text, outline: 'none', fontFamily: 'inherit' }}
                />
              </div>
              {/* Member list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
                {friendList.length === 0
                  ? <div style={{ fontSize: 12, color: cv.textDim, textAlign: 'center', padding: '16px 0' }}>
                      {friendSearch ? 'No members found' : 'No other members yet'}
                    </div>
                  : friendList.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: cv.elevated, borderRadius: 10, border: `1px solid ${cv.border}` }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: avatarColor(m.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                        {m.avatar ? <img src={m.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(m.username)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: cv.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username}</div>
                      </div>
                      <button
                        onClick={() => setInvited(prev => { const n = new Set(prev); n.add(m.id); return n })}
                        style={{ padding: '5px 12px', background: invited.has(m.id) ? '#4caf82' : cv.accent, border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, cursor: invited.has(m.id) ? 'default' : 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
                        {invited.has(m.id) ? '✓ Invited' : 'Invite'}
                      </button>
                    </div>
                  ))
                }
              </div>
              {/* Invite code */}
              <div style={{ fontSize: 11, color: cv.textDim, marginBottom: 6 }}>Share a join link:</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: cv.text, fontFamily: 'monospace', userSelect: 'all', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inviteLink || 'No link yet'}
                </div>
                <button className="vn-process-btn" onClick={copyInvite} style={{ padding: '7px 12px', background: copied ? '#4caf82' : cv.accent, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            </>
          )}

          {/* ── Pinned ── */}
          {tab === 'pinned' && (
            <>
              <div style={{ cursor: 'pointer', fontSize: 11, color: cv.textDim, marginBottom: 4 }} onClick={() => setTab('main')}>← Back</div>
              {pinnedMsgs.length === 0
                ? <div style={{ fontSize: 12, color: cv.textDim, textAlign: 'center', padding: 20 }}>No pinned messages yet.</div>
                : pinnedMsgs.map(m => (
                    <div key={m.id} style={{ background: cv.elevated, borderRadius: 10, padding: '8px 12px', borderLeft: `3px solid ${cv.accent}` }}>
                      <div style={{ fontSize: 10, color: cv.textDim, marginBottom: 2 }}>{m.from}</div>
                      <div style={{ fontSize: 12, color: cv.text }}>{m.text}</div>
                    </div>
                  ))
              }
            </>
          )}

        </div>
      </div>
    </div>
  )
}

function ModalBtn({ icon, label, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button style={{ ...ss.modalBtn, background: hov ? cv.hover : cv.elevated }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={onClick}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

export default function ChatPanel({ groupName, members, messages, chatMsg, onMsgChange, onSend, myId, ownerId, onDeleteMsg, onReactMsg, onPinMsg, onForwardMsg, onEditMsg, onReplyMsg, onlineUsers, inviteCode, onEditName, chatColor = '#e8a882' }) {
  const [width, setWidth] = useState(() => {
    try { return Number(localStorage.getItem('vn_chat_width') || DEFAULT_WIDTH) } catch { return DEFAULT_WIDTH }
  })
  const [, _forceRender] = useReducer(x => x + 1, 0)
  useEffect(() => {
    const _h = () => _forceRender()
    window.addEventListener('vn-theme-change', _h)
    return () => window.removeEventListener('vn-theme-change', _h)
  }, [])
  const [dragging, setDragging]     = useState(false)
  const [replyTo, setReplyTo]       = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [pinnedMsgs, setPinnedMsgs] = useState([])
  const [editingMsg, setEditingMsg] = useState(null)
  const [editText, setEditText]     = useState('')
  const startX = useRef(0)
  const startW = useRef(0)
  const messagesEndRef = useRef(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    startX.current = e.clientX; startW.current = width; setDragging(true)
    const onMove = (ev) => {
      const newW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW.current + ev.clientX - startX.current))
      setWidth(newW)
      try { localStorage.setItem('vn_chat_width', newW) } catch {}
    }
    const onUp = () => { setDragging(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [width])

  const handleSend = () => {
    onSend(replyTo ? { replyTo } : {})
    setReplyTo(null)
  }

  const handleReply = (msg) => setReplyTo({ id: msg.id, from: msg.from, text: msg.text })
  const handleForward = (msg) => onForwardMsg?.(msg)
  const handleDelete = (id) => onDeleteMsg?.(id)
  const handleReact = (id, emoji) => onReactMsg?.(id, emoji)
  const handlePin = (msg) => {
    setPinnedMsgs(prev => prev.find(m => m.id === msg.id) ? prev.filter(m => m.id !== msg.id) : [...prev, msg])
    onPinMsg?.(msg)
  }
  const handleEdit = (msg) => { setEditingMsg(msg); setEditText(msg.text) }
  const handleEditSave = () => { onEditMsg?.(editingMsg.id, editText); setEditingMsg(null) }

  const onlineLabel = onlineUsers?.length > 0
    ? onlineUsers.slice(0, 3).join(', ') + (onlineUsers.length > 3 ? ` +${onlineUsers.length - 3}` : '')
    : null

  return (
    <div style={{ width, background: colors.surface, display: 'flex', flexShrink: 0, position: 'relative', borderRight: `1px solid ${colors.border}` }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header — online users + settings */}
        <div style={ss.header}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {onlineLabel
              ? <span style={{ fontSize: 10.5, color: '#4caf82', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🟢 {onlineLabel}</span>
              : <span style={{ fontSize: 10.5, color: colors.textDim }}>No one online</span>
            }
          </div>
          <div style={{ cursor: 'pointer', fontSize: 17, color: colors.textDim, flexShrink: 0, padding: '2px 4px', borderRadius: 6, transition: 'color 0.15s' }}
            onClick={() => setShowSettings(true)}
            onMouseEnter={e => e.currentTarget.style.color = colors.text}
            onMouseLeave={e => e.currentTarget.style.color = colors.textDim}
            title="Diary settings">⋯</div>
        </div>

        {/* Messages */}
        <div style={ss.messages}>
          {messages.map((msg, i) => (
            <MsgBubble
              key={msg.id}
              msg={msg}
              prev={messages[i - 1]}
              myId={myId}
              ownerId={ownerId}
              width={width}
              chatColor={chatColor}
              onReply={handleReply}
              onForward={handleForward}
              onDelete={handleDelete}
              onReact={handleReact}
              onPin={handlePin}
              onEdit={handleEdit}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={ss.inputWrap}>
          {replyTo && (
            <div style={ss.replyBar}>
              <span style={{ width: 22, height: 14, borderLeft: `2px solid ${cv.accent}`, borderTop: `2px solid ${cv.accent}`, borderTopLeftRadius: 10, opacity: 0.85, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ color: cv.accent }}>{replyTo.from}</b>: {replyTo.text}</span>
              <span style={{ cursor: 'pointer', fontSize: 13 }} onClick={() => setReplyTo(null)}>✕</span>
            </div>
          )}
          {editingMsg && (
            <div style={{ ...ss.replyBar, borderColor: '#7a8ec9' }}>
              <span style={{ flex: 1 }}>✏️ Editing message</span>
              <span style={{ cursor: 'pointer', fontSize: 13 }} onClick={() => setEditingMsg(null)}>✕</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              style={{ flex: 1, background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: colors.text, outline: 'none', fontFamily: 'inherit', minWidth: 0 }}
              placeholder={editingMsg ? 'Edit message...' : 'Type...'}
              value={editingMsg ? editText : chatMsg}
              onChange={e => editingMsg ? setEditText(e.target.value) : onMsgChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (editingMsg ? handleEditSave() : handleSend())}
            />
            <button style={ss.sendBtn} onClick={editingMsg ? handleEditSave : handleSend}>→</button>
          </div>
        </div>
      </div>

      {/* Drag handle */}
      <div onMouseDown={onMouseDown}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'ew-resize', zIndex: 10, background: dragging ? colors.accent : 'rgba(255,255,255,0.06)', transition: 'background 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.background = colors.accent + '66'}
        onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      />

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          groupName={groupName}
          pinnedMsgs={pinnedMsgs}
          inviteCode={inviteCode}
          onEditName={onEditName}
          members={members}
          myId={myId}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
