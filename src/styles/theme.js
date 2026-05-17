// VisperNote — shared design tokens
// Active theme is stored in localStorage as 'vn_theme'

const THEME_DEFS = {
  default: {
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
  },
  midnight_aurora: {
    bg:        '#0B0C10',
    surface:   '#111318',
    panel:     '#0d0e12',
    elevated:  '#181a20',
    hover:     '#1e2028',
    border:    'rgba(0,255,198,0.1)',
    accent:    '#00FFC6',
    accentDim: 'rgba(0,255,198,0.12)',
    accentBorder: 'rgba(0,255,198,0.28)',
    text:      '#EAEAEA',
    textMid:   '#a0b0b0',
    textDim:   '#5a7070',
  },
  obsidian_whisper: {
    bg:        '#121212',
    surface:   '#181818',
    panel:     '#141414',
    elevated:  '#202020',
    hover:     '#282828',
    border:    'rgba(255,255,255,0.08)',
    accent:    '#5DADEC',
    accentDim: 'rgba(93,173,236,0.13)',
    accentBorder: 'rgba(93,173,236,0.28)',
    text:      '#F5F5F5',
    textMid:   '#C0C0C0',
    textDim:   '#707070',
  },
  velvet_night: {
    bg:        '#1E0F2F',
    surface:   '#261540',
    panel:     '#1a0d28',
    elevated:  '#2e1a48',
    hover:     '#362055',
    border:    'rgba(181,126,220,0.12)',
    accent:    '#E0AFA0',
    accentDim: 'rgba(224,175,160,0.13)',
    accentBorder: 'rgba(224,175,160,0.28)',
    text:      '#D8D8D8',
    textMid:   '#B57EDC',
    textDim:   '#7a5a9a',
  },
  shadow_neon: {
    bg:        '#000000',
    surface:   '#0a0a0a',
    panel:     '#050505',
    elevated:  '#111111',
    hover:     '#1a1a1a',
    border:    'rgba(57,255,20,0.12)',
    accent:    '#39FF14',
    accentDim: 'rgba(57,255,20,0.1)',
    accentBorder: 'rgba(57,255,20,0.25)',
    text:      '#FFFFFF',
    textMid:   '#cccccc',
    textDim:   '#666666',
  },
}

function loadTheme() {
  try {
    const id = localStorage.getItem('vn_theme') || 'default'
    return THEME_DEFS[id] || THEME_DEFS.default
  } catch { return THEME_DEFS.default }
}

// Mutable colors object — updated in-place when theme changes
export const colors = { ...loadTheme() }

// Extra aliases used across codebase
colors.textMuted  = colors.textDim
colors.surfaceAlt = colors.elevated
colors.surfaceHover = colors.hover
colors.green  = '#4caf82'
colors.blue   = '#7a8ec9'
colors.teal   = '#7ab89a'
colors.purple = '#b97ab8'
colors.gold   = '#c9a87a'
colors.pageBg   = '#e8b49a'
colors.pageInk  = '#5a2a18'
colors.pageRuled = 'rgba(180,100,70,0.3)'

// CSS-var-backed proxy — reading any theme key returns a CSS variable reference
// so module-scope style objects automatically reflect theme changes
export const cv = new Proxy({}, {
  get(_, key) {
    const varMap = {
      bg: '--vn-bg', surface: '--vn-surface', panel: '--vn-panel',
      elevated: '--vn-elevated', hover: '--vn-hover', border: '--vn-border',
      accent: '--vn-accent', accentDim: '--vn-accent-dim', accentBorder: '--vn-accent-border',
      text: '--vn-text', textMid: '--vn-text-mid', textDim: '--vn-text-dim',
      textMuted: '--vn-text-dim', surfaceAlt: '--vn-elevated', surfaceHover: '--vn-hover',
      gradSidebar: '--vn-grad-sidebar', gradSurface: '--vn-grad-surface',
      gradElevated: '--vn-grad-elevated', gradAccent: '--vn-grad-accent',
      gradBtn: '--vn-grad-btn', gradTitlebar: '--vn-grad-titlebar',
      gradCard: '--vn-grad-card', glowAccent: '--vn-glow-accent',
    }
    return varMap[key] ? `var(${varMap[key]})` : colors[key]
  }
})

function injectCSSVars(def) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--vn-bg',           def.bg)
  root.style.setProperty('--vn-surface',       def.surface)
  root.style.setProperty('--vn-panel',         def.panel)
  root.style.setProperty('--vn-elevated',      def.elevated)
  root.style.setProperty('--vn-hover',         def.hover)
  root.style.setProperty('--vn-border',        def.border)
  root.style.setProperty('--vn-accent',        def.accent)
  root.style.setProperty('--vn-accent-dim',    def.accentDim)
  root.style.setProperty('--vn-accent-border', def.accentBorder)
  root.style.setProperty('--vn-text',          def.text)
  root.style.setProperty('--vn-text-mid',      def.textMid)
  root.style.setProperty('--vn-text-dim',      def.textDim)

  // Gradient helpers — derived from the theme accent + surfaces
  root.style.setProperty('--vn-grad-sidebar',  `linear-gradient(180deg, ${def.bg} 0%, color-mix(in srgb, ${def.surface} 97%, ${def.accent} 3%) 100%)`)
  root.style.setProperty('--vn-grad-surface',  `${def.surface}`)
  root.style.setProperty('--vn-grad-elevated', `${def.elevated}`)
  root.style.setProperty('--vn-grad-accent',   `linear-gradient(135deg, ${def.accent} 0%, color-mix(in srgb, ${def.accent} 85%, #fff 15%) 100%)`)
  root.style.setProperty('--vn-grad-btn',      `linear-gradient(160deg, color-mix(in srgb, ${def.accent} 95%, #fff 5%) 0%, ${def.accent} 100%)`)
  root.style.setProperty('--vn-grad-titlebar', `${def.panel}`)
  root.style.setProperty('--vn-grad-card',     `${def.elevated}`)
  root.style.setProperty('--vn-glow-accent',   `0 0 8px color-mix(in srgb, ${def.accent} 12%, transparent)`)
  root.style.setProperty('--vn-accent-raw',    def.accent)
}

// Inject on load
if (typeof window !== 'undefined') {
  injectCSSVars(loadTheme())
}

export function applyTheme(id) {
  const def = THEME_DEFS[id] || THEME_DEFS.default
  Object.assign(colors, def)
  colors.textMuted    = colors.textDim
  colors.surfaceAlt   = colors.elevated
  colors.surfaceHover = colors.hover
  injectCSSVars(def)
  try { localStorage.setItem('vn_theme', id) } catch {}
  window.dispatchEvent(new CustomEvent('vn-theme-change', { detail: { id } }))
}

export const THEMES = [
  { id: 'default',          label: 'VisperNote',      emoji: '🪶', desc: 'The classic warm dark theme' },
  { id: 'midnight_aurora',  label: 'Midnight Aurora', emoji: '🌊', desc: 'Deep navy with electric teal' },
  { id: 'obsidian_whisper', label: 'Obsidian Whisper',emoji: '🌙', desc: 'Charcoal black with misty blue' },
  { id: 'velvet_night',     label: 'Velvet Night',    emoji: '🪩', desc: 'Deep plum with rose gold' },
  { id: 'shadow_neon',      label: 'Shadow Neon',     emoji: '⚡', desc: 'Jet black with neon green' },
]

export const STATUS_COLOR = {
  online:  colors.green,
  idle:    '#f5a623',
  offline: colors.textDim,
}

export const font = {
  ui:    "'DM Sans', 'Segoe UI', sans-serif",
  serif: 'Georgia, serif',
}

export const s = {
  root: { fontFamily: font.ui, background: 'var(--vn-bg)', color: 'var(--vn-text)', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' },
  titlebar: { height: 32, background: 'var(--vn-panel)', borderBottom: `1px solid var(--vn-border)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0, WebkitAppRegion: 'drag' },
  titlebarName: { fontSize: 12, color: 'var(--vn-text-dim)', letterSpacing: '0.08em', fontWeight: 500 },
  winControls: { display: 'flex', gap: 6, WebkitAppRegion: 'no-drag' },
  winBtn: { width: 12, height: 12, borderRadius: '50%', cursor: 'pointer' },
}
