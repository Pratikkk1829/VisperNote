import { useState } from 'react'
import Titlebar from '../components/Titlebar'
import Sidebar from '../components/Sidebar'
import ChatPanel from '../components/ChatPanel'
import BookView from '../components/BookView'
import { colors, s } from '../styles/theme'

const NAV_ITEMS = ['Diary', 'Home', 'Insert', 'Draw', 'Design', 'Transitions', 'View']
const TOOLBAR_ITEMS = {
  Diary: [{ icon: '📔', label: 'New Entry' }, { icon: '🔒', label: 'Lock' }, { icon: '🏷️', label: 'Tags' }, { icon: '📅', label: 'Date' }, { icon: '🌙', label: 'Mood' }, { icon: '📎', label: 'Attach' }],
  Home: [{ icon: 'B', label: 'Bold', style: { fontWeight: 700 } }, { icon: 'I', label: 'Italic', style: { fontStyle: 'italic' } }, { icon: 'U', label: 'Underline', style: { textDecoration: 'underline' } }, { icon: 'A', label: 'Color' }, { icon: 'Aa', label: 'Font' }],
  Insert: [{ icon: '🖼️', label: 'Image' }, { icon: '🔗', label: 'Link' }, { icon: '📝', label: 'Text Box' }, { icon: '💬', label: 'Quote' }],
  Draw: [{ icon: '✏️', label: 'Pencil' }, { icon: '🖌️', label: 'Brush' }, { icon: '🎨', label: 'Color' }, { icon: '↩️', label: 'Undo' }],
  Design: [{ icon: '🌑', label: 'Dark' }, { icon: '🌕', label: 'Light' }, { icon: '🌸', label: 'Petal' }, { icon: '🌿', label: 'Forest' }, { icon: '🌊', label: 'Ocean' }],
  Transitions: [{ icon: '↔️', label: 'Slide' }, { icon: '✨', label: 'Fade' }, { icon: '💫', label: 'Zoom' }],
  View: [{ icon: '🔍', label: 'Zoom In' }, { icon: '🔎', label: 'Zoom Out' }, { icon: '📐', label: 'Grid' }],
}

const INIT_MESSAGES = [
  { id: 1, from: 'Alex', text: 'should we start from the beginning?', mine: false },
  { id: 2, from: 'You', text: "let's continue from page 3!", mine: true },
  { id: 3, from: 'Sam', text: "sounds good ✨ I'll write next", mine: false },
]

const ss = {
  app: { display: 'flex', flex: 1, overflow: 'hidden' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: colors.bg },
  topnav: { height: 38, background: colors.surface, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 4px', gap: 2, flexShrink: 0, overflowX: 'auto' },
  navItem: { padding: '5px 12px', borderRadius: 6, fontSize: 12.5, color: colors.textDim, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' },
  navActive: { color: '#e8a882', background: colors.accentDim, fontWeight: 500 },
  toolbar: { height: 44, background: colors.panel, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 2, flexShrink: 0, overflowX: 'auto' },
  toolbarBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', minWidth: 44 },
  toolbarLabel: { fontSize: 9, color: colors.textDim, whiteSpace: 'nowrap', letterSpacing: '0.03em' },
  writingArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'hidden' },
  statusbar: { height: 24, background: colors.panel, borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 16, flexShrink: 0 },
  statusItem: { fontSize: 10.5, color: colors.textDim, display: 'flex', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: '50%', background: colors.green },
}

export default function GroupPage({ groups, activeGroup, onSelectGroup, onAddGroup, onGoHome, onGoDM, bookType }) {
  const [activeNav, setActiveNav] = useState('Diary')
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [messages, setMessages] = useState(INIT_MESSAGES)
  const [chatMsg, setChatMsg] = useState('')

  const group = groups.find(g => g.id === activeGroup)

  const sendChat = () => {
    if (!chatMsg.trim()) return
    setMessages(p => [...p, { id: Date.now(), from: 'You', text: chatMsg, mine: true }])
    setChatMsg('')
  }

  return (
    <div style={s.root}>
      <Titlebar />
      <div style={ss.app}>
        <Sidebar groups={groups} activeGroup={activeGroup} onSelectGroup={onSelectGroup} onAddGroup={onAddGroup} onGoHome={onGoHome} onGoDM={onGoDM} screen="group" />
        <ChatPanel
          groupName={group?.name}
          members={[['Y', '#c97b5a'], ['A', '#7a8ec9'], ['S', '#7ab89a']]}
          messages={messages}
          chatMsg={chatMsg}
          onMsgChange={setChatMsg}
          onSend={sendChat}
        />
        <div style={ss.main}>
          <div style={ss.topnav}>
            {NAV_ITEMS.map(item => (
              <div key={item} style={{ ...ss.navItem, ...(activeNav === item ? ss.navActive : {}) }} onClick={() => setActiveNav(item)}>{item}</div>
            ))}
          </div>
          <div style={ss.toolbar}>
            {(TOOLBAR_ITEMS[activeNav] || []).map((tool, i) => (
              <div key={i} style={ss.toolbarBtn} title={tool.label}>
                <span style={{ fontSize: 14, ...(tool.style || {}) }}>{tool.icon}</span>
                <span style={ss.toolbarLabel}>{tool.label}</span>
              </div>
            ))}
          </div>
          <div style={ss.writingArea}>
            <BookView
              bookType={bookType}
              groupName={group?.name || 'Untitled Group'}
              leftText={leftText}
              rightText={rightText}
              onLeftChange={setLeftText}
              onRightChange={setRightText}
            />
          </div>
        </div>
      </div>
      <div style={ss.statusbar}>
        <div style={ss.statusItem}><div style={ss.statusDot} />3 collaborators online</div>
        <div style={ss.statusItem}>Page 1</div>
        <div style={{ ...ss.statusItem, marginLeft: 'auto' }}>VisperNote • {group?.name} • Draft saved</div>
      </div>
    </div>
  )
}
