import { colors } from '../styles/theme'

const ss = {
  sidebar: { width: 64, background: '#0d0d12', borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: 8, flexShrink: 0 },
  dmBtn: { width: 40, height: 40, borderRadius: 12, background: colors.elevated, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', transition: 'all 0.2s' },
  dmBtnActive: { background: colors.accentDim, borderColor: colors.accent },
  divider: { width: 32, height: 1, background: colors.border, margin: '4px 0' },
  groupDot: { width: 40, height: 40, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s' },
  addGroup: { width: 40, height: 40, borderRadius: 14, border: `2px dashed ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', color: colors.textDim, transition: 'all 0.2s', background: 'transparent' },
}

export default function Sidebar({ groups, activeGroup, onSelectGroup, onAddGroup, onGoDM, screen }) {
  return (
    <div style={ss.sidebar}>
      {/* DMs — top */}
      <div
        style={{ ...ss.dmBtn, ...(screen === 'dm' ? ss.dmBtnActive : {}) }}
        onClick={onGoDM}
        title="Direct Messages"
        onMouseEnter={e => { if (screen !== 'dm') e.currentTarget.style.background = colors.surfaceHover }}
        onMouseLeave={e => { if (screen !== 'dm') e.currentTarget.style.background = colors.elevated }}
      >
        💬
      </div>

      <div style={ss.divider} />

      {/* Groups */}
      {groups.map(g => (
        <div
          key={g.id}
          title={g.name}
          style={{
            ...ss.groupDot,
            background: activeGroup === g.id && screen === 'group' ? g.color + '33' : colors.elevated,
            borderColor: activeGroup === g.id && screen === 'group' ? g.color : 'transparent',
          }}
          onClick={() => onSelectGroup(g.id)}
        >
          {g.icon}
        </div>
      ))}

      {/* Add group */}
      <div
        style={ss.addGroup}
        onClick={onAddGroup}
        title="Create new group"
        onMouseEnter={e => { e.currentTarget.style.borderColor = colors.accent; e.currentTarget.style.color = colors.accent }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textDim }}
      >
        +
      </div>
    </div>
  )
}
