import { font, colors } from '../styles/theme'

const ss = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  book: { display: 'flex', background: '#1a1008', borderRadius: 20, padding: 6, boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.6)' },
  page: { flex: 1, background: '#e8b49a', padding: '20px 18px 16px', display: 'flex', flexDirection: 'column', minHeight: 360, width: 260, backgroundImage: 'repeating-linear-gradient(transparent, transparent 28px, rgba(180,100,70,0.3) 28px, rgba(180,100,70,0.3) 29px)', backgroundPositionY: 58 },
  spine: { width: 10, background: '#0e0a04', borderRadius: 4, flexShrink: 0, margin: '8px 0' },
  pageDate: { fontFamily: font.serif, fontSize: 13, color: '#c4816a', fontWeight: 600, marginBottom: 16, letterSpacing: '0.04em' },
  pageContent: { flex: 1, fontFamily: font.serif, fontSize: 13, color: '#5a2a18', lineHeight: '29px', background: 'transparent', border: 'none', outline: 'none', resize: 'none', width: '100%', fontStyle: 'italic', userSelect: 'text' },
  pageFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pageNum: { fontFamily: font.serif, fontSize: 11, color: '#c4816a' },
  navBtn: { width: 28, height: 28, borderRadius: '50%', background: 'rgba(90,42,24,0.15)', border: '1px solid rgba(90,42,24,0.2)', cursor: 'pointer', fontSize: 13, color: '#5a2a18' },
  label: { fontSize: 12, color: colors.textDim, letterSpacing: '0.06em' },
}

const BOOK_ICON = { diary: '📔', letter: '✉️', script: '📜' }

export default function BookView({ bookType, groupName, leftText, rightText, onLeftChange, onRightChange, pageNum = 1 }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={ss.wrap}>
      <div style={ss.book}>
        {/* Left page */}
        <div style={{ ...ss.page, borderRadius: '14px 4px 4px 14px' }}>
          <div style={ss.pageDate}>Date : {today}</div>
          <textarea style={ss.pageContent} placeholder="Begin writing your thoughts here..." value={leftText} onChange={e => onLeftChange(e.target.value)} />
          <div style={ss.pageFooter}>
            <button style={ss.navBtn}>←</button>
            <span style={ss.pageNum}>{pageNum * 2 - 1}</span>
          </div>
        </div>

        <div style={ss.spine} />

        {/* Right page */}
        <div style={{ ...ss.page, borderRadius: '4px 14px 14px 4px' }}>
          <div style={ss.pageDate}>Date : {today}</div>
          <textarea style={ss.pageContent} placeholder="...continue on the next page." value={rightText} onChange={e => onRightChange(e.target.value)} />
          <div style={ss.pageFooter}>
            <span style={ss.pageNum}>{pageNum * 2}</span>
            <button style={ss.navBtn}>→</button>
          </div>
        </div>
      </div>
      <div style={ss.label}>{BOOK_ICON[bookType]} {bookType?.charAt(0).toUpperCase() + bookType?.slice(1)} — {groupName}</div>
    </div>
  )
}
