import Titlebar from '../components/Titlebar'
import { colors, s } from '../styles/theme'

const SECTIONS = [
  { icon: '👤', label: 'Profile', desc: 'Change your name, bio, and avatar' },
  { icon: '🎨', label: 'Appearance', desc: 'Dark mode, themes, font size' },
  { icon: '🔔', label: 'Notifications', desc: 'Manage alerts and sounds' },
  { icon: '🔒', label: 'Privacy', desc: 'Control who can see your activity' },
  { icon: '🌐', label: 'Language', desc: 'Interface language and region' },
  { icon: '💾', label: 'Storage', desc: 'Manage your 20 GB of cloud space' },
]

const ss = {
  layout: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: 220, background: colors.surface, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', padding: '16px 0' },
  sidebarItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: colors.textMid, transition: 'background 0.15s' },
  main: { flex: 1, padding: 40, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' },
  heading: { fontSize: 22, fontWeight: 600, color: colors.text },
  card: { background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'background 0.15s' },
  cardIcon: { fontSize: 24, width: 44, height: 44, borderRadius: 12, background: colors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: 500, color: colors.text },
  cardDesc: { fontSize: 12, color: colors.textDim, marginTop: 2 },
  chevron: { marginLeft: 'auto', color: colors.textDim, fontSize: 16 },
}

export default function SettingsPage({ onGoHome }) {
  return (
    <div style={s.root}>
      <Titlebar />
      <div style={ss.layout}>
        <div style={ss.sidebar}>
          <div style={{ ...ss.sidebarItem, color: colors.accent, fontWeight: 500 }} onClick={onGoHome}>← Back</div>
          {SECTIONS.map(sec => (
            <div key={sec.label} style={ss.sidebarItem}
              onMouseEnter={e => e.currentTarget.style.background = colors.elevated}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {sec.icon} {sec.label}
            </div>
          ))}
        </div>
        <div style={ss.main}>
          <div style={ss.heading}>Settings</div>
          {SECTIONS.map(sec => (
            <div key={sec.label} style={ss.card}
              onMouseEnter={e => e.currentTarget.style.background = colors.hover}
              onMouseLeave={e => e.currentTarget.style.background = colors.elevated}>
              <div style={ss.cardIcon}>{sec.icon}</div>
              <div>
                <div style={ss.cardTitle}>{sec.label}</div>
                <div style={ss.cardDesc}>{sec.desc}</div>
              </div>
              <div style={ss.chevron}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
