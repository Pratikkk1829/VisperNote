import { useState, useReducer, useEffect, useRef } from 'react'
import { colors, cv } from '../styles/theme'

const ss = {
  sidebar: { width: 64, background: 'var(--vn-grad-sidebar, var(--vn-bg))', borderRight: `1px solid ${cv.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 0', gap: 8, flexShrink: 0, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' },
  dmBtn: { width: 40, height: 40, borderRadius: 12, background: 'var(--vn-grad-elevated, var(--vn-elevated))', border: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', transition: 'all 0.2s' },
  dmBtnActive: { background: 'var(--vn-grad-card, var(--vn-accent-dim))', borderColor: cv.accent, boxShadow: 'var(--vn-glow-accent)' },
  divider: { width: 32, height: 1, background: cv.border, margin: '4px 0' },
  groupDot: { width: 40, height: 40, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', border: '2px solid transparent', transition: 'transform 0.18s cubic-bezier(0.2,0.8,0.2,1), background 0.2s, border-color 0.2s, box-shadow 0.2s' },
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
    background: 'var(--vn-grad-btn, var(--vn-accent))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, fontWeight: 700, color: '#fff',
    userSelect: 'none',
    overflow: 'hidden',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 11, height: 11,
    borderRadius: '50%',
    background: '#4caf82',
    border: '2px solid var(--vn-bg)',
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
    background: 'var(--vn-grad-surface, var(--vn-surface))',
    border: `1px solid ${cv.border}`,
    borderRadius: 10,
    padding: '8px 12px',
    minWidth: 140,
    zIndex: 100,
    pointerEvents: 'none',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  tooltipName: { fontSize: 13, fontWeight: 600, color: cv.text, whiteSpace: 'nowrap', WebkitFontSmoothing: 'antialiased' },
  tooltipStatus: { fontSize: 11, color: '#4caf82', marginTop: 2 },
}

export default function Sidebar({ groups, activeGroup, onSelectGroup, onReorderGroups, onAddGroup, onGoDM, onGoSettings, screen, user }) {
  const initials = (user?.display_name || user?.name || user?.username || user?.email || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const avatarSrc = user?.avatar || user?.avatar_url || null

  const [hoveredGroup, setHoveredGroup] = useState(null)
  const [holdingGroup, setHoldingGroup] = useState(null)
  const [draggingGroup, setDraggingGroup] = useState(null)
  const [dragOverGroup, setDragOverGroup] = useState(null)
  const holdTimerRef = useRef(null)
  const didDragRef = useRef(false)
  const [, _forceRender] = useReducer(x => x + 1, 0)
  useEffect(() => {
    const _h = () => _forceRender()
    window.addEventListener('vn-theme-change', _h)
    return () => window.removeEventListener('vn-theme-change', _h)
  }, [])

  useEffect(() => {
    const clearHold = () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      setHoldingGroup(null)
    }
    const finishDrag = () => {
      clearHold()
      if (draggingGroup && dragOverGroup && draggingGroup !== dragOverGroup) {
        didDragRef.current = true
        onReorderGroups?.(draggingGroup, dragOverGroup)
      }
      setDraggingGroup(null)
      setDragOverGroup(null)
    }
    window.addEventListener('mouseup', finishDrag)
    window.addEventListener('blur', finishDrag)
    return () => {
      window.removeEventListener('mouseup', finishDrag)
      window.removeEventListener('blur', finishDrag)
      clearHold()
    }
  }, [draggingGroup, dragOverGroup, onReorderGroups])

  const beginHold = (id) => {
    didDragRef.current = false
    setHoldingGroup(id)
    holdTimerRef.current = setTimeout(() => {
      setDraggingGroup(id)
      setDragOverGroup(id)
      setHoldingGroup(null)
    }, 2000)
  }

  const cancelHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
    setHoldingGroup(null)
  }

  const selectGroup = (id) => {
    if (draggingGroup || didDragRef.current) {
      didDragRef.current = false
      return
    }
    onSelectGroup(id)
  }

  return (
    <div style={ss.sidebar}>
      <style>{`
        @keyframes vnHoldRing {
          from { stroke-dashoffset: 126; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes vnDragPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--vn-accent) 38%, transparent); }
          50% { box-shadow: 0 0 0 7px transparent; }
        }
        @keyframes vnTipPop {
          from { opacity: 0; transform: translateY(-50%) translateX(-4px) scale(0.94); }
          to { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); }
        }
      `}</style>
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
          onMouseEnter={() => { setHoveredGroup(g.id); if (draggingGroup) setDragOverGroup(g.id) }}
          onMouseLeave={() => setHoveredGroup(null)}
        >
          <div
            style={{
              ...ss.groupDot,
              background: activeGroup === g.id && screen === 'group' ? g.color + '33' : colors.elevated,
              borderColor: dragOverGroup === g.id && draggingGroup !== g.id ? colors.accent : activeGroup === g.id && screen === 'group' ? g.color : 'transparent',
              transform: draggingGroup === g.id ? 'scale(1.12)' : dragOverGroup === g.id && draggingGroup !== g.id ? 'translateY(2px) scale(1.06)' : 'scale(1)',
              opacity: draggingGroup && draggingGroup !== g.id ? 0.72 : 1,
              animation: draggingGroup === g.id ? 'vnDragPulse 1s ease-in-out infinite' : 'none',
            }}
            onMouseDown={(e) => { if (e.button === 0) beginHold(g.id) }}
            onMouseUp={cancelHold}
            onMouseLeave={() => { if (!draggingGroup) cancelHold() }}
            onClick={() => selectGroup(g.id)}
          >
            {g.icon}
          </div>
          {holdingGroup === g.id && (
            <svg width="48" height="48" viewBox="0 0 48 48" style={{ position: 'absolute', left: -4, top: -4, pointerEvents: 'none', transform: 'rotate(-90deg)' }}>
              <circle cx="24" cy="24" r="20" fill="none" stroke={colors.accent} strokeWidth="2" strokeDasharray="126" strokeDashoffset="126" style={{ animation: 'vnHoldRing 2s linear forwards' }} />
            </svg>
          )}
          {hoveredGroup === g.id && (
            <div style={{ position: 'absolute', left: 52, top: '50%', background: '#18181f', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '6px 10px', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, color: colors.text, zIndex: 200, pointerEvents: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', animation: 'vnTipPop 0.16s cubic-bezier(0.2,0.9,0.2,1) both' }}>
              {draggingGroup ? 'Drop here' : `${g.icon} ${g.name}`}
              {!draggingGroup && <div style={{ fontSize: 10, color: colors.textDim, fontWeight: 500, marginTop: 2 }}>Hold 2s to reorder</div>}
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
