import { useState, useEffect, useLayoutEffect, useRef, useReducer, useCallback } from 'react'
import Titlebar from '../components/Titlebar'
import Sidebar from '../components/Sidebar'
import LoadingOverlay from '../components/LoadingOverlay'
import { supabase } from '../lib/supabase'
import { colors, cv, s } from '../styles/theme'
import { isMention, notifyApp } from '../lib/notifications'

// ── Helpers ───────────────────────────────────────────────
const initials = (name) => name ? name.slice(0, 2).toUpperCase() : '??'
const palette  = ['#c97b5a','#7a8ec9','#7ab89a','#b97ab8','#c9a87a','#7ac9c9']
const colorFor = (id) => palette[(id?.charCodeAt(0) || 0) % palette.length]
// Always prefer display_name, fall back to username
const displayName = (p) => p?.display_name || p?.name || p?.username || '?'
const fmt      = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
const fmtDate  = (ts) => ts ? new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''

const DM_MIN = 160, DM_MAX = 320, DM_DEFAULT = 220

function AvatarCircle({ person, size = 34, border = 'transparent', style }) {
  const col = colorFor(person?.id || person?.username || '')
  const src = person?.avatar_url || person?.avatar || null
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: col + '33', color: col,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.max(10, Math.round(size * 0.34)), fontWeight: 800,
      border: `2px solid ${border}`,
      overflow: 'hidden', flexShrink: 0, ...style
    }}>
      {src
        ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(displayName(person))
      }
    </div>
  )
}

// ── Animated tooltip ──────────────────────────────────────
// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('vn-tip-kf')) {
  const st = document.createElement('style')
  st.id = 'vn-tip-kf'
  st.textContent = `
    @keyframes vnTipIn {
      from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.88); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1);    }
    }
  `
  document.head.appendChild(st)
}

function Tooltip({ label, children }) {
  const [vis, setVis] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVis(true)} onMouseLeave={() => setVis(false)}>
      {children}
      {vis && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#111', color: '#eee', fontSize: 11, fontWeight: 600,
          padding: '4px 9px', borderRadius: 6, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 999,
          animation: 'vnTipIn 0.15s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>{label}</div>
      )}
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────
function CtxMenu({ x, y, onClose, items }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} onClick={e => e.stopPropagation()} style={{
      position: 'fixed', left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 200),
      background: 'var(--vn-elevated)', border: '1px solid var(--vn-border)',
      borderRadius: 12, padding: '6px 0', minWidth: 180, zIndex: 9999,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
    }}>
      {items.map((item, i) =>
        item === 'divider'
          ? <div key={i} style={{ height: 1, background: 'var(--vn-border)', margin: '4px 0' }} />
          : <CtxItem key={i} item={item} onClose={onClose} />
      )}
    </div>
  )
}
function CtxItem({ item, onClose }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: hov ? 'rgba(255,255,255,0.06)' : 'transparent', color: item.danger ? '#e05555' : 'var(--vn-text)', transition: 'background 0.1s' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => { item.onClick(); onClose() }}
    >{item.label}</div>
  )
}

// ── Hover action btn ──────────────────────────────────────
function ActionBtn({ icon, tip, onClick, danger }) {
  const [hov, setHov] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {hov && <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, background: '#111', color: '#eee', fontSize: 10, padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 30 }}>{tip}</div>}
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={e => { e.stopPropagation(); onClick(e) }}
        style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, cursor: 'pointer', borderRadius: 6, background: hov ? (danger ? 'rgba(232,80,80,0.2)' : 'rgba(255,255,255,0.1)') : 'transparent', transition: 'background 0.12s' }}
      >{icon}</div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────
function MsgBubble({ msg, prev, myId, myProfile, contact, onDelete, onReply }) {
  const [hovered, setHovered] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)
  const mine = msg.from_user === myId
  const timeDiff = prev?.created_at && msg.created_at && prev.from_user === msg.from_user
    ? (new Date(msg.created_at) - new Date(prev.created_at)) / 1000 / 60 : 999
  const showHeader = !prev || prev.from_user !== msg.from_user || timeDiff > 6
  const senderName = mine ? displayName(myProfile) : displayName(contact)
  const senderProfile = mine ? myProfile : contact
  const reply = msg.replyTo || (msg.reply_to ? (() => { try { return JSON.parse(msg.reply_to) } catch { return null } })() : null)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: showHeader ? '8px 14px 1px' : '1px 14px 1px', gap: 10, position: 'relative', background: hovered ? 'rgba(255,255,255,0.025)' : 'transparent', transition: 'background 0.12s' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
    >
      <div style={{ width: 34, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {showHeader ? (
          <AvatarCircle person={senderProfile} size={30} border={mine ? 'var(--vn-accent-border)' : 'transparent'} />
        ) : hovered ? (
          <span style={{ fontSize: 9, color: 'var(--vn-text-dim)', opacity: 0.5, whiteSpace: 'nowrap', marginTop: 4 }}>{fmt(msg.created_at)}</span>
        ) : null}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {showHeader && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: mine ? 'var(--vn-accent)' : 'var(--vn-text)' }}>{senderName}</span>
            <span style={{ fontSize: 9.5, color: 'var(--vn-text-dim)', opacity: 0.6 }}>{fmt(msg.created_at)}</span>
          </div>
        )}
        {reply && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 3 }}>
            <div style={{ width: 24, height: 14, borderTop: '2px solid var(--vn-text-dim)', borderLeft: '2px solid var(--vn-text-dim)', borderTopLeftRadius: 10, opacity: 0.48, flexShrink: 0, alignSelf: 'flex-end', marginBottom: 3 }} />
            <div style={{ fontSize: 11, color: 'var(--vn-text-dim)', opacity: 0.82, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '2px 7px' }}>
              <span style={{ fontWeight: 600, color: 'var(--vn-accent)', marginRight: 4 }}>{reply.from}</span>
              {reply.text}
            </div>
          </div>
        )}
        <div style={{ fontSize: 12.5, color: 'var(--vn-text)', lineHeight: 1.55, wordBreak: 'break-word' }}>{msg.text}</div>
      </div>
      {hovered && (
        <div style={{ position: 'absolute', top: -14, right: 14, display: 'flex', gap: 2, background: 'var(--vn-elevated)', border: '1px solid var(--vn-border)', borderRadius: 10, padding: '2px 6px', zIndex: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          <ActionBtn icon="😊" tip="React" onClick={() => {}} />
          <ActionBtn icon="↩️" tip="Reply" onClick={() => onReply(msg)} />
          <ActionBtn icon="📋" tip="Copy" onClick={() => navigator.clipboard?.writeText(msg.text)} />
          {mine && <ActionBtn icon="🗑️" tip="Delete" onClick={() => onDelete(msg.id)} danger />}
        </div>
      )}
      {ctxMenu && (
        <CtxMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} items={[
          { label: '↩️  Reply', onClick: () => onReply(msg) },
          { label: '📋  Copy Text', onClick: () => navigator.clipboard?.writeText(msg.text) },
          'divider',
          ...(mine ? [{ label: '🗑️  Delete Message', onClick: () => onDelete(msg.id), danger: true }] : []),
        ]} />
      )}
    </div>
  )
}

// ── Friend action button (Friend / Add Friend) ────────────
function FriendActionBtn({ isFriend, onAction }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const circleStyle = {
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontSize: 15, border: 'none',
    transition: 'background 0.15s',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {isFriend ? (
        // Friend button — person checkmark icon, opens dropdown
        <Tooltip label="Friend">
          <div onClick={() => setOpen(v => !v)} style={circleStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--vn-text)' }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
              <polyline points="16 11 18 13 22 9"/>
            </svg>
          </div>
        </Tooltip>
      ) : (
        // Add Friend button — person plus icon
        <Tooltip label="Add Friend">
          <div onClick={onAction} style={{ ...circleStyle, background: 'rgba(76,175,130,0.18)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(76,175,130,0.32)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(76,175,130,0.18)'}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4caf82" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
        </Tooltip>
      )}

      {/* Dropdown for remove */}
      {open && isFriend && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--vn-grad-surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 0', zIndex: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 148 }}>
          <div
            onClick={() => { setOpen(false); onAction() }}
            style={{ padding: '8px 14px', fontSize: 13, color: '#e05555', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap', transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(224,85,85,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Remove Friend
          </div>
        </div>
      )}
    </div>
  )
}

// ── Remove friend confirm modal ───────────────────────────
function RemoveFriendModal({ username, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
      <div style={{ background: 'var(--vn-grad-surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, width: 400, padding: '28px 28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
        <div onClick={onCancel} style={{ position: 'absolute', top: 14, right: 16, cursor: 'pointer', fontSize: 16, color: 'var(--vn-text-dim)' }}>✕</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--vn-text)' }}>Remove '{username}.'</div>
        <div style={{ fontSize: 13, color: 'var(--vn-text-dim)', lineHeight: 1.65 }}>
          Are you sure you want to remove <b style={{ color: 'var(--vn-text)' }}>{username}.</b> from your friends?
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--vn-border)', background: 'var(--vn-elevated)', color: 'var(--vn-text)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#d83c3c', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            Remove Friend
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Right profile panel ───────────────────────────────────
function ProfilePanel({ contact, myId, isFriend, onRemoveFriend, onAddFriend }) {
  const [note, setNote]               = useState('')
  const [editingNote, setEditingNote] = useState(false)
  const [noteInput, setNoteInput]     = useState('')
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const noteRef = useRef(null)

  useEffect(() => {
    try { setNote(localStorage.getItem(`vn_note_${contact?.id}`) || '') } catch {}
    setEditingNote(false)
  }, [contact?.id])

  useEffect(() => {
    if (editingNote) noteRef.current?.focus()
  }, [editingNote])

  if (!contact) return null
  const col = colorFor(contact.id)
  const bannerGrad = `linear-gradient(135deg, ${col}66 0%, ${col}18 60%, transparent 100%)`

  const saveNote = () => {
    const val = noteInput.trim()
    try { localStorage.setItem(`vn_note_${contact.id}`, val) } catch {}
    setNote(val)
    setEditingNote(false)
  }

  const handleFriendAction = () => {
    if (isFriend) setShowRemoveModal(true)
    else onAddFriend()
  }

  return (
    <div style={{ width: 240, background: 'var(--vn-surface)', borderLeft: '1px solid var(--vn-border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
      {/* Coloured top strip */}
      <div style={{ height: 6, flexShrink: 0, background: bannerGrad }} />

      <div style={{ padding: '14px 14px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Avatar row + friend btn */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AvatarCircle person={contact} size={48} border="var(--vn-surface)" />
            {isFriend && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4caf82' }} />
                <span style={{ fontSize: 10, color: '#4caf82' }}>Online</span>
              </div>
            )}
          </div>
          {/* Friend action button — tooltip safe here, away from titlebar */}
          <FriendActionBtn isFriend={isFriend} onAction={handleFriendAction} />
        </div>

        {/* Name */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--vn-text)' }}>{displayName(contact)}</div>
          <div style={{ fontSize: 11, color: 'var(--vn-text-dim)', marginTop: 2 }}>@{contact.username?.toLowerCase()}</div>
        </div>

        <div style={{ height: 1, background: 'var(--vn-border)' }} />

        {/* Member since */}
        <div style={{ background: 'var(--vn-elevated)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--vn-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--vn-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>VisperNote Member</div>
          <div style={{ fontSize: 12, color: 'var(--vn-text)' }}>{contact.created_at ? fmtDate(contact.created_at) : 'Long-time friend'}</div>
        </div>

        <div style={{ background: 'var(--vn-elevated)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--vn-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--vn-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>Bio</div>
          <div style={{ fontSize: 12, color: contact.bio ? 'var(--vn-text)' : 'var(--vn-text-dim)', fontStyle: contact.bio ? 'normal' : 'italic', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {contact.bio || 'No bio yet.'}
          </div>
        </div>

        {/* Note — click to edit */}
        <div style={{ background: 'var(--vn-elevated)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--vn-border)', cursor: editingNote ? 'default' : 'pointer' }}
          onClick={() => { if (!editingNote) { setNoteInput(note); setEditingNote(true) } }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--vn-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>Note</div>
          {editingNote ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                ref={noteRef}
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote() } if (e.key === 'Escape') setEditingNote(false) }}
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--vn-bg)', border: '1px solid var(--vn-accent-border)', borderRadius: 7, padding: '6px 8px', fontSize: 12, color: 'var(--vn-text)', fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5, minHeight: 60 }}
                placeholder="Add a note..."
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={e => { e.stopPropagation(); saveNote() }} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', background: 'var(--vn-accent)', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Save</button>
                <button onClick={e => { e.stopPropagation(); setEditingNote(false) }} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid var(--vn-border)', background: 'transparent', color: 'var(--vn-text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: note ? 'var(--vn-text)' : 'var(--vn-text-dim)', fontStyle: note ? 'normal' : 'italic', lineHeight: 1.5 }}>
              {note || 'Click to add a note…'}
            </div>
          )}
        </div>

        {/* Accent color */}
        <div style={{ background: 'var(--vn-elevated)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--vn-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--vn-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 7 }}>Accent Color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: col, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--vn-text-dim)', fontFamily: 'monospace' }}>{col}</span>
          </div>
        </div>
      </div>

      {showRemoveModal && (
        <RemoveFriendModal
          username={displayName(contact)}
          onCancel={() => setShowRemoveModal(false)}
          onConfirm={() => { setShowRemoveModal(false); onRemoveFriend() }}
        />
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────
export default function DMPage({ groups, activeGroup, onSelectGroup, onReorderGroups, onAddGroup, onGoDM, onGoSettings, screen, user, onCheckForUpdate }) {
  const [friends, setFriends]           = useState([])
  const [requests, setRequests]         = useState([])
  const [activeDM, setActiveDM]         = useState(null)
  const [messages, setMessages]         = useState([])
  const [msgInput, setMsgInput]         = useState('')
  const [replyTo, setReplyTo]           = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchUser, setSearchUser]     = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searchError, setSearchError]   = useState('')
  const [sending, setSending]           = useState(false)
  const [loading, setLoading]           = useState(false)
  // removed contacts: still show their panel but as non-friend
  const [removedIds, setRemovedIds]     = useState(new Set())
  const [dmWidth, setDmWidth]           = useState(DM_DEFAULT)
  const [dragging, setDragging]         = useState(false)
  const [, forceRender] = useReducer(x => x + 1, 0)
  const bottomRef  = useRef(null)
  const startX     = useRef(0)
  const startW     = useRef(0)
  const myId = user?.id

  // theme reactivity
  useEffect(() => {
    const h = () => forceRender()
    window.addEventListener('vn-theme-change', h)
    return () => window.removeEventListener('vn-theme-change', h)
  }, [])

  // ── Sidebar drag resize ───────────────────────────────
  const onDragStart = useCallback((e) => {
    e.preventDefault()
    startX.current = e.clientX
    startW.current = dmWidth
    setDragging(true)
    const onMove = (ev) => {
      const nw = Math.min(DM_MAX, Math.max(DM_MIN, startW.current + ev.clientX - startX.current))
      setDmWidth(nw)
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [dmWidth])

  // ── Data loading ──────────────────────────────────────
  useEffect(() => {
    if (!myId) return
    setLoading(true)
    Promise.all([loadFriends(), loadRequests()]).finally(() => setLoading(false))
    const ch = supabase.channel('friend-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => { loadFriends(); loadRequests() })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [myId])

  const loadFriends = async () => {
    const { data } = await supabase
      .from('friend_requests')
      .select('from_user, to_user, from_profile:profiles!friend_requests_from_user_fkey(id,username,display_name,avatar_url,bio,created_at), to_profile:profiles!friend_requests_to_user_fkey(id,username,display_name,avatar_url,bio,created_at)')
      .eq('status', 'accepted')
      .or(`from_user.eq.${myId},to_user.eq.${myId}`)
    if (data) {
      const list = data.map(r => r.from_user === myId ? r.to_profile : r.from_profile).filter(Boolean)
      // Keep previously-removed contacts in the list so their chat stays visible
      setFriends(prev => {
        const inList = new Set(list.map(f => f.id))
        const removedButKept = prev.filter(f => !inList.has(f.id))
        return [...list, ...removedButKept]
      })
      if (!activeDM && list.length > 0) setActiveDM(list[0].id)
    }
  }

  const loadRequests = async () => {
    const { data } = await supabase
      .from('friend_requests')
      .select('id, from_user, from_profile:profiles!friend_requests_from_user_fkey(id,username,display_name,avatar_url,bio,created_at)')
      .eq('to_user', myId).eq('status', 'pending')
    if (data) setRequests(data)
  }

  useEffect(() => {
    if (!myId || !activeDM) return
    loadMessages()
    const ch = supabase.channel(`dm-${myId}-${activeDM}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, (payload) => {
        const m = payload.new
        if ((m.from_user === myId && m.to_user === activeDM) ||
            (m.from_user === activeDM && m.to_user === myId)) {
          setMessages(prev => prev.some(existing => existing.id === m.id) ? prev : [...prev, m])
          if (m.from_user !== myId) {
            const sender = friends.find(f => f.id === m.from_user)
            const senderName = displayName(sender)
            const mentioned = isMention(m.text, user)
            notifyApp({
              type: mentioned ? 'mention' : 'message',
              title: mentioned ? `Mention from ${senderName}` : `DM from ${senderName}`,
              body: m.text || '',
              tag: `dm-${m.id || m.created_at}`,
              icon: sender?.avatar_url || undefined,
            })
          }
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [myId, activeDM, friends, user])

  useLayoutEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' }) }, [messages, activeDM])

  const loadMessages = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('dm_messages').select('*')
      .or(`and(from_user.eq.${myId},to_user.eq.${activeDM}),and(from_user.eq.${activeDM},to_user.eq.${myId})`)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
    setLoading(false)
  }

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeDM) return
    const text = msgInput.trim()
    const reply_to = replyTo ? JSON.stringify(replyTo) : null
    setMsgInput(''); setReplyTo(null)
    const payload = { from_user: myId, to_user: activeDM, text }
    if (reply_to) payload.reply_to = reply_to
    const { data, error } = await supabase.from('dm_messages').insert(payload).select().single()
    if (!error && data) {
      setMessages(prev => prev.some(existing => existing.id === data.id) ? prev : [...prev, data])
    }
  }

  const deleteMessage = async (id) => {
    await supabase.from('dm_messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  // ── Remove friend ─────────────────────────────────────
  // We keep the contact visible in sidebar + chat (history stays).
  // We store the removed contact locally so the realtime reload doesn't wipe it.
  const removeFriend = async () => {
    if (!activeDM) return
    // Snapshot contact before deletion so we can restore after reload
    const removedContact = friends.find(f => f.id === activeDM)
    setRemovedIds(prev => new Set([...prev, activeDM]))
    await supabase.from('friend_requests')
      .delete()
      .or(`and(from_user.eq.${myId},to_user.eq.${activeDM}),and(from_user.eq.${activeDM},to_user.eq.${myId})`)
    // After deletion the realtime sub fires loadFriends which removes them from friends[].
    // Re-inject the snapshot so they stay visible.
    if (removedContact) {
      setFriends(prev => prev.find(f => f.id === removedContact.id) ? prev : [...prev, removedContact])
    }
  }

  // ── Add friend (re-send request) ──────────────────────
  const sendFriendRequest = async (toId) => {
    if (!toId) return
    await supabase.from('friend_requests').insert({ from_user: myId, to_user: toId })
    setRemovedIds(prev => { const n = new Set(prev); n.delete(toId); return n })
  }

  // ── Add friend modal ──────────────────────────────────
  const searchForUser = async () => {
    setSearchError(''); setSearchResult(null)
    if (!searchUser.trim()) return
    if (searchUser.trim() === (user?.username || user?.email?.split('@')[0])) { setSearchError("That's you 😄"); return }
    const { data } = await supabase.from('profiles').select('id,username,display_name,avatar_url,bio,created_at').eq('username', searchUser.trim()).single()
    if (!data) { setSearchError('User not found.'); return }
    if (friends.find(f => f.id === data.id)) { setSearchError('Already friends!'); return }
    setSearchResult(data)
  }

  const sendRequest = async () => {
    if (!searchResult) return
    setSending(true)
    const { error } = await supabase.from('friend_requests').insert({ from_user: myId, to_user: searchResult.id })
    setSending(false)
    if (error) { setSearchError('Request already sent or error occurred.'); return }
    setSearchResult(null); setSearchUser(''); setSearchError('')
  }

  const respondRequest = async (id, status) => {
    await supabase.from('friend_requests').update({ status }).eq('id', id)
  }

  // contact = selected friend OR recently removed (still show profile panel)
  const contact = friends.find(f => f.id === activeDM)
  const isFriend = contact && !removedIds.has(activeDM)

  return (
    <div style={s.root}>
      <Titlebar onCheckForUpdate={onCheckForUpdate} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar groups={groups} activeGroup={activeGroup} onSelectGroup={onSelectGroup} onReorderGroups={onReorderGroups} onAddGroup={onAddGroup} onGoDM={onGoDM} onGoSettings={onGoSettings} screen="dm" user={user} />

        {/* ── DM sidebar + drag handle ── */}
        <div style={{ width: dmWidth, background: 'var(--vn-surface)', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative' }}>
          {/* Header */}
          <div style={{ padding: '14px 14px 8px', fontSize: 12, fontWeight: 600, color: 'var(--vn-text-mid)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--vn-border)' }}>
            <span>Direct Messages</span>
            <span style={{ cursor: 'pointer', fontSize: 18, color: 'var(--vn-accent)' }} onClick={() => setShowAddModal(true)} title="Add friend">+</span>
          </div>

          {/* Friend requests */}
          {requests.length > 0 && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--vn-border)' }}>
              <div style={{ fontSize: 10, color: 'var(--vn-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Friend Requests</div>
              {requests.map(req => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: colorFor(req.from_profile?.id) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: colorFor(req.from_profile?.id), flexShrink: 0 }}>
                    {initials(req.from_profile?.username)}
                  </div>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--vn-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(req.from_profile)}</span>
                  <span style={{ padding: '4px 8px', borderRadius: 7, background: '#4caf8233', color: '#4caf82', fontSize: 11, cursor: 'pointer', fontWeight: 600 }} onClick={() => respondRequest(req.id, 'accepted')}>✓</span>
                  <span style={{ padding: '4px 8px', borderRadius: 7, background: 'rgba(232,112,112,0.15)', color: '#e87070', fontSize: 11, cursor: 'pointer', fontWeight: 600 }} onClick={() => respondRequest(req.id, 'declined')}>✕</span>
                </div>
              ))}
            </div>
          )}

          {/* Friends list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {friends.length === 0 && (
              <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--vn-text-dim)', textAlign: 'center', lineHeight: 1.7 }}>
                No friends yet.<br />Press <b style={{ color: 'var(--vn-accent)' }}>+</b> to add someone!
              </div>
            )}
            {friends.map(f => {
              const isActive = activeDM === f.id
              return (
                <div key={f.id}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', cursor: 'pointer', transition: 'background 0.15s', background: isActive ? 'var(--vn-accent-dim)' : 'transparent', borderLeft: isActive ? '2px solid var(--vn-accent)' : '2px solid transparent' }}
                  onClick={() => { setActiveDM(f.id); setMessages([]); setReplyTo(null) }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <AvatarCircle person={f} size={34} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4caf82', border: '2px solid var(--vn-surface)', position: 'absolute', bottom: 0, right: 0 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--vn-text)' }}>{displayName(f)}</div>
                    <div style={{ fontSize: 10, color: 'var(--vn-text-dim)', marginTop: 1 }}>Online</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Drag handle */}
          <div onMouseDown={onDragStart}
            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'ew-resize', zIndex: 10, background: dragging ? 'var(--vn-accent)' : 'rgba(255,255,255,0.04)', transition: 'background 0.2s' }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.background = 'var(--vn-accent)' }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          />
        </div>

        {/* ── Right side: header + (chat | profile) ── */}
        {contact ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Shared header spanning full width */}
            <div style={{ height: 48, padding: '0 16px', borderBottom: '1px solid var(--vn-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--vn-surface)' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <AvatarCircle person={contact} size={34} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: isFriend ? '#4caf82' : 'var(--vn-text-dim)', border: '2px solid var(--vn-surface)', position: 'absolute', bottom: 0, right: 0 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--vn-text)' }}>{displayName(contact)}</div>
                <div style={{ fontSize: 10, color: isFriend ? '#4caf82' : 'var(--vn-text-dim)' }}>{isFriend ? 'Online' : 'Not a friend'}</div>
              </div>
            </div>

            {/* Body row: messages + profile panel side by side */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

              {/* Messages + input */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--vn-bg)', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
                  {messages.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, padding: '40px 20px', flex: 1 }}>
                      <AvatarCircle person={contact} size={60} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--vn-text)' }}>{displayName(contact)}</div>
                      <div style={{ fontSize: 11, color: 'var(--vn-text-dim)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
                        This is the beginning of your direct message history with <b style={{ color: 'var(--vn-text)' }}>{displayName(contact)}</b>.
                      </div>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <MsgBubble key={msg.id} msg={msg} prev={messages[i - 1]} myId={myId} myProfile={user} contact={contact}
                      onDelete={deleteMessage}
                      onReply={m => setReplyTo({ id: m.id, from: m.from_user === myId ? displayName(user) : displayName(contact), text: m.text })}
                    />
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div style={{ padding: '10px 14px', borderTop: '1px solid var(--vn-border)', background: 'var(--vn-surface)', flexShrink: 0 }}>
                  {replyTo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--vn-elevated)', borderRadius: 10, fontSize: 11, color: 'var(--vn-text-dim)', borderLeft: '3px solid var(--vn-accent)', marginBottom: 6, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.025)' }}>
                      <span style={{ width: 22, height: 14, borderLeft: '2px solid var(--vn-accent)', borderTop: '2px solid var(--vn-accent)', borderTopLeftRadius: 10, opacity: 0.85, flexShrink: 0 }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ color: 'var(--vn-accent)' }}>{replyTo.from}</b>: {replyTo.text}</span>
                      <span style={{ cursor: 'pointer', fontSize: 13, flexShrink: 0 }} onClick={() => setReplyTo(null)}>✕</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      style={{ flex: 1, background: 'var(--vn-elevated)', border: '1px solid var(--vn-border)', borderRadius: 10, padding: '9px 13px', fontSize: 12, color: 'var(--vn-text)', outline: 'none', fontFamily: 'inherit' }}
                      placeholder={isFriend ? `Message ${displayName(contact)}...` : 'Add them as a friend to chat…'}
                      value={msgInput}
                      disabled={!isFriend}
                      onChange={e => setMsgInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      autoFocus
                    />
                    <button
                      style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--vn-accent)', border: 'none', cursor: isFriend ? 'pointer' : 'not-allowed', color: '#fff', fontSize: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isFriend ? 1 : 0.4 }}
                      onClick={sendMessage} disabled={!isFriend}
                    >➤</button>
                  </div>
                </div>
              </div>

              {/* Profile panel — no banner, sits flush below shared header */}
              <ProfilePanel
                contact={contact}
                myId={myId}
                isFriend={isFriend}
                onRemoveFriend={removeFriend}
                onAddFriend={() => sendFriendRequest(activeDM)}
              />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--vn-bg)' }}>
            <div style={{ fontSize: 36 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--vn-text)' }}>Your Direct Messages</div>
            <div style={{ fontSize: 12, color: 'var(--vn-text-dim)' }}>Add a friend with <b style={{ color: 'var(--vn-accent)' }}>+</b> to start chatting</div>
          </div>
        )}
      </div>

      {/* ── Add Friend Modal ── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div style={{ background: 'var(--vn-grad-surface)', border: '1px solid var(--vn-border)', borderRadius: 20, width: 400, display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
            <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--vn-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--vn-text)' }}>Add a Friend</span>
              <span style={{ cursor: 'pointer', color: 'var(--vn-text-dim)', fontSize: 13 }} onClick={() => setShowAddModal(false)}>✕</span>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--vn-text-dim)' }}>Search by exact username to send a friend request.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ flex: 1, background: 'var(--vn-elevated)', border: '1px solid var(--vn-border)', borderRadius: 10, padding: '10px 13px', fontSize: 13, color: 'var(--vn-text)', outline: 'none', fontFamily: 'inherit' }}
                  placeholder="Enter username..." value={searchUser}
                  onChange={e => { setSearchUser(e.target.value); setSearchResult(null); setSearchError('') }}
                  onKeyDown={e => e.key === 'Enter' && searchForUser()} autoFocus />
                <button style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--vn-accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }} onClick={searchForUser}>Search</button>
              </div>
              {searchError && <div style={{ fontSize: 12, color: '#e87070' }}>{searchError}</div>}
              {searchResult && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--vn-elevated)', border: '1px solid var(--vn-accent-border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: colorFor(searchResult.id) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: colorFor(searchResult.id) }}>
                    {initials(searchResult.username)}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--vn-text)' }}>{displayName(searchResult)}</span>
                  <button style={{ padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'var(--vn-accent)', color: '#fff', opacity: sending ? 0.6 : 1 }} onClick={sendRequest} disabled={sending}>
                    {sending ? '...' : 'Send Request'}
                  </button>
                </div>
              )}
              {requests.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--vn-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>Incoming Requests</div>
                  {requests.map(req => (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--vn-elevated)', border: '1px solid var(--vn-border)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: colorFor(req.from_profile?.id) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: colorFor(req.from_profile?.id) }}>
                        {initials(req.from_profile?.username)}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--vn-text)' }}>{displayName(req.from_profile)}</span>
                      <button style={{ padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#4caf8233', color: '#4caf82' }} onClick={() => respondRequest(req.id, 'accepted')}>Accept</button>
                      <button style={{ padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(232,112,112,0.15)', color: '#e87070' }} onClick={() => respondRequest(req.id, 'declined')}>Decline</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <LoadingOverlay visible={loading} message="Loading messages..." compact />
    </div>
  )
}
