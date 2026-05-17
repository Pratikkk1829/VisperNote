import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { colors, cv, font } from '../styles/theme'

export default function LoginPage({ onLogin }) {
  const [mode, setMode]         = useState('signin')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!email.trim() || !password.trim()) { setError('Please fill in all fields.'); return }
    if (mode === 'signup' && !username.trim()) { setError('Please enter a username.'); return }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username.trim() } } // passed into trigger via raw_user_meta_data
        })
        if (err) throw err
        // Upsert in case trigger already ran
        if (data.user) {
          await supabase.from('profiles')
            .upsert({ id: data.user.id, username: username.trim() }, { onConflict: 'id' })
        }
        onLogin(data.user)
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        onLogin(data.user)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={ss.root}>
      <div style={ss.card}>
        <div style={ss.logo}>VisperNote</div>
        <div style={ss.sub}>Where stories are shared</div>

        {mode === 'signup' && (
          <input style={ss.input} placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        )}
        <input style={ss.input} placeholder="Email" type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        <input style={ss.input} placeholder="Password" type="password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />

        {error && <div style={ss.error}>{error}</div>}

        <button style={{ ...ss.btn, opacity: loading ? 0.6 : 1 }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>

        <div style={ss.footer}>
          {mode === 'signin'
            ? <>Don't have an account? <span style={ss.link} onClick={() => { setMode('signup'); setError('') }}>Sign up</span></>
            : <>Already have an account? <span style={ss.link} onClick={() => { setMode('signin'); setError('') }}>Sign in</span></>
          }
        </div>
      </div>
    </div>
  )
}

const ss = {
  root:   { fontFamily: font.ui, background: colors.bg, color: colors.text, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card:   { background: 'var(--vn-grad-surface)', border: `1px solid ${colors.border}`, borderRadius: 24, padding: '40px 36px', width: 340, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 32px 80px rgba(0,0,0,0.5)' },
  logo:   { fontFamily: font.serif, fontSize: 28, color: colors.text, textAlign: 'center', fontWeight: 400 },
  sub:    { fontSize: 12, color: colors.textDim, textAlign: 'center', marginTop: -8 },
  input:  { background: 'var(--vn-grad-card, var(--vn-elevated))', border: `1px solid ${colors.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 13, color: colors.text, outline: 'none', fontFamily: font.ui, width: '100%', boxSizing: 'border-box' },
  btn:    { padding: '11px 0', borderRadius: 10, border: 'none', background: 'var(--vn-grad-btn, var(--vn-accent))', color: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: font.ui, fontWeight: 600 },
  error:  { fontSize: 12, color: '#e87070', background: 'rgba(232,112,112,0.1)', border: '1px solid rgba(232,112,112,0.2)', borderRadius: 8, padding: '8px 12px' },
  footer: { fontSize: 11, color: colors.textDim, textAlign: 'center' },
  link:   { color: colors.accent, cursor: 'pointer' },
}
