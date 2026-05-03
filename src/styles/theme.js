// VisperNote — shared design tokens
export const colors = {
  bg:        '#0f0f13',
  surface:   '#16161d',
  panel:     '#13131a',
  elevated:  '#1e1e28',
  hover:     '#252530',
  border:    'rgba(255,255,255,0.07)',
  accent:    '#c97b5a',
  accentDim: 'rgba(201,123,90,0.15)',
  accentBorder: 'rgba(201,123,90,0.25)',
  text:      '#f0ebe6',
  textMid:   '#a09890',
  textDim:   '#6a6260',
  green:     '#4caf82',
  blue:      '#7a8ec9',
  teal:      '#7ab89a',
  purple:    '#b97ab8',
  gold:      '#c9a87a',
  // book page
  pageBg:    '#e8b49a',
  pageInk:   '#5a2a18',
  pageRuled: 'rgba(180,100,70,0.3)',
}

export const STATUS_COLOR = {
  online:  colors.green,
  idle:    '#f5a623',
  offline: colors.textDim,
}

export const font = {
  ui:    "'DM Sans', 'Segoe UI', sans-serif",
  serif: 'Georgia, serif',
}

// Reusable style fragments
export const s = {
  root: { fontFamily: font.ui, background: colors.bg, color: colors.text, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' },
  titlebar: { height: 32, background: colors.panel, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0, WebkitAppRegion: 'drag' },
  titlebarName: { fontSize: 12, color: colors.textDim, letterSpacing: '0.08em', fontWeight: 500 },
  winControls: { display: 'flex', gap: 6, WebkitAppRegion: 'no-drag' },
  winBtn: { width: 12, height: 12, borderRadius: '50%', cursor: 'pointer' },
}
