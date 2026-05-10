import { useState, useEffect } from 'react'
import { colors } from '../styles/theme'

export default function UpdateModal({ isOpen, onClose, status, progress, version }) {
  const [show, setShow] = useState(false)
  const { ipcRenderer } = window.require ? window.require('electron') : {}

  useEffect(() => {
    if (isOpen) setShow(true)
    else setTimeout(() => setShow(false), 300)
  }, [isOpen])

  if (!isOpen && !show) return null

  const states = {
    checking:     { icon: '🔄', title: 'Checking for Updates', msg: 'Looking for the latest version...' },
    available:    { icon: '🚀', title: 'Update Available!', msg: `Version ${version || 'new'} is ready to download.` },
    'up-to-date': { icon: '🎉', title: "You're Up to Date!", msg: 'VisperNote is running the latest version.' },
    downloaded:   { icon: '✅', title: 'Update Ready', msg: 'Restarting in a few seconds to apply the update...' },
    error:        { icon: '⚠️', title: 'Update Error', msg: "Couldn't check for updates. Make sure you're online." },
    'dev-mode':   { icon: '🛠️', title: 'Dev Mode', msg: 'Auto-updates only work in the packaged (.exe) build.' },
  }

  const state = states[status] || states.checking

  return (
    <div style={ms.overlay}>
      <div style={ms.modal}>
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>{state.icon}</div>
        <h2 style={ms.title}>{state.title}</h2>
        <p style={ms.message}>{state.msg}</p>

        {status === 'checking' && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${colors.elevated}`, borderTopColor: colors.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {progress && status !== 'downloaded' && (
          <div style={{ margin: '16px 0' }}>
            <div style={{ height: 8, background: colors.elevated, borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${progress.percent}%`, height: '100%', background: `linear-gradient(90deg, ${colors.accent}, #67e8f9)`, transition: 'width 0.3s ease', borderRadius: 99 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textDim }}>
              <span>{progress.percent}%</span>
              <span>{Math.round((progress.transferred || 0) / 1024 / 1024)}MB / {Math.round((progress.total || 0) / 1024 / 1024)}MB</span>
              <span>{Math.round((progress.bytesPerSecond || 0) / 1024)} KB/s</span>
            </div>
          </div>
        )}

        {status === 'up-to-date' && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#4caf8222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#4caf82' }}>✓</div>
          </div>
        )}

        <div style={ms.buttons}>
          <button style={ms.secondaryBtn} onClick={onClose}>Close</button>
          {status === 'available' && (
            <button style={ms.primaryBtn} onClick={() => ipcRenderer?.send('download-update')}>
              ⬇️ Download Update
            </button>
          )}
          {status === 'downloaded' && (
            <button style={ms.primaryBtn} onClick={() => ipcRenderer?.send('quit-and-install')}>
              🔄 Restart & Install
            </button>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const ms = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  modal: { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 18, width: 400, padding: '32px 28px', color: colors.text, boxShadow: '0 24px 60px rgba(0,0,0,0.6)' },
  title: { fontSize: 19, fontWeight: 600, marginBottom: 8, textAlign: 'center' },
  message: { textAlign: 'center', color: colors.textMid, marginBottom: 8, lineHeight: 1.5, minHeight: 40 },
  buttons: { display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 },
  primaryBtn: { padding: '9px 22px', background: colors.accent, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
  secondaryBtn: { padding: '9px 22px', background: 'transparent', color: colors.textMid, border: `1px solid ${colors.border}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 },
}