import { colors } from '../styles/theme'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
const winControl = (action) => { if (ipcRenderer) ipcRenderer.send(`window-${action}`) }

function WinBtn({ onClick, title, children, hoverBg = 'rgba(255,255,255,0.08)' }) {
  return (
    <div
      title={title}
      onClick={onClick}
      style={{ 
        width: 46, 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        fontSize: 13, 
        color: colors.textDim, 
        cursor: 'pointer', 
        userSelect: 'none', 
        transition: 'background 0.15s' 
      }}
      onMouseEnter={e => { 
        e.currentTarget.style.background = hoverBg; 
        e.currentTarget.style.color = '#fff' 
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.background = 'transparent'; 
        e.currentTarget.style.color = colors.textDim 
      }}
    >
      {children}
    </div>
  )
}

export default function Titlebar({ groupName, entryName, onCheckForUpdate }) {
  return (
    <div style={{ 
      height: 32, 
      background: colors.surfaceAlt, 
      borderBottom: `1px solid ${colors.border}`, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      padding: '0 0 0 12px', 
      flexShrink: 0, 
      WebkitAppRegion: 'drag', 
      position: 'relative' 
    }}>
      
      <span style={{ fontSize: 12, color: colors.textDim, letterSpacing: '0.08em', fontWeight: 500 }}>
        VisperNote
      </span>

      {groupName && (
        <div style={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6, 
          pointerEvents: 'none' 
        }}>
          <span style={{ fontSize: 11.5, color: colors.textMid, fontFamily: 'Georgia, serif', letterSpacing: '0.04em' }}>
            {groupName}
          </span>
          {entryName && <>
            <span style={{ fontSize: 10, color: colors.textDim, opacity: 0.5 }}>›</span>
            <span style={{ 
              fontSize: 11, 
              color: colors.textDim, 
              maxWidth: 180, 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap' 
            }}>
              {entryName}
            </span>
          </>}
        </div>
      )}

      <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' }}>
        
        {/* Update Button - Left of Minimize */}
        <WinBtn 
          onClick={() => {
            console.log("🔄 Update button clicked!");   // ← Add this
            onCheckForUpdate?.();
          }} 
          title="Check for Updates"
          hoverBg="rgba(167, 139, 250, 0.15)"
        >
          ↻
        </WinBtn>

        <WinBtn onClick={() => winControl('minimize')} title="Minimize">&#8211;</WinBtn>
        <WinBtn onClick={() => winControl('maximize')} title="Maximize">&#9633;</WinBtn>
        <WinBtn onClick={() => winControl('close')} title="Close" hoverBg="#c42b1c">&#10005;</WinBtn>
      </div>
    </div>
  )
}
