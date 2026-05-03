import { useState, useEffect } from 'react'
import Titlebar from '../components/Titlebar'
import Sidebar from '../components/Sidebar'
import ChatPanel from '../components/ChatPanel'
import BookView from '../components/BookView'
import { colors } from '../styles/theme'

const NAV_ITEMS = ['Entries', 'Home', 'Insert', 'Draw', 'Design', 'Transitions', 'Animations', 'Slide Show', 'Record', 'View']

const TOOLBAR_ITEMS = {
  Entries: [{ icon: '📔', label: 'New Entry' }, { icon: '🔒', label: 'Lock' }, { icon: '🏷️', label: 'Tags' }, { icon: '📅', label: 'Date' }, { icon: '🌙', label: 'Mood' }, { icon: '📎', label: 'Attach' }],
  Home: [{ icon: 'B', label: 'Bold', style: { fontWeight: 700 } }, { icon: 'I', label: 'Italic', style: { fontStyle: 'italic' } }, { icon: 'U', label: 'Underline', style: { textDecoration: 'underline' } }, { icon: 'S', label: 'Strike', style: { textDecoration: 'line-through' } }, { icon: 'A', label: 'Color' }, { icon: '≡', label: 'Align' }, { icon: 'Aa', label: 'Font' }],
  Insert: [{ icon: '🖼️', label: 'Image' }, { icon: '⬜', label: 'Shape' }, { icon: '📊', label: 'Chart' }, { icon: '🔗', label: 'Link' }, { icon: '📝', label: 'Text Box' }, { icon: '💬', label: 'Quote' }, { icon: '➗', label: 'Divider' }],
  Draw: [{ icon: '✏️', label: 'Pencil' }, { icon: '🖊️', label: 'Pen' }, { icon: '🖌️', label: 'Brush' }, { icon: '◻️', label: 'Eraser' }, { icon: '🎨', label: 'Color' }, { icon: '↩️', label: 'Undo' }, { icon: '↪️', label: 'Redo' }],
  Design: [{ icon: '🌑', label: 'Dark' }, { icon: '🌕', label: 'Light' }, { icon: '🌸', label: 'Petal' }, { icon: '🌿', label: 'Forest' }, { icon: '🌊', label: 'Ocean' }, { icon: '🔥', label: 'Ember' }, { icon: '❄️', label: 'Frost' }],
  Transitions: [{ icon: '↔️', label: 'Slide' }, { icon: '🔄', label: 'Flip' }, { icon: '🌀', label: 'Spiral' }, { icon: '✨', label: 'Fade' }, { icon: '💫', label: 'Zoom' }],
  Animations: [{ icon: '▶️', label: 'Play' }, { icon: '⏸️', label: 'Pause' }, { icon: '⏹️', label: 'Stop' }, { icon: '🎬', label: 'In' }, { icon: '🎭', label: 'Out' }],
  'Slide Show': [{ icon: '▶️', label: 'Present' }, { icon: '⏭️', label: 'Next' }, { icon: '⏮️', label: 'Prev' }, { icon: '🖥️', label: 'Fullscreen' }],
  Record: [{ icon: '⏺️', label: 'Record' }, { icon: '🎙️', label: 'Voice' }, { icon: '📹', label: 'Video' }, { icon: '⏹️', label: 'Stop' }],
  View: [{ icon: '🔍', label: 'Zoom In' }, { icon: '🔎', label: 'Zoom Out' }, { icon: '📐', label: 'Grid' }, { icon: '📏', label: 'Ruler' }, { icon: '🗂️', label: 'Panels' }],
}

// Dummy entries per group
const DUMMY_ENTRIES = {
  1: [{ id: 1, title: 'First Day of Summer', date: 'May 1, 2026', preview: 'Today was the most beautiful day...' }, { id: 2, title: 'The Beach Walk', date: 'May 2, 2026', preview: 'We walked along the shore at dusk...' }, { id: 3, title: 'Fireflies', date: 'May 3, 2026', preview: 'The night was alive with tiny lights...' }],
  2: [{ id: 1, title: 'Opening Scene', date: 'Apr 28, 2026', preview: 'FADE IN: INT. COFFEE SHOP - DAY...' }],
  3: [{ id: 1, title: 'Ocean Thoughts', date: 'Apr 30, 2026', preview: 'There is something about the sea...' }],
}

const INIT_MSGS = [
  { id: 1, from: 'Alex', text: 'should we start from the beginning?', mine: false },
  { id: 2, from: 'You', text: "let's continue from page 3!", mine: true },
  { id: 3, from: 'Sam', text: "sounds good ✨ I'll write next", mine: false },
]

export default function GroupPage({ groups, activeGroup, onSelectGroup, onAddGroup, onGoDM, screen }) {
  const [activeNav, setActiveNav] = useState('Entries')
  const [activeEntry, setActiveEntry] = useState(1)
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [messages, setMessages] = useState(INIT_MSGS)
  const [chatMsg, setChatMsg] = useState('')
  const [viewingEntries, setViewingEntries] = useState(true)
  const [bookScale, setBookScale] = useState(1.0)

  const group = groups.find(g => g.id === activeGroup) || groups[0]
  const entries = DUMMY_ENTRIES[activeGroup] || []

  // Ctrl+= zoom in (10%), Ctrl+- zoom out (5% below 100%, 10% above), Ctrl+0 reset
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        setBookScale(s => Math.min(2.0, Math.round((s + 0.1) * 100) / 100))
      } else if (e.key === '-') {
        e.preventDefault()
        setBookScale(s => {
          const step = s <= 1.0 ? 0.05 : 0.1
          return Math.max(0.3, Math.round((s - step) * 100) / 100)
        })
      } else if (e.key === '0') {
        e.preventDefault()
        setBookScale(1.0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sendChat = () => {
    if (!chatMsg.trim()) return
    setMessages(p => [...p, { id: Date.now(), from: 'You', text: chatMsg, mine: true }])
    setChatMsg('')
  }

  const handleNavClick = (item) => {
    setActiveNav(item)
    if (item === 'Entries') setViewingEntries(true)
    else setViewingEntries(false)
  }

  const openEntry = (id) => {
    setActiveEntry(id)
    setViewingEntries(false)
    setLeftText('')
    setRightText('')
  }

  return (
    <div style={s.root}>
      <Titlebar />
      <div style={s.body}>
        <Sidebar groups={groups} activeGroup={activeGroup} onSelectGroup={onSelectGroup} onAddGroup={onAddGroup} onGoDM={onGoDM} screen={screen} />

        {/* Chat panel sits OUTSIDE main so navbar never covers it */}
        <ChatPanel
          groupName={group?.name}
          members={[['Y', '#c97b5a'], ['A', '#7a8ec9'], ['S', '#7ab89a']]}
          messages={messages}
          chatMsg={chatMsg}
          onMsgChange={setChatMsg}
          onSend={sendChat}
        />

        {/* Main writing column — navbar + toolbar stack only here */}
        <div style={s.main}>
          {/* Navbar */}
          <div style={s.topnav}>
            {NAV_ITEMS.map(item => (
              <div key={item} style={{ ...s.navItem, ...(activeNav === item ? s.navActive : {}) }} onClick={() => handleNavClick(item)}>{item}</div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={s.toolbar}>
            {(TOOLBAR_ITEMS[activeNav] || []).map((tool, i) => (
              <div key={i} style={s.toolBtn} title={tool.label}>
                <span style={{ fontSize: 14, ...(tool.style || {}) }}>{tool.icon}</span>
                <span style={s.toolLabel}>{tool.label}</span>
              </div>
            ))}
          </div>

          {/* Writing area */}
          <div style={s.writing}>
            {viewingEntries ? (
              <div style={s.entriesView}>
                <div style={s.entriesHeader}>
                  <div style={s.entriesTitle}>{group?.icon} {group?.name}</div>
                  <div style={s.entriesSubtitle}>{entries.length} entries</div>
                </div>
                <div style={s.entriesList}>
                  {entries.map(e => (
                    <div key={e.id} style={s.entryCard} onClick={() => openEntry(e.id)}
                      onMouseEnter={el => el.currentTarget.style.background = colors.hover}
                      onMouseLeave={el => el.currentTarget.style.background = colors.surface}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={s.entryTitle}>{e.title}</div>
                        <div style={s.entryDate}>{e.date}</div>
                      </div>
                      <div style={s.entryPreview}>{e.preview}</div>
                    </div>
                  ))}
                  <div style={s.newEntryCard} onClick={() => openEntry(Date.now())}>
                    <span style={{ fontSize: 20 }}>+</span>
                    <span style={{ fontSize: 13, color: colors.textDim }}>New Entry</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                transform: `scale(${bookScale})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease',
              }}>
                <BookView
                  layout={group?.layout || 'diary'}
                  groupName={group?.name}
                  leftText={leftText}
                  rightText={rightText}
                  onLeftChange={setLeftText}
                  onRightChange={setRightText}
                  pageNum={activeEntry}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={s.statusbar}>
        <div style={s.statusItem}><div style={s.statusDot} />3 collaborators online</div>
        <div style={s.statusItem}>Layout: {group?.layout || 'diary'}</div>
        {bookScale !== 1.0 && <div style={{ ...s.statusItem, color: colors.accent }}>Book {Math.round(bookScale * 100)}%</div>}
        <div style={{ ...s.statusItem, marginLeft: 'auto' }}>VisperNote • Draft saved</div>
      </div>
    </div>
  )
}

const s = {
  root: { fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: colors.bg, color: colors.text, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  topnav: { height: 38, background: colors.surface, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 4px', gap: 2, flexShrink: 0, overflowX: 'auto' },
  navItem: { padding: '5px 12px', borderRadius: 6, fontSize: 12.5, color: colors.textDim, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' },
  navActive: { color: '#e8a882', background: colors.accentDim, fontWeight: 500 },
  toolbar: { height: 44, background: colors.surfaceAlt, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 2, flexShrink: 0, overflowX: 'auto' },
  toolBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', minWidth: 44 },
  toolLabel: { fontSize: 9, color: colors.textDim, whiteSpace: 'nowrap' },
  content: { flex: 1, display: 'flex', overflow: 'hidden' },
  writing: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto' },

  // entries view
  entriesView: { width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 },
  entriesHeader: { display: 'flex', flexDirection: 'column', gap: 4 },
  entriesTitle: { fontFamily: 'Georgia, serif', fontSize: 22, color: colors.text, fontWeight: 400 },
  entriesSubtitle: { fontSize: 12, color: colors.textDim },
  entriesList: { display: 'flex', flexDirection: 'column', gap: 10 },
  entryCard: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'background 0.15s', display: 'flex', flexDirection: 'column', gap: 6 },
  entryTitle: { fontSize: 14, fontWeight: 500, color: colors.text },
  entryDate: { fontSize: 11, color: colors.textDim },
  entryPreview: { fontSize: 12, color: colors.textMuted, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  newEntryCard: { background: 'transparent', border: `1px dashed ${colors.border}`, borderRadius: 14, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, color: colors.textDim, transition: 'all 0.15s' },

  // status
  statusbar: { height: 24, background: colors.surfaceAlt, borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 16, flexShrink: 0 },
  statusItem: { fontSize: 10.5, color: colors.textDim, display: 'flex', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: '50%', background: '#4caf82' },
}
