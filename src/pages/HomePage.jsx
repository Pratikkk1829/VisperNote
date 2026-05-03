import { useState } from 'react'
import Titlebar from '../components/Titlebar'
import Sidebar from '../components/Sidebar'
import { colors, font, s } from '../styles/theme'

const NAV_ITEMS = ['Diary', 'Home', 'Insert', 'Draw', 'Design']
const TOOLBAR_ITEMS = {
  Diary: [{ icon: '📔', label: 'New Entry' }, { icon: '🔒', label: 'Lock Entry' }, { icon: '🏷️', label: 'Tags' }, { icon: '📅', label: 'Date Jump' }, { icon: '🌙', label: 'Mood' }, { icon: '📎', label: 'Attach' }],
  Home: [{ icon: 'B', label: 'Bold', style: { fontWeight: 700 } }, { icon: 'I', label: 'Italic', style: { fontStyle: 'italic' } }, { icon: 'U', label: 'Underline', style: { textDecoration: 'underline' } }, { icon: 'A', label: 'Color' }, { icon: '≡', label: 'Align' }, { icon: 'Aa', label: 'Font' }],
  Insert: [{ icon: '🖼️', label: 'Image' }, { icon: '⬜', label: 'Shape' }, { icon: '🔗', label: 'Link' }, { icon: '📝', label: 'Text Box' }, { icon: '💬', label: 'Quote' }],
  Draw: [{ icon: '✏️', label: 'Pencil' }, { icon: '🖌️', label: 'Brush' }, { icon: '◻️', label: 'Eraser' }, { icon: '🎨', label: 'Color' }, { icon: '↩️', label: 'Undo' }],
  Design: [{ icon: '🌑', label: 'Dark' }, { icon: '🌕', label: 'Light' }, { icon: '🌸', label: 'Petal' }, { icon: '🌿', label: 'Forest' }, { icon: '🌊', label: 'Ocean' }],
}

const ss = {
  app: { display: 'flex', flex: 1, overflow: 'hidden' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: colors.bg },
  topnav: { height: 38, background: colors.surface, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 4px', gap: 2, flexShrink: 0 },
  navItem: { padding: '5px 12px', borderRadius: 6, fontSize: 12.5, color: colors.textDim, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' },
  navActive: { color: '#e8a882', background: colors.accentDim, fontWeight: 500 },
  toolbar: { height: 44, background: colors.panel, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 2, flexShrink: 0, overflowX: 'auto' },
  toolbarBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', minWidth: 44 },
  toolbarLabel: { fontSize: 9, color: colors.textDim, whiteSpace: 'nowrap', letterSpacing: '0.03em' },
  writingArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  homeScreen: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, width: '100%', height: '100%' },
  homeTitle: { fontFamily: font.serif, fontSize: 26, color: colors.text, fontWeight: 400, letterSpacing: '0.02em' },
  homeSubtitle: { fontSize: 13, color: colors.textDim, marginTop: 8, letterSpacing: '0.04em' },
  homeCards: { display: 'flex', gap: 16 },
  homeCard: { width: 160, background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '24px 16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'all 0.25s', position: 'relative', overflow: 'hidden' },
  cardIcon: { width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 },
  cardTitle: { fontSize: 14, fontWeight: 500, color: colors.text },
  cardDesc: { fontSize: 11, color: colors.textDim, textAlign: 'center', lineHeight: 1.5 },
  statusbar: { height: 24, background: colors.panel, borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 16, flexShrink: 0 },
  statusItem: { fontSize: 10.5, color: colors.textDim, display: 'flex', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: '50%', background: colors.green },
}

const FORMATS = [
  { type: 'diary', icon: '📔', label: 'Diary', desc: 'Personal entries, shared moments', color: '#c97b5a' },
  { type: 'letter', icon: '✉️', label: 'Letter', desc: 'Write to someone special', color: '#7a8ec9' },
  { type: 'script', icon: '📜', label: 'Script', desc: 'Co-write stories & scripts', color: '#7ab89a' },
]

export default function HomePage({ groups, activeGroup, onSelectGroup, onAddGroup, onGoDM, onOpenBook }) {
  const [activeNav, setActiveNav] = useState('Home')

  return (
    <div style={s.root}>
      <Titlebar />
      <div style={ss.app}>
        <Sidebar groups={groups} activeGroup={activeGroup} onSelectGroup={onSelectGroup} onAddGroup={onAddGroup} onGoHome={() => {}} onGoDM={onGoDM} screen="home" />
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
            <div style={ss.homeScreen}>
              <div style={{ textAlign: 'center' }}>
                <div style={ss.homeTitle}>What would you like to write?</div>
                <div style={ss.homeSubtitle}>choose a format to get started</div>
              </div>
              <div style={ss.homeCards}>
                {FORMATS.map(({ type, icon, label, desc, color }) => (
                  <div
                    key={type}
                    style={ss.homeCard}
                    onClick={() => onOpenBook(type)}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.background = colors.hover }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = colors.elevated }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '16px 16px 0 0' }} />
                    <div style={{ ...ss.cardIcon, background: color + '25' }}>{icon}</div>
                    <div style={ss.cardTitle}>{label}</div>
                    <div style={ss.cardDesc}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={ss.statusbar}>
        <div style={ss.statusItem}><div style={ss.statusDot} />3 collaborators online</div>
        <div style={{ ...ss.statusItem, marginLeft: 'auto' }}>VisperNote • Draft saved</div>
      </div>
    </div>
  )
}
