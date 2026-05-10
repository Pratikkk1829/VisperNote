import { useState, useReducer, useEffect } from 'react'
import { colors, cv } from '../styles/theme'

const ss = {
  sidebar: { width: 64, background: '#0d0d12', borderRight: `1px solid ${cv.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 0', gap: 8, flexShrink: 0 },
  dmBtn: { width: 40, height: 40, borderRadius: 12, background: cv.elevated, border: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', transition: 'all 0.2s' },
  dmBtnActive: { background: cv.accentDim, borderColor: cv.accent },
  divider: { width: 32, height: 1, background: cv.border, margin: '4px 0' },
  groupDot: { width: 40, height: 40, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s' },
  addGroup: { width: 40, height: 40, borderRadius: 14, border: `2px dashed ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', color: cv.textDim, transition: 'all 0.2s', background: 'transparent' },

  // User panel — bottom
  userPanel: {
    marginTop: 'auto',
    width: '100%',
    borderTop: `1px solid ${cv.border}`,
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  avatarWrap: {
    position: 'relative',
    cursor: 'pointer',
    width: 40, height: 40,
  },
  avatar: {
    width: 40, height: 40,
    borderRadius: '50%',
    background: cv.accent,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 700, color: '#fff',
    userSelect: 'none',
    overflow: 'hidden',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 11, height: 11,
    borderRadius: '50%',
    background: '#4caf82',
    border: '2px solid #0d0d12',
  },
  settingsBtn: {
    width: 28, height: 28,
    borderRadius: 8,
    background: 'transparent',
    border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 15,
    color: cv.textDim,
    transition: 'all 0.2s',
  },

  // Tooltip on hover
  tooltip: {
    position: 'absolute',
    left: 52,
    bottom: 0,
    background: '#18181f',
    border: `1px solid ${cv.border}`,
    borderRadius: 10,
    padding: '8px 12px',
    minWidth: 140,
    zIndex: 100,
    pointerEvents: 'none',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  tooltipName: { fontSize: 13, fontWeight: 600, color: cv.text, whiteSpace: 'nowrap' },
  tooltipStatus: { fontSize: 11, color: '#4caf82', marginTop: 2 },
}

export default function Sidebar({ groups, activeGroup, onSelectGroup, onAddGroup, onGoDM, onGoSettings, screen, user }) {
  const initials = (user?.display_name || user?.name || user?.username || user?.email || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const avatarSrc = user?.avatar || user?.avatar_url || null

  const [hoveredGroup, setHoveredGroup] = useState(null)
  const [, _forceRender] = useReducer(x => x + 1, 0)
  useEffect(() => {
    const _h = () => _forceRender()
    window.addEventListener('vn-theme-change', _h)
    return () => window.removeEventListener('vn-theme-change', _h)
  }, [])

  return (
    <div style={ss.sidebar}>
      {/* DMs — top */}
      <div
        style={{ ...ss.dmBtn, ...(screen === 'dm' ? ss.dmBtnActive : {}) }}
        onClick={onGoDM}
        title="Direct Messages"
        onMouseEnter={e => { if (screen !== 'dm') e.currentTarget.style.background = colors.hover }}
        onMouseLeave={e => { if (screen !== 'dm') e.currentTarget.style.background = colors.elevated }}
      >
        💬
      </div>

      <div style={ss.divider} />

      {/* Groups */}
      {groups.map(g => (
        <div
          key={g.id}
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoveredGroup(g.id)}
          onMouseLeave={() => setHoveredGroup(null)}
        >
          <div
            style={{
              ...ss.groupDot,
              background: activeGroup === g.id && screen === 'group' ? g.color + '33' : colors.elevated,
              borderColor: activeGroup === g.id && screen === 'group' ? g.color : 'transparent',
            }}
            onClick={() => onSelectGroup(g.id)}
          >
            {g.icon}
          </div>
          {hoveredGroup === g.id && (
            <div style={{ position: 'absolute', left: 52, top: '50%', transform: 'translateY(-50%)', background: '#18181f', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '5px 10px', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, color: colors.text, zIndex: 200, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
              {g.icon} {g.name}
            </div>
          )}
        </div>
      ))}

      {/* Add group */}
      <div
        style={ss.addGroup}
        onClick={onAddGroup}
        title="Create new diary"
        onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.color = colors.accent }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textDim }}
      >
        +
      </div>

      {/* ── User panel (Discord-style) ── */}
      <div style={ss.userPanel}>
        {/* Avatar + status dot */}
        <div
          style={ss.avatarWrap}
          title={user?.name || 'You'}
          onClick={onGoSettings}
        >
          <div style={ss.avatar}>
            {avatarSrc
              ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>
          <div style={ss.statusDot} />
        </div>

        {/* Settings button */}
        <button
          style={ss.settingsBtn}
          title="Settings"
          onClick={onGoSettings}
          onMouseEnter={e => { e.currentTarget.style.color = colors.text; e.currentTarget.style.background = colors.elevated }}
          onMouseLeave={e => { e.currentTarget.style.color = colors.textDim; e.currentTarget.style.background = 'transparent' }}
        >
          ⚙️
        </button>
      </div>
    </div>
  )
}
