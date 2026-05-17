import { colors } from '../styles/theme'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
const winControl = (action) => { if (ipcRenderer) ipcRenderer.send(`window-${action}`) }

function WinBtn({ onClick, title, children, hoverBg = 'rgba(255,255,255,0.09)', danger }) {
  return (
    <div title={title} onClick={onClick}
      style={{ width: 46, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--vn-text-dim)', cursor: 'pointer', userSelect: 'none', transition: 'background 0.14s, color 0.14s', WebkitAppRegion: 'no-drag' }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? '#c42b1c' : hoverBg; e.currentTarget.style.color = '#fff' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--vn-text-dim)' }}
    >{children}</div>
  )
}

export default function Titlebar({ groupName, entryName, onCheckForUpdate }) {
  return (
    <div style={{
      height: 32,
      background: 'var(--vn-grad-titlebar, var(--vn-bg))',
      borderBottom: '1px solid var(--vn-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 0 0 12px',
      flexShrink: 0,
      WebkitAppRegion: 'drag',
      position: 'relative',
      boxShadow: '0 1px 0 rgba(255,255,255,0.03)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--vn-text-dim)', letterSpacing: '0.08em', fontWeight: 500 }}>
        VisperNote
      </span>

      {groupName && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
          <span style={{ fontSize: 11.5, color: 'var(--vn-text-mid)', fontFamily: 'Georgia, serif', letterSpacing: '0.04em' }}>{groupName}</span>
          {entryName && <>
            <span style={{ fontSize: 10, color: 'var(--vn-text-dim)', opacity: 0.5 }}>›</span>
            <span style={{ fontSize: 11, color: 'var(--vn-text-dim)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entryName}</span>
          </>}
        </div>
      )}

      <div style={{ display: 'flex', height: '100%' }}>
        <WinBtn onClick={() => onCheckForUpdate?.()} title="Check for Updates" hoverBg="rgba(167,139,250,0.18)">↻</WinBtn>
        <WinBtn onClick={() => winControl('minimize')} title="Minimize">&#8211;</WinBtn>
        <WinBtn onClick={() => winControl('maximize')} title="Maximize">&#9633;</WinBtn>
        <WinBtn onClick={() => winControl('close')} title="Close" danger>&#10005;</WinBtn>
      </div>
    </div>
  )
}
