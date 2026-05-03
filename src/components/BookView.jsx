import { useState, useRef, useEffect, useCallback } from 'react'
import { colors } from '../styles/theme'

const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

// Line height used for both the ruled lines and the textarea
const LINE_H = 28

// ── DIARY LAYOUT ─────────────────────────────────────────────
function DiaryLayout({ groupName }) {
  const [spreads, setSpreads] = useState([{ left: '', right: '' }])
  const [currentSpread, setCurrentSpread] = useState(0)
  const leftRef = useRef(null)
  const rightRef = useRef(null)

  const isFull = (el) => el && el.scrollHeight > el.clientHeight + 2

  const addNewSpread = useCallback(() => {
    setSpreads(prev => [...prev, { left: '', right: '' }])
    setCurrentSpread(prev => prev + 1)
  }, [])

  const handleKey = useCallback((side, e) => {
    const el = side === 'left' ? leftRef.current : rightRef.current
    const isTyping = e.key.length === 1 || e.key === 'Enter'
    if (!isTyping) return

    if (isFull(el)) {
      e.preventDefault()
      if (side === 'left') {
        rightRef.current?.focus()
      } else {
        // Right page full — new spread
        addNewSpread()
      }
    }
  }, [addNewSpread])

  const handleChange = useCallback((side, value) => {
    setSpreads(prev =>
      prev.map((s, i) => i === currentSpread ? { ...s, [side]: value } : s)
    )
    requestAnimationFrame(() => {
      const el = side === 'left' ? leftRef.current : rightRef.current
      if (!el || !isFull(el)) return
      let text = value
      while (text.length > 0 && isFull(el)) {
        text = text.slice(0, -1)
        el.value = text
      }
      setSpreads(prev =>
        prev.map((s, i) => i === currentSpread ? { ...s, [side]: text } : s)
      )
      if (side === 'left') rightRef.current?.focus()
      else addNewSpread()
    })
  }, [currentSpread, addNewSpread])

  useEffect(() => {
    setTimeout(() => leftRef.current?.focus(), 20)
  }, [currentSpread])

  const spread = spreads[currentSpread]
  const totalSpreads = spreads.length
  const leftPageNum = currentSpread * 2 + 1
  const rightPageNum = currentSpread * 2 + 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', background: '#1a1008', borderRadius: 20, padding: 6, boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.6)' }}>

        {/* Left page */}
        <div style={{ ...diaryPage, borderRadius: '14px 4px 4px 14px' }}>
          <div style={diaryDate}>Date : {today}</div>
          <textarea
            ref={leftRef}
            style={diaryText}
            placeholder="Begin writing your thoughts here..."
            value={spread.left}
            onKeyDown={e => handleKey('left', e)}
            onChange={e => handleChange('left', e.target.value)}
          />
          <div style={diaryFooter}>
            <button style={{ ...navBtn, opacity: currentSpread === 0 ? 0.3 : 1 }}
              onClick={() => setCurrentSpread(p => Math.max(0, p - 1))}
              disabled={currentSpread === 0}>←</button>
            <span style={pageNum2}>{leftPageNum}</span>
          </div>
        </div>

        {/* Spine */}
        <div style={{ width: 10, background: '#0e0a04', borderRadius: 4, flexShrink: 0, margin: '8px 0' }} />

        {/* Right page */}
        <div style={{ ...diaryPage, borderRadius: '4px 14px 14px 4px' }}>
          <div style={diaryDate}>Date : {today}</div>
          <textarea
            ref={rightRef}
            style={diaryText}
            placeholder="...continue on the next page."
            value={spread.right}
            onKeyDown={e => handleKey('right', e)}
            onChange={e => handleChange('right', e.target.value)}
          />
          <div style={diaryFooter}>
            <span style={pageNum2}>{rightPageNum}</span>
            <button style={{ ...navBtn, opacity: currentSpread >= totalSpreads - 1 ? 0.3 : 1 }}
              onClick={() => setCurrentSpread(p => Math.min(totalSpreads - 1, p + 1))}
              disabled={currentSpread >= totalSpreads - 1}>→</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={label}>📔 Diary — {groupName} &nbsp;·&nbsp; Spread {currentSpread + 1} of {totalSpreads}</div>
        {currentSpread === totalSpreads - 1 && (
          <button
            style={{ fontSize: 11, color: colors.accent, background: 'transparent', border: `1px solid ${colors.accentBorder}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
            onClick={addNewSpread}
          >+ New page</button>
        )}
      </div>
    </div>
  )
}

// ── LETTER LAYOUT ─────────────────────────────────────────────
function LetterLayout({ leftText, onLeftChange, groupName }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 480, background: '#f5f0e8', borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.5), 2px 2px 0 #d4c5a9', padding: '40px 44px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 520, position: 'relative' }}>
        {/* Letterhead */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #c4a882', paddingBottom: 16, marginBottom: 8 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, color: '#7a5c3a', fontStyle: 'italic' }}>To whomever it may concern,</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 11, color: '#a08060' }}>{today}</div>
        </div>
        <textarea
          style={{ flex: 1, fontFamily: 'Georgia, serif', fontSize: 14, color: '#3a2a1a', lineHeight: '28px', background: 'transparent', border: 'none', outline: 'none', resize: 'none', width: '100%', backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(160,128,96,0.2) 27px, rgba(160,128,96,0.2) 28px)', userSelect: 'text' }}
          placeholder="Dear friend,&#10;&#10;I wanted to reach out and say..."
          value={leftText}
          onChange={e => onLeftChange(e.target.value)}
        />
        {/* Signature area */}
        <div style={{ borderTop: '1px solid #c4a882', paddingTop: 16, fontFamily: 'Georgia, serif', fontSize: 13, color: '#7a5c3a', fontStyle: 'italic' }}>
          Sincerely,<br />
          <span style={{ fontSize: 16, marginTop: 8, display: 'block' }}>~ {groupName || 'the author'}</span>
        </div>
        {/* Paper fold effect */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 32px 32px 0', borderColor: `transparent #d4c5a9 transparent transparent` }} />
      </div>
      <div style={label}>✉️ Letter — {groupName}</div>
    </div>
  )
}

// ── SCRIPT LAYOUT ─────────────────────────────────────────────
function ScriptLayout({ leftText, onLeftChange, groupName }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 520, background: '#fafafa', borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', padding: '32px 0', minHeight: 520, display: 'flex', flexDirection: 'column' }}>
        {/* Script header */}
        <div style={{ textAlign: 'center', marginBottom: 24, padding: '0 48px' }}>
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: 13, color: '#222', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>{groupName || 'UNTITLED'}</div>
          <div style={{ fontFamily: 'Courier New, monospace', fontSize: 11, color: '#888', marginTop: 4 }}>Written by VisperNote</div>
          <div style={{ height: 1, background: '#ccc', marginTop: 16 }} />
        </div>
        <textarea
          style={{ flex: 1, fontFamily: 'Courier New, monospace', fontSize: 13, color: '#1a1a1a', lineHeight: '24px', background: 'transparent', border: 'none', outline: 'none', resize: 'none', width: '100%', padding: '0 48px', boxSizing: 'border-box', userSelect: 'text' }}
          placeholder={"FADE IN:\n\nINT. COFFEE SHOP - DAY\n\n\t\tCHARACTER\n\t(whispering)\n\tDialogue goes here...\n\n\t\t\t\t\t\t\t\t\tCUT TO:"}
          value={leftText}
          onChange={e => onLeftChange(e.target.value)}
        />
      </div>
      <div style={label}>📜 Script — {groupName}</div>
    </div>
  )
}

// ── PROJECT LAYOUT ─────────────────────────────────────────────
const COLUMNS = ['Ideas', 'Drafting', 'Review', 'Done']
const INIT_CARDS = {
  Ideas: ['Brainstorm opening scene', 'Character backstory'],
  Drafting: ['Chapter 1 draft'],
  Review: [],
  Done: ['Outline complete'],
}

function ProjectLayout({ groupName }) {
  const [cards, setCards] = useState(INIT_CARDS)
  const [adding, setAdding] = useState(null)
  const [newCard, setNewCard] = useState('')

  const addCard = (col) => {
    if (!newCard.trim()) { setAdding(null); return }
    setCards(p => ({ ...p, [col]: [...p[col], newCard.trim()] }))
    setNewCard('')
    setAdding(null)
  }

  const removeCard = (col, idx) => {
    setCards(p => ({ ...p, [col]: p[col].filter((_, i) => i !== idx) }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 820, overflowX: 'auto', paddingBottom: 8 }}>
        {COLUMNS.map(col => (
          <div key={col} style={{ flex: 1, minWidth: 180, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{col} <span style={{ color: colors.textDim, fontWeight: 400 }}>· {cards[col].length}</span></div>
            {cards[col].map((c, i) => (
              <div key={i} style={{ background: colors.elevated, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 12, color: colors.text, cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ flex: 1, lineHeight: 1.4 }}>{c}</span>
                <span style={{ color: colors.textDim, cursor: 'pointer', fontSize: 10, flexShrink: 0 }} onClick={() => removeCard(col, i)}>✕</span>
              </div>
            ))}
            {adding === col ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  autoFocus
                  style={{ background: colors.elevated, border: `1px solid ${colors.accent}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, color: colors.text, outline: 'none', resize: 'none', fontFamily: 'inherit', minHeight: 60 }}
                  placeholder="Card title..."
                  value={newCard}
                  onChange={e => setNewCard(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(col) } if (e.key === 'Escape') { setAdding(null); setNewCard('') } }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => addCard(col)} style={{ flex: 1, padding: '6px 0', background: colors.accent, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer' }}>Add</button>
                  <button onClick={() => { setAdding(null); setNewCard('') }} style={{ padding: '6px 10px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.textDim, fontSize: 12, cursor: 'pointer' }}>✕</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: colors.textDim, cursor: 'pointer', padding: '6px 8px', borderRadius: 6, textAlign: 'center' }} onClick={() => setAdding(col)}>+ Add card</div>
            )}
          </div>
        ))}
      </div>
      <div style={label}>🗂️ Project — {groupName}</div>
    </div>
  )
}

// ── SHARED STYLES ─────────────────────────────────────────────
// LINE_H must match both the background gradient repeat AND the textarea line-height
const diaryPage = {
  flex: 1, background: '#e8b49a',
  padding: '16px 18px 12px',
  display: 'flex', flexDirection: 'column',
  height: 480, width: 300,
  // Ruled lines: start exactly where textarea text starts
  // date header = 13px font + 8px marginBottom = ~30px, plus 16px top padding = 46px offset
  backgroundImage: `repeating-linear-gradient(transparent, transparent ${LINE_H - 1}px, rgba(180,100,70,0.35) ${LINE_H - 1}px, rgba(180,100,70,0.35) ${LINE_H}px)`,
  backgroundPositionY: 46,
}
const diaryDate = { fontFamily: 'Georgia, serif', fontSize: 13, color: '#c4816a', fontWeight: 600, marginBottom: 8, letterSpacing: '0.04em', lineHeight: `${LINE_H}px`, height: LINE_H }
const diaryText = {
  flex: 1,
  fontFamily: 'Georgia, serif',
  fontSize: 13,
  color: '#5a2a18',
  lineHeight: `${LINE_H}px`,
  background: 'transparent',
  border: 'none', outline: 'none',
  resize: 'none', width: '100%',
  fontStyle: 'italic',
  userSelect: 'text',
  overflow: 'hidden',
  padding: 0,
  margin: 0,
  // Align first text line exactly onto first rule
  paddingTop: 0,
}
const diaryFooter = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexShrink: 0 }
const navBtn = { width: 28, height: 28, borderRadius: '50%', background: 'rgba(90,42,24,0.15)', border: '1px solid rgba(90,42,24,0.2)', cursor: 'pointer', fontSize: 13, color: '#5a2a18' }
const pageNum2 = { fontFamily: 'Georgia, serif', fontSize: 11, color: '#c4816a' }
const label = { fontSize: 12, color: colors.textDim, letterSpacing: '0.06em' }

// ── MAIN EXPORT ───────────────────────────────────────────────
export default function BookView({ layout = 'diary', groupName, leftText, rightText, onLeftChange, onRightChange, pageNum = 1 }) {
  if (layout === 'letter') return <LetterLayout leftText={leftText} onLeftChange={onLeftChange} groupName={groupName} />
  if (layout === 'script') return <ScriptLayout leftText={leftText} onLeftChange={onLeftChange} groupName={groupName} />
  if (layout === 'project') return <ProjectLayout groupName={groupName} />
  return <DiaryLayout groupName={groupName} />
}
