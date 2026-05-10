import { useState, useEffect, useRef, useReducer } from 'react'
import Titlebar from '../components/Titlebar'
import Sidebar from '../components/Sidebar'
import { supabase } from '../lib/supabase'
import { colors, cv, s, STATUS_COLOR } from '../styles/theme'

const ss = {
  layout:       { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar:      { width: 220, background: cv.surface, borderRight: `1px solid ${cv.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader:{ padding: '14px 14px 8px', fontSize: 12, fontWeight: 600, color: cv.textMid, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${cv.border}` },
  search:       { margin: '8px 10px', background: cv.elevated, borderRadius: 8, padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'center', border: `1px solid ${cv.border}` },
  contact:      { display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', cursor: 'pointer', transition: 'background 0.15s' },
  contactActive:{ background: 'rgba(201,123,90,0.1)', borderLeft: '2px solid #c97b5a' },
  avatar:       { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pip:          { width: 8, height: 8, borderRadius: '50%', position: 'absolute', bottom: 1, right: 1 },
  dmName:       { fontSize: 13, fontWeight: 500, color: cv.text },
  dmLast:       { fontSize: 11, color: cv.textDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chat:         { flex: 1, display: 'flex', flexDirection: 'column', background: cv.bg },
  chatHeader:   { height: 52, padding: '0 16px', borderBottom: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: cv.surface },
  messages:     { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 },
  bubble:       { background: cv.elevated, borderRadius: '16px 16px 16px 4px', padding: '10px 14px', fontSize: 13, color: '#c0b8b0', lineHeight: 1.5, border: `1px solid ${cv.border}`, maxWidth: 380 },
  bubbleMine:   { background: 'rgba(201,123,90,0.18)', border: `1px solid ${cv.accentBorder}`, borderRadius: '16px 16px 4px 16px', color: '#e8c4a8' },
  inputWrap:    { padding: '12px 16px', borderTop: `1px solid ${cv.border}`, display: 'flex', gap: 10, alignItems: 'center', background: cv.surface },
  input:        { flex: 1, background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: cv.text, outline: 'none', fontFamily: 'inherit' },
  sendBtn:      { width: 36, height: 36, borderRadius: 10, background: cv.accent, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15 },
  empty:        { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: cv.textDim },
  // Friend request modal
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:        { background: '#1a1a24', border: `1px solid ${cv.border}`, borderRadius: 20, width: 400, display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', overflow: 'hidden' },
  modalHeader:  { padding: '22px 24px 16px', borderBottom: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle:   { fontSize: 16, fontWeight: 600, color: cv.text },
  modalBody:    { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  searchRow:    { display: 'flex', gap: 8 },
  modalInput:   { flex: 1, background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 10, padding: '10px 13px', fontSize: 13, color: cv.text, outline: 'none', fontFamily: 'inherit' },
  sendReqBtn:   { padding: '0 16px', borderRadius: 10, border: 'none', background: cv.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  reqCard:      { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: cv.elevated, border: `1px solid ${cv.border}` },
  reqName:      { flex: 1, fontSize: 13, fontWeight: 500, color: cv.text },
  reqBtn:       { padding: '5px 12px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
}

const initials = (name) => name ? name.slice(0, 2).toUpperCase() : '??'
const palette = ['#c97b5a','#7a8ec9','#7ab89a','#b97ab8','#c9a87a','#7ac9c9']
const colorFor = (id) => palette[(id?.charCodeAt(0) || 0) % palette.length]

export default function DMPage({ groups, activeGroup, onSelectGroup, onAddGroup, onGoDM, onGoSettings, screen, user }) {
  const [friends, setFriends]         = useState([]) // accepted friends
  const [requests, setRequests]       = useState([]) // pending requests TO me
  const [activeDM, setActiveDM]       = useState(null)
  const [, forceRender] = useReducer(x => x + 1, 0)
  useEffect(() => {
    const h = () => forceRender()
    window.addEventListener('vn-theme-change', h)
    return () => window.removeEventListener('vn-theme-change', h)
  }, [])

  const [messages, setMessages]       = useState([])
  const [msgInput, setMsgInput]       = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchUser, setSearchUser]   = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [sending, setSending]         = useState(false)
  const bottomRef = useRef(null)
  const myId = user?.id

  // ── Load friends & pending requests ─────────────────────
  useEffect(() => {
    if (!myId) return
    loadFriends()
    loadRequests()

    // Realtime: watch friend_requests for changes
    const ch = supabase.channel('friend-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => {
        loadFriends()
        loadRequests()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [myId])

  const loadFriends = async () => {
    const { data } = await supabase
      .from('friend_requests')
      .select('from_user, to_user, from_profile:profiles!friend_requests_from_user_fkey(id,username), to_profile:profiles!friend_requests_to_user_fkey(id,username)')
      .eq('status', 'accepted')
      .or(`from_user.eq.${myId},to_user.eq.${myId}`)

    if (data) {
      const list = data.map(r => r.from_user === myId ? r.to_profile : r.from_profile).filter(Boolean)
      setFriends(list)
      if (!activeDM && list.length > 0) setActiveDM(list[0].id)
    }
  }

  const loadRequests = async () => {
    const { data } = await supabase
      .from('friend_requests')
      .select('id, from_user, from_profile:profiles!friend_requests_from_user_fkey(id,username)')
      .eq('to_user', myId)
      .eq('status', 'pending')
    if (data) setRequests(data)
  }

  // ── Load DM messages when active friend changes ──────────
  useEffect(() => {
    if (!myId || !activeDM) return
    loadMessages()

    const ch = supabase.channel(`dm-${myId}-${activeDM}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages' }, (payload) => {
        const m = payload.new
        if ((m.from_user === myId && m.to_user === activeDM) ||
            (m.from_user === activeDM && m.to_user === myId)) {
          setMessages(prev => [...prev, m])
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [myId, activeDM])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const loadMessages = async () => {
    const { data } = await supabase
      .from('dm_messages')
      .select('*')
      .or(`and(from_user.eq.${myId},to_user.eq.${activeDM}),and(from_user.eq.${activeDM},to_user.eq.${myId})`)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  const sendMessage = async () => {
    if (!msgInput.trim() || !activeDM) return
    const text = msgInput.trim()
    setMsgInput('')
    await supabase.from('dm_messages').insert({ from_user: myId, to_user: activeDM, text })
  }

  // ── Friend request flow ───────────────────────────────────
  const searchForUser = async () => {
    setSearchError('')
    setSearchResult(null)
    if (!searchUser.trim()) return
    if (searchUser.trim() === (user?.username || user?.email?.split('@')[0])) {
      setSearchError("That's you 😄")
      return
    }
    const { data } = await supabase.from('profiles').select('id,username').eq('username', searchUser.trim()).single()
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
    setSearchResult(null)
    setSearchUser('')
    setSearchError('')
  }

  const respondRequest = async (id, status) => {
    await supabase.from('friend_requests').update({ status }).eq('id', id)
  }

  const contact = friends.find(f => f.id === activeDM)

  return (
    <div style={s.root}>
      <Titlebar />
      <div style={ss.layout}>
        <Sidebar groups={groups} activeGroup={activeGroup} onSelectGroup={onSelectGroup} onAddGroup={onAddGroup} onGoDM={onGoDM} onGoSettings={onGoSettings} screen="dm" user={user} />

        {/* DM sidebar */}
        <div style={ss.sidebar}>
          <div style={ss.sidebarHeader}>
            <span>DMs</span>
            <span style={{ cursor: 'pointer', fontSize: 18, color: colors.accent }} onClick={() => setShowAddModal(true)} title="Add friend">+</span>
          </div>

          {/* Pending requests section */}
          {requests.length > 0 && (
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: 10, color: colors.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Friend Requests</div>
              {requests.map(req => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: colorFor(req.from_profile?.id) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: colorFor(req.from_profile?.id), flexShrink: 0 }}>
                    {initials(req.from_profile?.username)}
                  </div>
                  <span style={{ flex: 1, fontSize: 12, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.from_profile?.username}</span>
                  <span style={{ ...ss.reqBtn, background: '#4caf8233', color: '#4caf82', fontSize: 11 }} onClick={() => respondRequest(req.id, 'accepted')}>✓</span>
                  <span style={{ ...ss.reqBtn, background: 'rgba(232,112,112,0.15)', color: '#e87070', fontSize: 11 }} onClick={() => respondRequest(req.id, 'declined')}>✕</span>
                </div>
              ))}
            </div>
          )}

          {/* Friends list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {friends.length === 0 && (
              <div style={{ padding: '20px 14px', fontSize: 12, color: colors.textDim, textAlign: 'center', lineHeight: 1.6 }}>
                No friends yet.<br />Press <b style={{ color: colors.accent }}>+</b> to add someone!
              </div>
            )}
            {friends.map(f => (
              <div key={f.id} style={{ ...ss.contact, ...(activeDM === f.id ? ss.contactActive : {}) }} onClick={() => setActiveDM(f.id)}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ ...ss.avatar, background: colorFor(f.id) + '33' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: colorFor(f.id) }}>{initials(f.username)}</span>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={ss.dmName}>{f.username}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        {contact ? (
          <div style={ss.chat}>
            <div style={ss.chatHeader}>
              <div style={{ ...ss.avatar, background: colorFor(contact.id) + '33', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: colorFor(contact.id) }}>{initials(contact.username)}</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{contact.username}</span>
            </div>
            <div style={ss.messages}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.from_user === myId ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
                  {msg.from_user !== myId && (
                    <div style={{ ...ss.avatar, width: 28, height: 28, background: colorFor(contact.id) + '33', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: colorFor(contact.id) }}>{initials(contact.username)}</span>
                    </div>
                  )}
                  <div style={{ ...ss.bubble, ...(msg.from_user === myId ? ss.bubbleMine : {}) }}>{msg.text}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div style={ss.inputWrap}>
              <input style={ss.input} placeholder={`Message ${contact.username}...`} value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()} />
              <button style={ss.sendBtn} onClick={sendMessage}>➤</button>
            </div>
          </div>
        ) : (
          <div style={{ ...ss.chat, ...ss.empty }}>
            <div style={{ fontSize: 32 }}>💬</div>
            <div style={{ fontSize: 14, color: colors.textDim }}>Add a friend to start chatting</div>
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddModal && (
        <div style={ss.overlay} onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div style={ss.modal}>
            <div style={ss.modalHeader}>
              <span style={ss.modalTitle}>Add a Friend</span>
              <span style={{ cursor: 'pointer', color: colors.textDim, fontSize: 13 }} onClick={() => setShowAddModal(false)}>✕</span>
            </div>
            <div style={ss.modalBody}>
              <div style={{ fontSize: 12, color: colors.textDim }}>Search by exact username to send a friend request.</div>

              {/* Search input */}
              <div style={ss.searchRow}>
                <input style={ss.modalInput} placeholder="Enter username..." value={searchUser}
                  onChange={e => { setSearchUser(e.target.value); setSearchResult(null); setSearchError('') }}
                  onKeyDown={e => e.key === 'Enter' && searchForUser()}
                  autoFocus />
                <button style={ss.sendReqBtn} onClick={searchForUser}>Search</button>
              </div>

              {searchError && <div style={{ fontSize: 12, color: '#e87070' }}>{searchError}</div>}

              {/* Search result */}
              {searchResult && (
                <div style={{ ...ss.reqCard, border: `1px solid ${colors.accentBorder}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: colorFor(searchResult.id) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: colorFor(searchResult.id) }}>
                    {initials(searchResult.username)}
                  </div>
                  <span style={ss.reqName}>{searchResult.username}</span>
                  <button style={{ ...ss.reqBtn, background: colors.accent, color: '#fff', opacity: sending ? 0.6 : 1 }} onClick={sendRequest} disabled={sending}>
                    {sending ? '...' : 'Send Request'}
                  </button>
                </div>
              )}

              {/* Incoming requests shown in modal too */}
              {requests.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: colors.textDim, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>Incoming Requests</div>
                  {requests.map(req => (
                    <div key={req.id} style={ss.reqCard}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: colorFor(req.from_profile?.id) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: colorFor(req.from_profile?.id) }}>
                        {initials(req.from_profile?.username)}
                      </div>
                      <span style={ss.reqName}>{req.from_profile?.username}</span>
                      <button style={{ ...ss.reqBtn, background: '#4caf8233', color: '#4caf82' }} onClick={() => respondRequest(req.id, 'accepted')}>Accept</button>
                      <button style={{ ...ss.reqBtn, background: 'rgba(232,112,112,0.15)', color: '#e87070' }} onClick={() => respondRequest(req.id, 'declined')}>Decline</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
