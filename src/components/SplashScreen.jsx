import { useEffect, useState } from 'react'
import logoImg from '../assets/vispernote-logo.png'

const DEFAULT_PHRASES = [
  'Preparing your workspace',
  'Syncing your pages',
  'Restoring your session',
  'Opening VisperNote',
]

export default function SplashScreen({ onDone, message = null }) {
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [progress, setProgress] = useState(0)     // 0 to 100
  const [exiting, setExiting] = useState(false)

  const displayMessage = message || DEFAULT_PHRASES[phraseIdx]

  useEffect(() => {
    const phraseTimer = setInterval(() => {
      setPhraseIdx(i => (i + 1) % DEFAULT_PHRASES.length)
    }, 700)

    const start = Date.now()
    const duration = message ? 1500 : 2350

    const barTimer = setInterval(() => {
      const elapsed = Date.now() - start
      const cap = message ? 88 : 100
      const newProgress = Math.min((elapsed / duration) * cap, cap)
      setProgress(newProgress)

      if (newProgress >= cap) {
        clearInterval(barTimer)
      }
    }, 16)

    let exitTimer
    if (!message) {
      exitTimer = setTimeout(() => {
        setExiting(true)
        setTimeout(onDone, 480)
      }, 2500)
    }

    return () => {
      clearInterval(phraseTimer)
      clearInterval(barTimer)
      if (exitTimer) clearTimeout(exitTimer)
    }
  }, [onDone, message])

  useEffect(() => {
    if (!message) return
    setProgress(p => Math.max(p, 34))
  }, [message])

  return (
    <div style={{ ...ss.root, opacity: exiting ? 0 : 1, transition: 'opacity 0.45s ease' }}>
      <div style={ss.noise} />

      <div style={{ 
        ...ss.card, 
        transform: exiting ? 'scale(1.04)' : 'scale(1)', 
        opacity: exiting ? 0 : 1 
      }}>
        <div style={ss.logoWrap}>
          <img src={logoImg} alt="VisperNote" style={ss.logo} />
          <div style={ss.logoGlow} />
        </div>

        <div style={ss.barTrack}>
          <div style={{ 
            ...ss.barFill, 
            width: `${progress}%` 
          }} />
          <div style={{ 
            ...ss.barShine, 
            left: `${Math.max(0, progress - 8)}%` 
          }} />
        </div>

        <div style={ss.phrase}>
          {displayMessage}
        </div>
      </div>

      <style>{`
        @keyframes blobFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, -30px) scale(1.08); }
        }
        @keyframes logoPop {
          from { opacity: 0; transform: scale(0.75) rotate(-8deg); }
          to   { opacity: 1; transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  )
}

const ss = {
  root: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'radial-gradient(circle at 50% 44%, rgba(201,123,90,0.16), transparent 28%), #0a0a0f',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  noise: {
    position: 'absolute', inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Cfilter id='n' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E")`,
    pointerEvents: 'none',
  },

  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
    transition: 'all 0.45s cubic-bezier(0.23, 1, 0.32, 1)',
  },

  logoWrap: { 
    position: 'relative', 
    animation: 'logoPop 0.9s cubic-bezier(0.23,1,0.32,1) both' 
  },
  logo: {
    width: 280,
    filter: 'drop-shadow(0 0 45px rgba(167, 139, 250, 0.6))',
  },
  logoGlow: {
    position: 'absolute',
    inset: -50,
    background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)',
    pointerEvents: 'none',
  },

  barTrack: {
    width: 240, height: 3,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #a78bfa, #67e8f9)',
    boxShadow: '0 0 12px rgba(167, 139, 250, 0.7)',
    transition: 'width 0.08s linear',
  },
  barShine: {
    position: 'absolute', top: '-1px',
    width: 20, height: '5px',
    background: 'rgba(255,255,255,0.7)',
    filter: 'blur(4px)',
    transition: 'left 0.1s linear',
  },

  phrase: {
    fontSize: 13,
    letterSpacing: 0,
    color: 'rgba(255,255,255,0.48)',
    fontWeight: 600,
    minHeight: 22,
    textAlign: 'center',
  },
}
