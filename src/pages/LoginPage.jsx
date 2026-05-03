import { colors, font } from '../styles/theme'

const ss = {
  root: { fontFamily: font.ui, background: colors.bg, color: colors.text, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { background: '#1a1a24', border: `1px solid ${colors.border}`, borderRadius: 24, padding: '40px 36px', width: 340, display: 'flex', flexDirection: 'column', gap: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.5)' },
  logo: { fontFamily: font.serif, fontSize: 28, color: colors.text, textAlign: 'center', fontWeight: 400 },
  sub: { fontSize: 12, color: colors.textDim, textAlign: 'center', marginTop: -14 },
  input: { background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 13, color: colors.text, outline: 'none', fontFamily: font.ui, width: '100%', boxSizing: 'border-box' },
  btn: { padding: '11px 0', borderRadius: 10, border: 'none', background: colors.accent, color: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: font.ui, fontWeight: 600 },
  footer: { fontSize: 11, color: colors.textDim, textAlign: 'center' },
}

export default function LoginPage({ onLogin }) {
  return (
    <div style={ss.root}>
      <div style={ss.card}>
        <div style={ss.logo}>VisperNote</div>
        <div style={ss.sub}>Where stories are shared</div>
        <input style={ss.input} placeholder="Username" />
        <input style={ss.input} placeholder="Password" type="password" />
        <button style={ss.btn} onClick={onLogin}>Sign In</button>
        <div style={ss.footer}>Don't have an account? <span style={{ color: colors.accent, cursor: 'pointer' }}>Sign up</span></div>
      </div>
    </div>
  )
}
