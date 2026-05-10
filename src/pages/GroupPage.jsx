import { useState, useEffect, useCallback, useRef, useReducer } from 'react'
import Titlebar from '../components/Titlebar'
import Sidebar from '../components/Sidebar'
import ChatPanel from '../components/ChatPanel'
import BookView from '../components/BookView'
import LoadingOverlay from '../components/LoadingOverlay'
import { supabase } from '../lib/supabase'
import { colors, cv } from '../styles/theme'
import { cacheRead, cacheWrite, cacheMergeArray, cacheDelete, outboxAdd, isOnline } from '../lib/cache'
import { flushOutbox, pullEntries, pullMessages, syncGroup } from '../lib/sync'

// Draws GIF first frame as static preview; shows live GIF only on hover
function GifPreview({ src, alt }) {
  const canvasRef = useRef(null)
  const [hovered, setHovered] = useState(false)
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = canvasRef.current
      if (!c) return
      c.width = img.width
      c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
    }
    img.src = src
  }, [src])
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: hovered ? 'none' : 'block' }} />
      {hovered && <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'absolute', inset: 0 }} />}
    </div>
  )
}

const NAV_ITEMS = ['Entries', 'Home', 'Insert', 'Draw', 'Design', 'Transitions', 'Slide Show', 'View']

const TOOLBAR_ITEMS = {
  Entries: [{ icon: '📔', label: 'New Entry' }, { icon: '✏️', label: 'Rename' }, { icon: '🔒', label: 'Lock' }, { icon: '🏷️', label: 'Tags' }, { icon: '📅', label: 'Date' }, { icon: '🌙', label: 'Mood' }, { icon: '🗑️', label: 'Delete' }],
  Home: [{ icon: 'B', label: 'Bold', style: { fontWeight: 700 } }, { icon: 'I', label: 'Italic', style: { fontStyle: 'italic' } }, { icon: 'U', label: 'Underline', style: { textDecoration: 'underline' } }, { icon: 'S', label: 'Strike', style: { textDecoration: 'line-through' } }, { icon: 'A', label: 'Color' }, { icon: '≡', label: 'Align' }, { icon: 'Aa', label: 'Font' }],
  Insert: [{ icon: '🖼️', label: 'Image' }, { icon: '🔗', label: 'Link' }, { icon: '⬜', label: 'Shape' }],
  Draw: [{ icon: '✏️', label: 'Pencil' }, { icon: '🖊️', label: 'Pen' }, { icon: '🖌️', label: 'Brush' }, { icon: '◻️', label: 'Eraser' }, { icon: '🎨', label: 'Color' }, { icon: '↕', label: 'Size' }, { icon: '↩️', label: 'Undo' }, { icon: '↪️', label: 'Redo' }],
  Design: [{ icon: '🎨', label: 'Color' }, { icon: '🖼️', label: 'Abstract' }, { icon: '✨', label: 'Animation' }],
  Transitions: [{ icon: '↔️', label: 'Slide' }, { icon: '🔄', label: 'Flip' }, { icon: '🌀', label: 'Spiral' }, { icon: '✨', label: 'Fade' }, { icon: '💫', label: 'Zoom' }],
  'Slide Show': [{ icon: '▶️', label: 'Present' }, { icon: '⏭️', label: 'Next' }, { icon: '⏮️', label: 'Prev' }, { icon: '🖥️', label: 'Fullscreen' }],
  View: [{ icon: '🔍', label: 'Zoom In' }, { icon: '🔎', label: 'Zoom Out' }, { icon: '📐', label: 'Grid' }, { icon: '📏', label: 'Ruler' }],
}

const MOODS = ['😊', '😢', '😡', '😌', '🥰', '😔', '🤩', '😴', '🫠', '✨']

const CANVAS_THEMES = {
  Dark:   'linear-gradient(135deg, #1a1410 0%, #12100e 50%, #1a1208 100%)',
  Light:  'linear-gradient(135deg, #f5f0e8 0%, #ede8df 100%)',
  Petal:  'linear-gradient(135deg, #2a1520 0%, #1a0f18 50%, #2a1525 100%)',
  Forest: 'linear-gradient(135deg, #0f1a10 0%, #0a120a 50%, #101a0f 100%)',
  Ocean:  'linear-gradient(135deg, #0f1520 0%, #0a0f18 50%, #0f1825 100%)',
  Ember:  'linear-gradient(135deg, #1a0f08 0%, #120a05 50%, #1a1008 100%)',
  Frost:  'linear-gradient(135deg, #0f1520 0%, #0a1018 50%, #101520 100%)',
}

// Color sub-panel options (same as before, now explicitly listed)
const COLOR_OPTIONS = [
  { label: 'Dark',   icon: '🌑', gradient: CANVAS_THEMES.Dark },
  { label: 'Light',  icon: '🌕', gradient: CANVAS_THEMES.Light },
  { label: 'Petal',  icon: '🌸', gradient: CANVAS_THEMES.Petal },
  { label: 'Forest', icon: '🌿', gradient: CANVAS_THEMES.Forest },
  { label: 'Ocean',  icon: '🌊', gradient: CANVAS_THEMES.Ocean },
  { label: 'Ember',  icon: '🔥', gradient: CANVAS_THEMES.Ember },
  { label: 'Frost',  icon: '❄️', gradient: CANVAS_THEMES.Frost },
]

// ── SUPABASE STORAGE DESIGN LOADER ───────────────────────────
// Designs live in two Supabase Storage buckets: "abstracts" and "animations"
// Downloaded designs are cached locally via Electron to userData/designs/

function getLocalDesignsDir() {
  try {
    const { ipcRenderer } = window.require('electron')
    // We use a sync IPC call to get the userData path from main process
    // Falls back to a sensible default if unavailable
    const os   = window.require('os')
    const path = window.require('path')
    return path.join(os.homedir(), 'AppData', 'Roaming', 'VisperNote', 'designs')
  } catch { return null }
}

function isDesignDownloaded(filename) {
  try {
    const fs   = window.require('fs')
    const path = window.require('path')
    const dir  = getLocalDesignsDir()
    if (!dir) return false
    return fs.existsSync(path.join(dir, filename))
  } catch { return false }
}

function getLocalDesignPath(filename) {
  try {
    const path = window.require('path')
    const dir  = getLocalDesignsDir()
    if (!dir) return null
    // On Windows: C:\Users\... → file:///C:/Users/...
    // On Mac/Linux: /home/... → file:///home/...
    const normalized = path.join(dir, filename).replace(/\\/g, '/')
    return `file:///${normalized.replace(/^\//, '')}`
  } catch { return null }
}

function localFileToBlobUrl(filename) {
  try {
    const fs   = window.require('fs')
    const path = window.require('path')
    const dir  = getLocalDesignsDir()
    if (!dir) return null
    const filepath = path.join(dir, filename)
    if (!fs.existsSync(filepath)) return null
    const buffer = fs.readFileSync(filepath)
    const ext = filename.split('.').pop().toLowerCase()
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm' }
    const mime = mimeMap[ext] || 'application/octet-stream'
    const blob = new Blob([buffer], { type: mime })
    return URL.createObjectURL(blob)
  } catch (e) { console.error('[VN] localFileToBlobUrl error:', e); return null }
}

async function downloadDesignFile({ storageUrl, filename, onProgress }) {
  try {
    const fs   = window.require('fs')
    const path = window.require('path')
    const dir  = getLocalDesignsDir()
    if (!dir) throw new Error('No local designs dir')
    // Ensure directory exists
    fs.mkdirSync(dir, { recursive: true })
    const dest = path.join(dir, filename)
    // Fetch from Supabase public URL
    const res = await fetch(storageUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const total = Number(res.headers.get('content-length') || 0)
    const reader = res.body.getReader()
    const chunks = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      if (total && onProgress) onProgress(Math.round((received / total) * 100))
    }
    const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)))
    fs.writeFileSync(dest, buffer)
    return getLocalDesignPath(filename)
  } catch (e) {
    console.error('[VN] downloadDesignFile error:', e)
    throw e
  }
}

async function fetchDesignsFromStorage(bucket) {
  try {
    const { data, error } = await supabase.storage.from(bucket).list('', { limit: 100, sortBy: { column: 'name', order: 'asc' } })
    if (error || !data) return []
    return data
      .filter(f => f.name && !f.name.startsWith('.'))
      .map(f => {
        const ext   = f.name.slice(f.name.lastIndexOf('.'))
        const label = f.name.slice(0, f.name.lastIndexOf('.')).replace(/[-_]/g, ' ')
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(f.name)
        return { label, filename: f.name, ext, storageUrl: publicUrl, bucket }
      })
  } catch (e) { console.error('[VN] fetchDesignsFromStorage error:', e); return [] }
}

const SHAPE_OPTIONS = [
  { icon: '⬜', label: 'Rectangle' },
  { icon: '⬛', label: 'Square' },
  { icon: '⭕', label: 'Circle' },
  { icon: '🔺', label: 'Triangle' },
  { icon: '⭐', label: 'Star' },
  { icon: '💠', label: 'Diamond' },
  { icon: '➖', label: 'Line' },
  { icon: '➡️', label: 'Arrow' },
]

const TEXT_COLORS = ['#5a2a18','#c97b5a','#7a8ec9','#7ab89a','#b97ab8','#c9a87a','#e05555','#222222','#ffffff','#f5c842']
const ALIGN_OPTIONS = [
  { icon: '≡', label: 'Left',    value: 'left' },
  { icon: '≡', label: 'Center',  value: 'center' },
  { icon: '≡', label: 'Right',   value: 'right' },
  { icon: '≡', label: 'Justify', value: 'justify' },
]
const FONT_OPTIONS = [
  { label: 'Georgia',   value: 'Georgia, serif' },
  { label: 'Courier',   value: 'Courier New, monospace' },
  { label: 'DM Sans',   value: "'DM Sans', sans-serif" },
  { label: 'Palatino',  value: 'Palatino, serif' },
  { label: 'Trebuchet', value: 'Trebuchet MS, sans-serif' },
]

const DRAW_COLORS = ['#5a2a18', '#c97b5a', '#7a8ec9', '#7ab89a', '#b97ab8', '#e05555', '#222222', '#ffffff']
const DRAW_SIZES = [2, 4, 6, 10, 16, 24, 34]
const TRANSITION_ANIMS = {
  Slide: 'vnSlide 0.45s ease both',
  Flip: 'vnFlip 0.55s ease both',
  Spiral: 'vnSpiral 0.65s ease both',
  Fade: 'vnFade 0.45s ease both',
  Zoom: 'vnZoom 0.45s ease both',
}
const ENTRY_ANIMS = {
  In: 'vnEntryIn 0.7s ease both',
  Out: 'vnEntryOut 0.7s ease both',
}

export default function GroupPage({ groups, activeGroup, onSelectGroup, onAddGroup, onGoDM, onGoSettings, screen, user, onCheckForUpdate }) {
  const [activeNav, setActiveNav]       = useState('Entries')
  const [activeEntry, setActiveEntry]   = useState(null)
  const [online, setOnline]             = useState(isOnline())
  const [syncStatus, setSyncStatus]     = useState('idle') // 'idle' | 'syncing' | 'error'
  const [leftText, setLeftText]         = useState('')
  const [rightText, setRightText]       = useState('')
  const [, forceRender] = useReducer(x => x + 1, 0)

  useEffect(() => {
    const h = () => forceRender()
    window.addEventListener('vn-theme-change', h)
    return () => window.removeEventListener('vn-theme-change', h)
  }, [])

  const [messages, setMessages]         = useState([])
  const [groupMembers, setGroupMembers]   = useState([])
  const [chatMsg, setChatMsg]           = useState('')
  const [viewingEntries, setViewingEntries] = useState(true)
  const [bookScale, setBookScale]       = useState(1.0)
  const [entries, setEntries]           = useState([])
  const [canvasTheme, setCanvasTheme]     = useState('Dark')
  const [designMode, setDesignMode]       = useState('color')
  const [abstractTheme, setAbstractTheme] = useState(null)
  const [animationTheme, setAnimationTheme] = useState(null)
  const [activeAbstractFile, setActiveAbstractFile] = useState(null)   // filename of active abstract
  const [activeAnimationFile, setActiveAnimationFile] = useState(null) // filename of active animation
  const [abstractOptions, setAbstractOptions]   = useState([])
  const [animationOptions, setAnimationOptions] = useState([])
  // downloadedDesigns: Set of filenames already saved locally
  const [downloadedDesigns, setDownloadedDesigns] = useState(() => new Set())
  // designModal: the design shown in the confirm/download modal
  // shape: { opt, dlPct: null | 0-100, done: false, error: false } or null
  const [designModal, setDesignModal] = useState(null)

  // Fetch design lists from Supabase Storage on mount
  useEffect(() => {
    fetchDesignsFromStorage('abstracts').then(opts => {
      setAbstractOptions(opts)
      setDownloadedDesigns(prev => {
        const next = new Set(prev)
        opts.forEach(o => { if (isDesignDownloaded(o.filename)) next.add(o.filename) })
        return next
      })
    })
    fetchDesignsFromStorage('animations').then(opts => {
      setAnimationOptions(opts)
      setDownloadedDesigns(prev => {
        const next = new Set(prev)
        opts.forEach(o => { if (isDesignDownloaded(o.filename)) next.add(o.filename) })
        return next
      })
    })
  }, [])

  // Open the design modal (confirmation step)
  const openDesignModal = useCallback((opt) => {
    setDesignModal({ opt, dlPct: null, done: false, error: false })
  }, [])

  // Called when user confirms download inside the modal
  const confirmDesignDownload = useCallback(async () => {
    setDesignModal(prev => prev ? { ...prev, dlPct: 0 } : prev)
    const opt = designModal?.opt
    if (!opt) return
    try {
      await downloadDesignFile({
        storageUrl: opt.storageUrl,
        filename: opt.filename,
        onProgress: (pct) => setDesignModal(prev => prev ? { ...prev, dlPct: pct } : prev),
      })
      setDownloadedDesigns(prev => { const next = new Set(prev); next.add(opt.filename); return next })
      setDesignModal(prev => prev ? { ...prev, dlPct: 100, done: true } : prev)
      // Auto-apply the downloaded design
      const blobUrl = localFileToBlobUrl(opt.filename)
      if (blobUrl) {
        const isAnim = opt.filename.match(/\.(mp4|webm|gif)$/i)
        if (isAnim) {
          setDesignMode('animation'); setAnimationTheme(blobUrl); setActiveAnimationFile(opt.filename)
          setAbstractTheme(null); setActiveAbstractFile(null)
          saveDesign('animation', canvasTheme, null, opt.filename)
        } else {
          setDesignMode('abstract'); setAbstractTheme(blobUrl); setActiveAbstractFile(opt.filename)
          setAnimationTheme(null); setActiveAnimationFile(null)
          saveDesign('abstract', canvasTheme, opt.filename, null)
        }
      }
    } catch (e) {
      console.error('[VN] design download failed:', e)
      setDesignModal(prev => prev ? { ...prev, error: true } : prev)
    }
  }, [designModal])

  // Save design to server
  const saveDesign = useCallback(async (mode, colorTheme, abstract, animation) => {
    if (!activeGroup) return
    const design_json = JSON.stringify({ mode, colorTheme, abstract, animation })
    await supabase.from('groups').update({ design_json }).eq('id', activeGroup)
  }, [activeGroup])

  const group = groups.find(g => g.id === activeGroup) || groups[0]

  // Load design when group changes
  useEffect(() => {
    if (!group?.design_json) return
    try {
      const d = JSON.parse(group.design_json)
      if (d.mode) setDesignMode(d.mode)
      if (d.colorTheme) setCanvasTheme(d.colorTheme)
      if (d.abstract) {
        const url = localFileToBlobUrl(d.abstract)
        if (url) { setAbstractTheme(url); setActiveAbstractFile(d.abstract) }
      }
      if (d.animation) {
        const url = localFileToBlobUrl(d.animation)
        if (url) { setAnimationTheme(url); setActiveAnimationFile(d.animation) }
      }
    } catch {}
  }, [group?.id])
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [showDeleteEntry, setShowDeleteEntry] = useState(false)
  const [newEntryTitle, setNewEntryTitle] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [showMoodPicker, setShowMoodPicker] = useState(false)
  const [tagInput, setTagInput]         = useState('')
  const [expandedEntry, setExpandedEntry] = useState(null)
  const [renamingEntry, setRenamingEntry] = useState(null) // entry id being renamed
  const [renameValue, setRenameValue]   = useState('')
  const [navUnlocked, setNavUnlocked]   = useState(false)
  const [navClosing, setNavClosing]     = useState(false)
  const [loading, setLoading]           = useState(false)
  const [saveStatus, setSaveStatus]     = useState('saved') // 'saved' | 'saving'
  const [showDateModal, setShowDateModal] = useState(false)
  const [tempDate, setTempDate]         = useState('')
  const [linkUrl, setLinkUrl]           = useState('')
  const [linkText, setLinkText]         = useState('')
  const [linkColor, setLinkColor]       = useState('#7a8ec9')
  const [linkBorder, setLinkBorder]     = useState(false)
  const imageInputRef                   = useRef(null)
  const registerInsertRef               = useRef(null) // set by BookView via onRegisterInsert
  const bookRef                          = useRef(null)  // exposes nextPage/prevPage
  const [activeFormat, setActiveFormat] = useState({ bold: false, italic: false, underline: false, strike: false })
  const [floatingElements, setFloatingElements] = useState([])
  const [redoElements, setRedoElements] = useState([])
  const [subPanel, setSubPanel]         = useState(null) // 'color' | 'align' | 'font' | null
  const [subClosing, setSubClosing]     = useState(false)
  const [textColor, setTextColor]       = useState('#5a2a18')
  const [textAlign, setTextAlign]       = useState('left')
  const [fontFamily, setFontFamily]     = useState('Georgia, serif')
  const [drawTool, setDrawTool]         = useState('Pencil')
  const [drawColor, setDrawColor]       = useState('#5a2a18')
  const [drawSize, setDrawSize]         = useState(6)
  const [selectedElementId, setSelectedElementId] = useState(null)
  const [showGrid, setShowGrid]         = useState(false)
  const [showRuler, setShowRuler]       = useState(false)
  const [transitionEffect, setTransitionEffect] = useState('Fade')
  const [pageAnimation, setPageAnimation] = useState('')
  const [animationPaused, setAnimationPaused] = useState(false)
  const [isPresenting, setIsPresenting] = useState(false)

  // Esc exits fullscreen
  useEffect(() => {
    const onFsChange = () => {
      // if user pressed Esc and fullscreen closed, nothing extra needed
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen?.()
      }
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])
  const focusedTextareaRef              = useRef(null)

  const saveTimerRef = useRef(null)
  const activeEntryRef = useRef(null)
  const activeGroupRef = useRef(null)
  const myIdRef = useRef(null)
  activeEntryRef.current = activeEntry
  activeGroupRef.current = activeGroup

  const currentEntry = entries.find(e => e.id === activeEntry)
  const meta = currentEntry || {}
  const myId = user?.id
  myIdRef.current = myId

  // ── Online / offline detection + auto-sync ───────────────
  useEffect(() => {
    const goOnline = async () => {
      setOnline(true)
      if (!activeGroup) return
      setSyncStatus('syncing')
      try {
        await syncGroup(activeGroup, myIdRef.current)
        const fresh = cacheRead(`entries_${activeGroup}`) || []
        setEntries(fresh)
        const freshMsgs = cacheRead(`messages_${activeGroup}`) || []
        setMessages(freshMsgs.map(m => ({ id: m.id, from: m.from || m.profiles?.display_name || m.profiles?.username || '???', text: m.text, mine: m.user_id === myIdRef.current, created_at: m.created_at, reactions: m.reactions || {} })))
        setSyncStatus('idle')
      } catch { setSyncStatus('error') }
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [activeGroup])
  useEffect(() => {
    if (!activeGroup) return
    setEntries([])
    setActiveNav('Entries')
    setViewingEntries(true)
    setNavUnlocked(false)
    setActiveEntry(null)
    setExpandedEntry(null)
    loadEntries()

    // Realtime: watch entries for this group
    const ch = supabase.channel(`entries-${activeGroup}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'entries',
        filter: `group_id=eq.${activeGroup}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEntries(prev => [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setEntries(prev => prev.map(e => e.id === payload.new.id ? payload.new : e))
          // If someone else updated the entry we're viewing, sync text
          if (payload.new.id === activeEntryRef.current && payload.new.updated_by !== myId) {
            setLeftText(payload.new.left_content || '')
            setRightText(payload.new.right_content || '')
          }
        } else if (payload.eventType === 'DELETE') {
          setEntries(prev => prev.filter(e => e.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [activeGroup])

  // ── Load chat messages for current group ──────────────────
  useEffect(() => {
    if (!activeGroup) return
    loadMessages()

    const ch = supabase.channel(`messages-${activeGroup}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `group_id=eq.${activeGroup}`
      }, (payload) => {
        // Skip own messages — already added optimistically in sendChat
        if (payload.new.user_id !== myIdRef.current) {
          // Realtime doesn't include joined profiles — fetch it
          supabase.from('profiles').select('username, display_name').eq('id', payload.new.user_id).single()
            .then(({ data }) => {
              setMessages(prev => [...prev, {
                ...payload.new,
                from: data?.display_name || data?.username || '???',
                mine: false,
              }])
            })
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [activeGroup])

  const loadEntries = async () => {
    // Always show cache first for instant load
    const cached = cacheRead(`entries_${activeGroup}`) || []
    if (cached.length) setEntries(cached)
    // Fetch from server if online
    if (isOnline()) {
      const { data } = await supabase
        .from('entries')
        .select('*')
        .eq('group_id', activeGroup)
        .order('created_at', { ascending: true })
      if (data) {
        setEntries(data)
        cacheWrite(`entries_${activeGroup}`, data)
      }
    }
  }

  const loadMessages = async () => {
    // Show cache immediately
    const cached = cacheRead(`messages_${activeGroup}`) || []
    if (cached.length) setMessages(cached)

    // Fetch group members with profiles
    supabase
      .from('group_members')
      .select('user_id, profiles(id, username, display_name, avatar_url)')
      .eq('group_id', activeGroup)
      .then(({ data }) => {
        if (data) setGroupMembers(data.map(m => ({
          id: m.profiles?.id || m.user_id,
          username: m.profiles?.username || '???',
          avatar: m.profiles?.avatar_url || null,
        })))
      })
    if (isOnline()) {
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(username, display_name, avatar_url)')
        .eq('group_id', activeGroup)
        .order('created_at', { ascending: true })
        .limit(100)
      if (data) {
        setMessages(data)
        cacheWrite(`messages_${activeGroup}`, data)
      }
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === ']') setBookScale(s => Math.min(2.0, Math.round((s + 0.1) * 100) / 100))
      else if (e.key === '[') setBookScale(s => Math.max(0.3, Math.round((s - (s <= 1.0 ? 0.05 : 0.1)) * 100) / 100))
      else if (e.key === '0') setBookScale(1.0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Debounced content save ────────────────────────────────
  const scheduleContentSave = useCallback((entryId, left, right, elements) => {
    if (!entryId) return
    setSaveStatus('saving')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const stripHtml = (html) => {
        const tmp = document.createElement('div')
        tmp.innerHTML = html || ''
        return tmp.textContent || tmp.innerText || ''
      }
      const preview = stripHtml(left).slice(0, 80)
      const payload = {
        id: entryId,
        left_content: left,
        right_content: right,
        elements_json: JSON.stringify(elements || []),
        preview,
        updated_by: myIdRef.current,
        updated_at: new Date().toISOString(),
      }
      // Always update local cache immediately
      const cacheKey = `entries_${activeEntryRef.current ? (cacheRead('entries') || []).find?.(e => e.id === entryId)?.group_id : null}`
      // Update entry in all group caches
      const allCacheKeys = Object.keys(localStorage) // find right group
      // Simpler: update in active group cache
      if (activeGroupRef.current) {
        const key = `entries_${activeGroupRef.current}`
        const cached = cacheRead(key) || []
        const updated = cached.map(e => e.id === entryId ? { ...e, ...payload } : e)
        cacheWrite(key, updated)
      }

      if (isOnline()) {
        const { error } = await supabase.from('entries').update(payload).eq('id', entryId)
        if (error) console.error('Save error:', error)
      } else {
        // Queue for sync when back online
        outboxAdd({ table: 'entries', operation: 'update', payload, cacheKey: activeGroupRef.current ? `entries_${activeGroupRef.current}` : null })
      }
      setSaveStatus('saved')
    }, 800)
  }, [])

  const leftTextRef = useRef('')
  const rightTextRef = useRef('')
  const floatingElementsRef = useRef([])

  const handleLeftChange = (val) => {
    setLeftText(val)
    leftTextRef.current = val
    scheduleContentSave(activeEntry, val, rightTextRef.current, floatingElementsRef.current)
  }

  const handleRightChange = (val) => {
    setRightText(val)
    rightTextRef.current = val
    scheduleContentSave(activeEntry, leftTextRef.current, val, floatingElementsRef.current)
  }

  const handleElementsChange = (els) => {
    setFloatingElements(els)
    floatingElementsRef.current = els
    scheduleContentSave(activeEntry, leftTextRef.current, rightTextRef.current, els)
  }

  const applyElements = (next) => {
    setFloatingElements(next)
    floatingElementsRef.current = next
    scheduleContentSave(activeEntry, leftTextRef.current, rightTextRef.current, next)
  }

  // ── Chat ──────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatMsg.trim() || !myId) return
    const text = chatMsg.trim()
    setChatMsg('')
    const localMsg = {
      id: `local_${Date.now()}`,
      group_id: activeGroup,
      user_id: myId,
      text,
      created_at: new Date().toISOString(),
      profiles: { username: user?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || '???' },
      avatar: user?.avatar_url || user?.avatar || null,
    }
    // Show immediately in UI
    setMessages(prev => [...prev, localMsg])
    if (isOnline()) {
      await supabase.from('messages').insert({ group_id: activeGroup, user_id: myId, text })
    } else {
      // Cache and queue
      const key = `messages_${activeGroup}`
      const cached = cacheRead(key) || []
      cacheWrite(key, [...cached, localMsg])
      outboxAdd({ table: 'messages', operation: 'insert', payload: { group_id: activeGroup, user_id: myId, text }, cacheKey: key })
    }
  }

  // ── Chat actions ──────────────────────────────────────────
  const [onlineUsers, setOnlineUsers] = useState([])

  const deleteMsg = async (id) => {
    setMessages(prev => prev.filter(m => m.id !== id))
    await supabase.from('messages').delete().eq('id', id)
  }

  const reactMsg = (id, emoji) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== id) return m
      const reactions = { ...(m.reactions || {}) }
      if (!reactions[emoji]) reactions[emoji] = []
      const idx = reactions[emoji].indexOf(myId)
      if (idx > -1) reactions[emoji].splice(idx, 1)
      else reactions[emoji].push(myId)
      if (reactions[emoji].length === 0) delete reactions[emoji]
      return { ...m, reactions }
    }))
  }

  const pinMsg = () => {}

  const editMsg = async (id, text) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, text } : m))
    await supabase.from('messages').update({ text }).eq('id', id)
  }

  // ── Nav ───────────────────────────────────────────────────
  const handleNavClick = (item) => {
    setActiveNav(item)
    // Always close sub-panels when switching tabs
    setSubPanel(null)
    setSubClosing(false)
    setShowTagInput(false)
    setShowMoodPicker(false)
    if (item === 'Entries') {
      setNavClosing(true)
      setTimeout(() => { setNavUnlocked(false); setNavClosing(false) }, 250 + NAV_ITEMS.slice(1).length * 30)
      setViewingEntries(true)
      setActiveEntry(null)
    } else {
      setNavClosing(false)
      setNavUnlocked(true)
      setViewingEntries(false)
    }
  }

  const openEntry = async (id) => {
    setLoading(true)
    // Try cache first for instant load
    const cacheKey = `entries_${activeGroup}`
    const cached = cacheRead(cacheKey) || []
    const cachedEntry = cached.find(e => e.id === id)

    let entry = cachedEntry
    // Fetch fresh from server if online and not a local_ id
    if (isOnline() && id && !String(id).startsWith('local_')) {
      const { data } = await supabase.from('entries').select('*').eq('id', id).single()
      if (data) {
        entry = data
        // Update cache
        const updated = cached.map(e => e.id === id ? data : e)
        cacheWrite(cacheKey, updated)
      }
    }

    setTimeout(() => {
      setActiveEntry(id)
      setActiveNav('Home')
      setNavUnlocked(true)
      setViewingEntries(false)
      setLeftText(entry?.left_content || '')
      setRightText(entry?.right_content || '')
      leftTextRef.current = entry?.left_content || ''
      rightTextRef.current = entry?.right_content || ''
      const els = (() => { try { const p = JSON.parse(entry?.elements_json); return Array.isArray(p) ? p : [] } catch { return [] } })()
      setFloatingElements(els)
      floatingElementsRef.current = els
      setLinkUrl('')
      setLinkText('')
      setShowTagInput(false)
      setShowMoodPicker(false)
      setExpandedEntry(null)
      setLoading(false)
    }, 300)
  }

  // ── Create entry ──────────────────────────────────────────
  const confirmNewEntry = async () => {
    if (!myId || !activeGroup) return
    const title = newEntryTitle.trim() || 'Untitled Entry'
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    setNewEntryTitle('')
    setShowNewEntry(false)

    const newEntry = {
      id: isOnline() ? null : `local_${Date.now()}`,
      group_id: activeGroup,
      created_by: myId,
      updated_by: myId,
      title,
      date: today,
      left_content: '',
      right_content: '',
      preview: '',
      created_at: new Date().toISOString(),
    }

    if (isOnline()) {
      setLoading(true)
      const { data: entry, error } = await supabase
        .from('entries')
        .insert({ group_id: activeGroup, created_by: myId, updated_by: myId, title, date: today, left_content: '', right_content: '', preview: '' })
        .select()
        .single()
      setLoading(false)
      if (error || !entry) { console.error('Entry insert error:', error); return }
      // Cache it
      const key = `entries_${activeGroup}`
      const cached = cacheRead(key) || []
      cacheWrite(key, [...cached, entry])
      openEntry(entry.id)
    } else {
      // Offline: use local id
      const key = `entries_${activeGroup}`
      const cached = cacheRead(key) || []
      cacheWrite(key, [...cached, newEntry])
      setEntries(prev => [...prev, newEntry])
      outboxAdd({ table: 'entries', operation: 'insert', payload: newEntry, cacheKey: key })
      openEntry(newEntry.id)
    }
  }

  // ── Sub-panel toggle ──────────────────────────────────────
  const openSubPanel = (name) => {
    if (subPanel === name) { closeSubPanel(); return }
    setSubPanel(name)
    setSubClosing(false)
  }
  const closeSubPanel = () => {
    setSubClosing(true)
    setTimeout(() => { setSubPanel(null); setSubClosing(false) }, 250)
  }

  // ── Text formatting ───────────────────────────────────────
  const applyFormat = (cmd) => {
    setActiveFormat(f => ({ ...f, [cmd]: !f[cmd] }))
  }

  // ── Insert into focused page ──────────────────────────────
  const handleImagePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      registerInsertRef.current?.({ type: 'image', src: ev.target.result, w: 160, h: 120 })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const confirmLink = () => {
    if (!linkUrl.trim()) return
    registerInsertRef.current?.({
      type: 'link',
      href: linkUrl.trim(),
      text: linkText.trim() || linkUrl.trim(),
      linkColor,
      borderVisible: linkBorder,
      w: 180, h: 38,
    })
    setLinkUrl('')
    setLinkText('')
  }

  const insertShape = (label) => {
    registerInsertRef.current?.({ type: 'shape', shape: label, w: 90, h: 90 })
    // Don't close sub-panel
  }

  const triggerPageAnimation = (animation) => {
    setAnimationPaused(false)
    setPageAnimation('none')
    requestAnimationFrame(() => setPageAnimation(animation))
  }

  const undoElement = () => {
    if (!floatingElementsRef.current.length) return
    const next = floatingElementsRef.current.slice(0, -1)
    const removed = floatingElementsRef.current[floatingElementsRef.current.length - 1]
    setRedoElements(prev => [...prev, removed])
    applyElements(next)
  }

  const redoElement = () => {
    setRedoElements(prev => {
      if (!prev.length) return prev
      const restored = prev[prev.length - 1]
      applyElements([...floatingElementsRef.current, restored])
      return prev.slice(0, -1)
    })
  }

  const applyElementTransition = (label) => {
    setTransitionEffect(label)
    const animation = TRANSITION_ANIMS[label]
    const current = floatingElementsRef.current.find(el => el.id === selectedElementId)
    // If already has this animation, toggle it off
    if (current?.animation === animation) {
      const next = floatingElementsRef.current.map(el =>
        el.id === selectedElementId ? { ...el, animation: 'none' } : el
      )
      applyElements(next)
      return
    }
    // Clear first so re-applying same animation still replays
    const cleared = floatingElementsRef.current.map(el =>
      el.id === selectedElementId ? { ...el, animation: 'none' } : el
    )
    setFloatingElements(cleared)
    floatingElementsRef.current = cleared
    requestAnimationFrame(() => {
      const next = floatingElementsRef.current.map(el =>
        el.id === selectedElementId && ['image', 'shape', 'link'].includes(el.type) ? { ...el, animation } : el
      )
      applyElements(next)
    })
  }

  // ── Toolbar actions ───────────────────────────────────────
  const handleToolClick = (label) => {
    if (label !== 'New Entry' && !activeEntry) return
    if (label === 'New Entry') { setShowNewEntry(true); return }
    if (label === 'Rename') {
      const entry = entries.find(e => e.id === activeEntry)
      if (entry) { setRenamingEntry(entry.id); setRenameValue(entry.title) }
      return
    }
    if (label === 'Lock') {
      if (meta.created_by && meta.created_by !== myId) return
      toggleMeta({ is_locked: !meta.is_locked }); return
    }
    if (label === 'Tags') { setShowTagInput(v => !v); setShowMoodPicker(false); closeSubPanel(); return }
    if (label === 'Date') {
      const cur = meta.date ? new Date(meta.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      setTempDate(cur); setShowDateModal(true); return
    }
    if (label === 'Mood') { setShowMoodPicker(v => !v); setShowTagInput(false); closeSubPanel(); return }
    if (CANVAS_THEMES[label]) { setCanvasTheme(label); return }
    // Design tab — Color / Abstract / Animation buttons
    if (activeNav === 'Design' && label === 'Color')     { openSubPanel('designColor'); return }
    if (activeNav === 'Design' && label === 'Abstract')  { openSubPanel('designAbstract'); return }
    if (activeNav === 'Design' && label === 'Animation') { openSubPanel('designAnimation'); return }
    // Home formatting
    if (label === 'Bold')      { applyFormat('bold'); return }
    if (label === 'Italic')    { applyFormat('italic'); return }
    if (label === 'Underline') { applyFormat('underline'); return }
    if (label === 'Strike')    { applyFormat('strike'); return }
    if (activeNav === 'Home' && label === 'Color') { openSubPanel('color'); return }
    if (label === 'Align')     { openSubPanel('align'); return }
    if (label === 'Font')      { openSubPanel('font'); return }
    if (label === 'Image')     { imageInputRef.current?.click(); return }
    if (label === 'Link')      { openSubPanel('link'); return }
    if (label === 'Shape')     { openSubPanel('shape'); return }
    if (['Pencil', 'Pen', 'Brush', 'Eraser'].includes(label)) { setDrawTool(t => t === label ? null : label); return }
    if (label === 'Undo')      { undoElement(); return }
    if (label === 'Redo')      { redoElement(); return }
    if (activeNav === 'Draw' && label === 'Color') { openSubPanel('drawColor'); return }
    if (activeNav === 'Draw' && label === 'Size') { openSubPanel('drawSize'); return }
    if (TRANSITION_ANIMS[label]) {
      if (selectedElementId) applyElementTransition(label)
      // No book animation — transitions only apply to selected elements
      return
    }
    if (label === 'Delete')    { if (activeEntry) setShowDeleteEntry(true); return }
    if (label === 'Play')      { return }
    if (label === 'Pause')     { setAnimationPaused(v => !v); return }
    if (label === 'Stop')      { return }
    if (label === 'In' || label === 'Out') { return }
    if (label === 'Present')   { setIsPresenting(true); return }
    if (label === 'Next')      { bookRef.current?.nextPage(); return }
    if (label === 'Prev')      { bookRef.current?.prevPage(); return }
    if (label === 'Fullscreen') { document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.(); return }
    if (label === 'Zoom In')   { setBookScale(s => Math.min(2, Math.round((s + 0.1) * 100) / 100)); return }
    if (label === 'Zoom Out')  { setBookScale(s => Math.max(0.3, Math.round((s - (s <= 1 ? 0.05 : 0.1)) * 100) / 100)); return }
    if (label === 'Grid')      { setShowGrid(v => !v); return }
    if (label === 'Ruler')     { setShowRuler(v => !v); return }
  }

  const toggleMeta = async (fields) => {
    if (!activeEntry) return
    // Update local cache immediately
    setEntries(prev => prev.map(e => e.id === activeEntry ? { ...e, ...fields } : e))
    const key = `entries_${activeGroup}`
    const cached = cacheRead(key) || []
    cacheWrite(key, cached.map(e => e.id === activeEntry ? { ...e, ...fields } : e))
    if (isOnline()) {
      await supabase.from('entries').update(fields).eq('id', activeEntry)
    } else {
      outboxAdd({ table: 'entries', operation: 'update', payload: { id: activeEntry, ...fields }, cacheKey: key })
    }
  }

  const saveDate = async () => {
    setShowDateModal(false)
    if (!tempDate || !activeEntry) return
    const formatted = new Date(tempDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    await toggleMeta({ date: formatted })
  }

  const startRename = (e, entry) => {
    e.stopPropagation()
    setRenamingEntry(entry.id)
    setRenameValue(entry.title)
  }

  const confirmRename = async (entryId) => {
    const title = renameValue.trim()
    if (!title) { setRenamingEntry(null); return }
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, title } : e))
    const key = `entries_${activeGroup}`
    const cached = cacheRead(key) || []
    cacheWrite(key, cached.map(e => e.id === entryId ? { ...e, title } : e))
    if (isOnline()) {
      await supabase.from('entries').update({ title }).eq('id', entryId)
    } else {
      outboxAdd({ table: 'entries', operation: 'update', payload: { id: entryId, title }, cacheKey: key })
    }
    setRenamingEntry(null)
  }

  const addTag = async () => {
    if (!tagInput.trim() || !activeEntry) return
    const newTags = [...(meta.tags || []), tagInput.trim()]
    setTagInput('')
    await toggleMeta({ tags: newTags })
  }

  const removeTag = async (tag) => {
    const newTags = (meta.tags || []).filter(t => t !== tag)
    await toggleMeta({ tags: newTags })
  }

  const setMood = async (emoji) => {
    if (!activeEntry) return
    setShowMoodPicker(false)
    await toggleMeta({ mood: emoji })
  }

  // ── Format messages for ChatPanel ─────────────────────────
  // Build a quick lookup of user_id → avatar_url from group members
  const memberAvatarMap = Object.fromEntries(
    (groupMembers || []).map(m => [m.id, m.avatar])
  )

  const formattedMessages = messages.map(m => ({
    id: m.id,
    from: m.from || m.profiles?.display_name || m.profiles?.username || '???',
    avatar: m.avatar || m.profiles?.avatar_url || memberAvatarMap[m.user_id] || (m.mine ? (user?.avatar_url || user?.avatar || null) : null),
    text: m.text,
    mine: m.user_id === myId,
    created_at: m.created_at,
    reactions: m.reactions || {},
    replyTo: m.reply_to ? (() => { try { return JSON.parse(m.reply_to) } catch { return null } })() : null,
  }))

  return (
    <div style={s.root}>
      <Titlebar groupName={group?.name} entryName={currentEntry?.title} onCheckForUpdate={onCheckForUpdate}/>
      <div style={s.body}>
        <Sidebar groups={groups} activeGroup={activeGroup} onSelectGroup={onSelectGroup} onAddGroup={onAddGroup} onGoDM={onGoDM} onGoSettings={onGoSettings} screen={screen} user={user} />

        <ChatPanel
          groupName={group?.name}
          members={groupMembers || []}
          messages={formattedMessages}
          chatMsg={chatMsg}
          onMsgChange={setChatMsg}
          onSend={(opts) => sendChat(opts)}
          myId={myId}
          ownerId={group?.created_by}
          onDeleteMsg={deleteMsg}
          onReactMsg={reactMsg}
          onPinMsg={pinMsg}
          onEditMsg={editMsg}
          onReplyMsg={(msg) => {}}
          onForwardMsg={(msg) => {}}
          onlineUsers={onlineUsers}
          chatColor={typeof localStorage !== 'undefined' ? (localStorage.getItem('vn_chat_color') || '#c97b5a') : '#c97b5a'}
          inviteCode={group?.invite_code || group?.id?.slice(0, 8).toUpperCase()}
          onEditName={async (newName) => {
            await supabase.from('groups').update({ name: newName }).eq('id', activeGroup)
            setGroup(prev => prev ? { ...prev, name: newName } : prev)
          }}
        />
        <div style={s.main}>
          {/* Navbar */}
          <div style={s.topnav}>
            <div style={{ ...s.navItem, ...(activeNav === 'Entries' ? s.navActive : {}) }} onClick={() => handleNavClick('Entries')}>Entries</div>
            {(navUnlocked || navClosing) && NAV_ITEMS.slice(1).map((item, i) => (
              <div key={item} style={{ ...s.navItem, ...(activeNav === item ? s.navActive : {}), animation: navClosing ? `slideOut 0.2s ease ${i * 0.03}s both` : `slideIn 0.25s ease ${i * 0.03}s both` }} onClick={() => handleNavClick(item)}>{item}</div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={s.toolbar}>
            {(TOOLBAR_ITEMS[activeNav] || []).map((tool, i) => {
              const isDisabled = (tool.label !== 'New Entry' && !activeEntry) ||
                (activeNav === 'Transitions' && TRANSITION_ANIMS[tool.label] && !selectedElementId)
              const isActive =
                (tool.label === 'Lock' && meta.is_locked) ||
                (tool.label === 'Tags' && showTagInput) ||
                (tool.label === 'Mood' && showMoodPicker) ||
                (CANVAS_THEMES[tool.label] && canvasTheme === tool.label) ||
                (tool.label === 'Color' && activeNav === 'Design' && (subPanel === 'designColor' || designMode === 'color')) ||
                (tool.label === 'Abstract' && activeNav === 'Design' && (subPanel === 'designAbstract' || designMode === 'abstract')) ||
                (tool.label === 'Animation' && activeNav === 'Design' && (subPanel === 'designAnimation' || designMode === 'animation')) ||
                (tool.label === 'Bold' && activeFormat.bold) ||
                (tool.label === 'Italic' && activeFormat.italic) ||
                (tool.label === 'Underline' && activeFormat.underline) ||
                (tool.label === 'Strike' && activeFormat.strike) ||
                (tool.label === 'Color' && subPanel === 'color') ||
                (tool.label === 'Align' && subPanel === 'align') ||
                (tool.label === 'Font' && subPanel === 'font') ||
                (tool.label === 'Shape' && subPanel === 'shape') ||
                (tool.label === 'Link' && subPanel === 'link') ||
                (['Pencil', 'Pen', 'Brush', 'Eraser'].includes(tool.label) && drawTool === tool.label) ||
                (activeNav === 'Draw' && tool.label === 'Color' && subPanel === 'drawColor') ||
                (activeNav === 'Draw' && tool.label === 'Size' && subPanel === 'drawSize') ||
                (TRANSITION_ANIMS[tool.label] && (selectedElementId
                  ? floatingElements.find(e => e.id === selectedElementId)?.animation === TRANSITION_ANIMS[tool.label]
                  : transitionEffect === tool.label)) ||
                (tool.label === 'Grid' && showGrid) ||
                (tool.label === 'Ruler' && showRuler)
              return (
                <div key={i}
                  style={{ ...s.toolBtn, ...(isActive ? s.toolBtnActive : {}), ...(isDisabled ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' } : {}) }}
                  title={
                    !activeEntry ? 'Open an entry first' :
                    (activeNav === 'Transitions' && TRANSITION_ANIMS[tool.label] && !selectedElementId) ? 'Select an element first' :
                    tool.label
                  }
                  onClick={() => handleToolClick(tool.label)}
                  onMouseEnter={e => !isDisabled && (e.currentTarget.style.background = cv.hover)}
                  onMouseLeave={e => !isDisabled && (e.currentTarget.style.background = isActive ? cv.accentDim : 'transparent')}
                >
                  <span style={{ fontSize: 18, ...(tool.style || {}) }}>
                    {tool.label === 'Mood' && meta.mood ? meta.mood : tool.icon}
                  </span>
                  <span style={s.toolLabel}>{tool.label}</span>
                </div>
              )
            })}

            {/* Sub-panel separator + sliding options */}
            {subPanel && (() => {
              const homePanel = ['color','align','font'].includes(subPanel) && activeNav === 'Home'
              const insertPanel = ['shape','link'].includes(subPanel) && activeNav === 'Insert'
              const drawPanel = ['drawColor','drawSize'].includes(subPanel) && activeNav === 'Draw'
              const designPanel = ['designColor','designAbstract','designAnimation'].includes(subPanel) && activeNav === 'Design'
              return homePanel || insertPanel || drawPanel || designPanel
            })() && (
              <>
                <div style={s.toolSep} />
                {subPanel === 'color' && TEXT_COLORS.map((color, i) => (
                  <div key={color} style={{
                    ...s.toolBtn,
                    animation: subClosing ? `slideOut 0.2s ease ${i * 0.02}s both` : `slideIn 0.22s ease ${i * 0.02}s both`,
                    position: 'relative',
                  }} onClick={() => { setTextColor(color) }}
                    title={color}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: color, border: textColor === color ? `2px solid ${cv.accent}` : '2px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                    {textColor === color && <div style={{ position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: '50%', background: cv.accent }} />}
                  </div>
                ))}
                {subPanel === 'drawColor' && DRAW_COLORS.map((color, i) => (
                  <div key={color} style={{
                    ...s.toolBtn,
                    animation: subClosing ? `slideOut 0.2s ease ${i * 0.02}s both` : `slideIn 0.22s ease ${i * 0.02}s both`,
                    position: 'relative',
                  }} onClick={() => setDrawColor(color)}
                    title={color}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: color, border: drawColor === color ? `2px solid ${cv.accent}` : '2px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                    {drawColor === color && <div style={{ position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: '50%', background: cv.accent }} />}
                  </div>
                ))}
                {subPanel === 'drawSize' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', animation: subClosing ? 'slideOut 0.2s ease both' : 'slideIn 0.22s ease both' }}>
                    <span style={{ fontSize: 10, color: cv.textDim, width: 18 }}>2</span>
                    <input
                      type="range"
                      min="2"
                      max="34"
                      step="1"
                      value={drawSize}
                      onChange={e => setDrawSize(Number(e.target.value))}
                      style={{ width: 150, accentColor: cv.accent }}
                    />
                    <span style={{ fontSize: 10, color: cv.textDim, width: 22 }}>34</span>
                    <div style={{ ...s.sizePreview, width: drawSize, height: drawSize, background: drawTool === 'Eraser' ? '#e8b49a' : drawColor }} />
                  </div>
                )}
                {subPanel === 'align' && ALIGN_OPTIONS.map((opt, i) => (
                  <div key={opt.value} style={{
                    ...s.toolBtn,
                    ...(textAlign === opt.value ? s.toolBtnActive : {}),
                    animation: subClosing ? `slideOut 0.2s ease ${i * 0.03}s both` : `slideIn 0.22s ease ${i * 0.03}s both`,
                  }} onClick={() => { setTextAlign(opt.value) }}>
                    <span style={{ fontSize: 16, letterSpacing: opt.value === 'left' ? '-1px' : opt.value === 'center' ? '1px' : opt.value === 'right' ? '2px' : '0' }}>
                      {opt.value === 'left' ? '⬅' : opt.value === 'center' ? '↔' : opt.value === 'right' ? '➡' : '⇔'}
                    </span>
                    <span style={s.toolLabel}>{opt.label}</span>
                  </div>
                ))}
                {subPanel === 'font' && FONT_OPTIONS.map((opt, i) => (
                  <div key={opt.value} style={{
                    ...s.toolBtn,
                    ...(fontFamily === opt.value ? s.toolBtnActive : {}),
                    animation: subClosing ? `slideOut 0.2s ease ${i * 0.03}s both` : `slideIn 0.22s ease ${i * 0.03}s both`,
                    minWidth: 68,
                  }} onClick={() => { setFontFamily(opt.value) }}>
                    <span style={{ fontSize: 13, fontFamily: opt.value, color: cv.text }}>{opt.label}</span>
                    <span style={s.toolLabel}>Font</span>
                  </div>
                ))}
                {subPanel === 'shape' && SHAPE_OPTIONS.map((opt, i) => (
                  <div key={opt.label} style={{
                    ...s.toolBtn,
                    animation: subClosing ? `slideOut 0.2s ease ${i * 0.03}s both` : `slideIn 0.22s ease ${i * 0.03}s both`,
                  }} onClick={() => { insertShape(opt.label) }}>
                    <span style={{ fontSize: 18 }}>{opt.icon}</span>
                    <span style={s.toolLabel}>{opt.label}</span>
                  </div>
                ))}
                {subPanel === 'link' && (
                  <>
                    {/* Link color swatches */}
                    {['#7a8ec9','#c97b5a','#7ab89a','#b97ab8','#e05555','#222222'].map((color, i) => (
                      <div key={color} style={{ ...s.toolBtn, animation: subClosing ? `slideOut 0.2s ease ${i*0.03}s both` : `slideIn 0.22s ease ${i*0.03}s both`, position: 'relative' }}
                        onClick={() => setLinkColor(color)} title={color}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: color, border: linkColor === color ? '2px solid #fff' : '2px solid rgba(255,255,255,0.15)' }} />
                        {linkColor === color && <div style={{ position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: '50%', background: '#fff' }} />}
                      </div>
                    ))}
                    <div style={s.toolSep} />
                    {/* Border toggle */}
                    <div style={{ ...s.toolBtn, ...(linkBorder ? s.toolBtnActive : {}), animation: subClosing ? 'slideOut 0.2s ease both' : 'slideIn 0.22s ease 0.18s both' }}
                      onClick={() => setLinkBorder(v => !v)}>
                      <span style={{ fontSize: 16 }}>⬜</span>
                      <span style={s.toolLabel}>Border</span>
                    </div>
                    <div style={s.toolSep} />
                    {/* URL + text inputs + add button */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 6px', animation: subClosing ? 'slideOut 0.2s ease both' : 'slideIn 0.22s ease 0.21s both' }}>
                      <input style={{ ...s.subInput }} placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmLink()} />
                      <input style={{ ...s.subInput }} placeholder="Display text (opt.)" value={linkText} onChange={e => setLinkText(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmLink()} />
                    </div>
                    <div style={{ ...s.toolBtn, animation: subClosing ? 'slideOut 0.2s ease both' : 'slideIn 0.22s ease 0.24s both' }}
                      onClick={confirmLink}>
                      <span style={{ fontSize: 16 }}>➕</span>
                      <span style={s.toolLabel}>Add Link</span>
                    </div>
                  </>
                )}
                {/* ── Design: Color sub-panel ── */}
                {subPanel === 'designColor' && COLOR_OPTIONS.map((opt, i) => (
                  <div key={opt.label} style={{
                    ...s.toolBtn,
                    ...(designMode === 'color' && canvasTheme === opt.label ? s.toolBtnActive : {}),
                    animation: subClosing ? `slideOut 0.2s ease ${i*0.03}s both` : `slideIn 0.22s ease ${i*0.03}s both`,
                    gap: 4,
                  }} onClick={() => { setDesignMode('color'); setCanvasTheme(opt.label); setAbstractTheme(null); setAnimationTheme(null); saveDesign('color', opt.label, null, null) }}>
                    <div style={{ width: 28, height: 18, borderRadius: 4, background: opt.gradient, border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }} />
                    <span style={s.toolLabel}>{opt.label}</span>
                  </div>
                ))}
                {/* ── Design: Abstract sub-panel ── */}
                {subPanel === 'designAbstract' && (
                  abstractOptions.length === 0
                    ? <div style={{ padding: '0 16px', fontSize: 11, color: cv.textDim, alignSelf: 'center' }}>No abstract designs found in storage.</div>
                    : abstractOptions.map((opt, i) => {
                        const isDone = downloadedDesigns.has(opt.filename)
                        const localPath = isDone ? getLocalDesignPath(opt.filename) : null
                        const isActive = designMode === 'abstract' && activeAbstractFile === opt.filename
                        return (
                          <div key={opt.filename} style={{
                            ...s.toolBtn,
                            ...(isActive ? s.toolBtnActive : {}),
                            animation: subClosing ? `slideOut 0.2s ease ${i*0.03}s both` : `slideIn 0.22s ease ${i*0.03}s both`,
                            gap: 4, minWidth: 70, position: 'relative',
                            cursor: isDone ? 'pointer' : 'default',
                          }} onClick={() => {
                            if (!isDone) { openDesignModal(opt); return }
                            const blobUrl = localFileToBlobUrl(opt.filename)
                            setDesignMode('abstract'); setAbstractTheme(blobUrl); setActiveAbstractFile(opt.filename); setAnimationTheme(null); setActiveAnimationFile(null); saveDesign('abstract', canvasTheme, opt.filename, null)
                          }}>
                            <div style={{ width: 48, height: 30, borderRadius: 5, overflow: 'hidden', border: isActive ? `2px solid ${cv.accent}` : '1px solid rgba(255,255,255,0.12)', flexShrink: 0, position: 'relative', background: '#111' }}>
                              <img src={opt.storageUrl} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              {/* ⬇ overlay — only shown when not yet downloaded */}
                              {!isDone && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, pointerEvents: 'none' }}>
                                  <span style={{ fontSize: 13, lineHeight: 1, color: '#fff' }}>⬇</span>
                                </div>
                              )}
                            </div>
                            <span style={{ ...s.toolLabel, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                          </div>
                        )
                      })
                )}
                {subPanel === 'designAnimation' && (
                  animationOptions.length === 0
                    ? <div style={{ padding: '0 16px', fontSize: 11, color: cv.textDim, alignSelf: 'center' }}>No animation designs found in storage.</div>
                    : animationOptions.map((opt, i) => {
                        const isGif = opt.filename.toLowerCase().endsWith('.gif')
                        const isDone = downloadedDesigns.has(opt.filename)
                        const localPath = isDone ? getLocalDesignPath(opt.filename) : null
                        const isActive = designMode === 'animation' && activeAnimationFile === opt.filename
                        return (
                          <div key={opt.filename} style={{
                            ...s.toolBtn,
                            ...(isActive ? s.toolBtnActive : {}),
                            animation: subClosing ? `slideOut 0.2s ease ${i*0.03}s both` : `slideIn 0.22s ease ${i*0.03}s both`,
                            gap: 4, minWidth: 70, position: 'relative',
                            cursor: isDone ? 'pointer' : 'default',
                          }} onClick={() => {
                            if (!isDone) { openDesignModal(opt); return }
                            const blobUrl = localFileToBlobUrl(opt.filename)
                            setDesignMode('animation'); setAnimationTheme(blobUrl); setActiveAnimationFile(opt.filename); setAbstractTheme(null); setActiveAbstractFile(null); saveDesign('animation', canvasTheme, null, opt.filename)
                          }}>
                            <div style={{ width: 48, height: 30, borderRadius: 5, overflow: 'hidden', border: isActive ? `2px solid ${cv.accent}` : '1px solid rgba(255,255,255,0.12)', flexShrink: 0, background: '#0a0a0a', position: 'relative' }}>
                              {isGif
                                ? <GifPreview src={opt.storageUrl} alt={opt.label} />
                                : <video src={opt.storageUrl} muted playsInline loop style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    onMouseEnter={e => e.target.play()}
                                    onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0 }}
                                  />
                              }
                              {/* ⬇ overlay — only shown when not yet downloaded */}
                              {!isDone && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.52)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, pointerEvents: 'none' }}>
                                  <span style={{ fontSize: 13, lineHeight: 1, color: '#fff' }}>⬇</span>
                                </div>
                              )}
                            </div>
                            <span style={{ ...s.toolLabel, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                          </div>
                        )
                      })
                )}
              </>
            )}
          </div>

          {/* Tag Bar */}
          {showTagInput && (
            <div style={s.metaBar}>
              <span style={{ fontSize: 11, color: cv.textDim }}>Tags:</span>
              {(meta.tags || []).map(tag => (
                <div key={tag} style={s.tag}>#{tag}<span style={{ cursor: 'pointer', marginLeft: 4, opacity: 0.6 }} onClick={() => removeTag(tag)}>×</span></div>
              ))}
              <input style={s.tagInput} placeholder="Type and press Enter..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} autoFocus />
            </div>
          )}

          {/* Mood Picker */}
          {showMoodPicker && (
            <div style={s.metaBar}>
              <span style={{ fontSize: 11, color: cv.textDim }}>Mood:</span>
              {MOODS.map(emoji => (
                <div key={emoji} style={{ ...s.moodBtn, ...(meta.mood === emoji ? s.toolBtnActive : {}) }} onClick={() => setMood(emoji)}>{emoji}</div>
              ))}
            </div>
          )}

          {/* Main Writing Area */}
          <div style={s.writing}>
            {viewingEntries ? (
              <div style={s.entriesView}>
                <div style={s.entriesHeader}>
                  <div style={s.entriesTitle}>{group?.icon} {group?.name}</div>
                  <div style={s.entriesSubtitle}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</div>
                </div>
                <div style={s.entriesList}>
                  {entries.map(e => {
                    const isExpanded = expandedEntry === e.id
                    return (
                      <div key={e.id}
                        style={{ ...s.entryCard, ...(isExpanded ? s.entryCardExpanded : {}) }}
                        onClick={() => { const next = expandedEntry === e.id ? null : e.id; setExpandedEntry(next); setActiveEntry(next) }}
                        onDoubleClick={() => openEntry(e.id)}
                        onMouseEnter={el => { if (!isExpanded) el.currentTarget.style.background = cv.hover }}
                        onMouseLeave={el => { if (!isExpanded) el.currentTarget.style.background = cv.surface }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                            {e.is_locked && <span style={{ fontSize: 11 }}>🔒</span>}
                            {String(e.id).startsWith('local_') && <span title="Not synced yet" style={{ fontSize: 9, background: '#e06c7533', color: '#e06c75', borderRadius: 4, padding: '1px 5px' }}>offline</span>}
                            {renamingEntry === e.id ? (
                              <input
                                autoFocus
                                style={{ ...s.renameInput }}
                                value={renameValue}
                                onChange={ev => setRenameValue(ev.target.value)}
                                onKeyDown={ev => { if (ev.key === 'Enter') confirmRename(e.id); if (ev.key === 'Escape') setRenamingEntry(null) }}
                                onBlur={() => confirmRename(e.id)}
                                onClick={ev => ev.stopPropagation()}
                              />
                            ) : (
                              <div style={s.entryTitle}>{e.title}</div>
                            )}
                            {e.mood && <span style={{ fontSize: 14 }}>{e.mood}</span>}
                          </div>
                          <div style={s.entryDate}>{e.date}</div>
                        </div>
                        <div style={s.entryPreview}>{e.preview || 'No content yet...'}</div>
                        {(e.tags || []).length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {e.tags.map(tag => <span key={tag} style={s.tagSmall}>#{tag}</span>)}
                          </div>
                        )}
                        {isExpanded && (
                          <div style={s.entryExpand} onClick={ev => ev.stopPropagation()}>
                            <div style={{ fontSize: 11, color: cv.textDim }}>Double-click to open quickly</div>
                            <button style={s.openBtn} onClick={() => openEntry(e.id)}>Open entry →</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div style={s.newEntryCard} onClick={() => setShowNewEntry(true)}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = cv.accent; e.currentTarget.style.color = cv.accent }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = cv.border; e.currentTarget.style.color = cv.textDim }}>
                    <span style={{ fontSize: 20 }}>+</span>
                    <span style={{ fontSize: 13 }}>New Entry</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                ...s.canvas,
                background: designMode === 'color' ? CANVAS_THEMES[canvasTheme] : designMode === 'abstract' && abstractTheme ? 'none' : CANVAS_THEMES[canvasTheme],
                position: 'relative',
                borderLeft: `1px solid rgba(255,255,255,0.06)`,
              }}>
                {/* Vignette overlay */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: 20, zIndex: 1, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)' }} />
                {/* Abstract image background */}
                {designMode === 'abstract' && abstractTheme && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', zIndex: 0 }}>
                    <img src={abstractTheme} alt="background" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
                  </div>
                )}
                {/* Animation video/gif background */}
                {designMode === 'animation' && animationTheme && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', zIndex: 0 }}>
                    {activeAnimationFile?.toLowerCase().endsWith('.gif')
                      ? <img key={animationTheme} src={animationTheme} alt="background" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <video key={animationTheme} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}>
                          <source src={animationTheme} type={activeAnimationFile?.endsWith('.mp4') ? 'video/mp4' : 'video/webm'} />
                        </video>
                    }
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
                  </div>
                )}
                <div style={{ position: 'relative', zIndex: 1, transform: `scale(${bookScale})`, transformOrigin: 'center center', transition: 'transform 0.15s ease', animationPlayState: animationPaused ? 'paused' : 'running' }}>
                  <BookView
                    ref={bookRef}
                    key={activeEntry}
                    layout={group?.layout || 'diary'}
                    groupName={group?.name}
                    leftText={leftText}
                    rightText={rightText}
                    onLeftChange={handleLeftChange}
                    onRightChange={handleRightChange}
                    pageNum={activeEntry}
                    entryDate={meta.date}
                    isLocked={meta.is_locked}
                    isOwner={meta.created_by === myId}
                    textColor={textColor}
                    textAlign={textAlign}
                    fontFamily={fontFamily}
                    activeFormat={activeFormat}
                    onFocusTextarea={(ref) => { focusedTextareaRef.current = ref }}
                    onRegisterInsert={(fn) => { registerInsertRef.current = fn }}
                    initialElements={floatingElements}
                    onElementsChange={handleElementsChange}
                    showGrid={showGrid}
                    showRuler={showRuler}
                    pageAnimation=''
                    drawTool={activeNav === 'Draw' ? drawTool : null}
                    drawColor={drawColor}
                    drawSize={drawSize}
                    onSelectElement={setSelectedElementId}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={s.statusbar}>
        <div style={s.statusItem}>
          <div style={{ ...s.statusDot, background: online ? cv.green : '#e06c75' }} />
          {online ? (syncStatus === 'syncing' ? 'Syncing…' : 'Online') : 'Offline'}
        </div>
        <div style={s.statusItem}>📔 Diary — {group?.name || 'My Diary'}</div>
        {bookScale !== 1.0 && <div style={{ ...s.statusItem, color: cv.accent }}>Book {Math.round(bookScale * 100)}%</div>}
        {meta.mood && <div style={s.statusItem}>{meta.mood}</div>}
        {currentEntry && <div style={{ ...s.statusItem, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>📝 {currentEntry.title}</div>}
        <div style={{ ...s.statusItem, marginLeft: 'auto', color: saveStatus === 'saving' ? cv.accent : cv.textDim }}>
          VisperNote • {saveStatus === 'saving' ? 'Saving...' : 'Draft saved'}
        </div>
      </div>

      {/* New Entry Modal */}
      {showNewEntry && (
        <div style={s.modalOverlay} onClick={() => setShowNewEntry(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>New Entry ✨</div>
            <div style={s.modalSub}>Give your entry a name to get started</div>
            <input style={s.modalInput} placeholder="Entry title..." value={newEntryTitle} onChange={e => setNewEntryTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmNewEntry()} autoFocus />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={s.modalBtnSecondary} onClick={() => setShowNewEntry(false)}>Cancel</button>
              <button style={s.modalBtnPrimary} onClick={confirmNewEntry}>Create →</button>
            </div>
          </div>
        </div>
      )}

      {/* Date Modal */}
      {showDateModal && (
        <div style={s.modalOverlay} onClick={() => setShowDateModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Choose Date</div>
            <input type="date" style={s.modalInput} value={tempDate} onChange={e => setTempDate(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={s.modalBtnSecondary} onClick={() => setShowDateModal(false)}>Cancel</button>
              <button style={s.modalBtnPrimary} onClick={saveDate}>Save Date</button>
            </div>
          </div>
        </div>
      )}

      {isPresenting && (
        <div style={s.presentOverlay} onClick={() => setIsPresenting(false)}>
          <button style={s.presentClose} onClick={() => setIsPresenting(false)}>Close</button>
          <div style={{ transform: 'scale(1.12)' }}>
            <BookView
              layout={group?.layout || 'diary'}
              groupName={group?.name}
              leftText={leftText}
              rightText={rightText}
              onLeftChange={() => {}}
              onRightChange={() => {}}
              entryDate={meta.date}
              isLocked
              textColor={textColor}
              textAlign={textAlign}
              fontFamily={fontFamily}
              activeFormat={activeFormat}
              initialElements={floatingElements}
              showGrid={showGrid}
              showRuler={showRuler}
            />
          </div>
        </div>
      )}

      {/* ── Design Download Modal ── */}
      {designModal && (() => {
        const { opt, dlPct, done, error } = designModal
        const isGif = opt.filename.toLowerCase().endsWith('.gif')
        const isVideo = opt.filename.toLowerCase().endsWith('.mp4') || opt.filename.toLowerCase().endsWith('.webm')
        const isDownloading = dlPct != null && !done
        const canClose = !isDownloading
        return (
          <div style={s.modalOverlay} onClick={() => { if (canClose) setDesignModal(null) }}>
            <div style={{ ...s.modal, width: 420, gap: 16 }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={s.modalTitle}>
                {done ? '✅ Download complete!' : error ? '❌ Download failed' : `⬇️ ${opt.label}`}
              </div>
              {/* Large preview */}
              <div style={{ width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', border: `1px solid ${cv.border}`, background: '#0a0a0a', flexShrink: 0 }}>
                {isVideo
                  ? <video src={opt.storageUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <img src={opt.storageUrl} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                }
              </div>
              {/* Status / progress */}
              {dlPct == null && !done && !error && (
                <div style={{ fontSize: 12, color: cv.textDim, textAlign: 'center' }}>
                  This design will be saved to your device so you can use it anytime — even offline.
                </div>
              )}
              {isDownloading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${dlPct}%`, height: '100%', background: cv.accent, borderRadius: 99, transition: 'width 0.25s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: cv.textDim, textAlign: 'right' }}>{dlPct}%</div>
                </div>
              )}
              {error && (
                <div style={{ fontSize: 12, color: '#e06c75', textAlign: 'center' }}>
                  Something went wrong. Check your connection and try again.
                </div>
              )}
              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
                {!done && (
                  <button style={s.modalBtnSecondary} onClick={() => setDesignModal(null)} disabled={isDownloading}>
                    Cancel
                  </button>
                )}
                {!done && !error && (
                  <button style={{ ...s.modalBtnPrimary, opacity: isDownloading ? 0.6 : 1, cursor: isDownloading ? 'not-allowed' : 'pointer' }}
                    onClick={isDownloading ? undefined : confirmDesignDownload}
                    disabled={isDownloading}>
                    {isDownloading ? 'Downloading…' : '⬇️ Download'}
                  </button>
                )}
                {(done || error) && (
                  <button style={s.modalBtnPrimary} onClick={() => setDesignModal(null)}>
                    {done ? 'Done ✓' : 'Close'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Delete Entry Modal */}
      {showDeleteEntry && currentEntry && (
        <div style={s.modalOverlay} onClick={() => setShowDeleteEntry(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>Delete entry? 🗑️</div>
            <div style={{ fontSize: 13, color: cv.textDim, textAlign: 'center' }}>
              "<strong style={{ color: cv.text }}>{currentEntry.title}</strong>" will be permanently deleted. This can't be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
              <button style={s.modalBtnSecondary} onClick={() => setShowDeleteEntry(false)}>Cancel</button>
              <button style={{ ...s.modalBtnPrimary, background: '#e06c75' }} onClick={async () => {
                setShowDeleteEntry(false)
                const id = activeEntry
                setActiveEntry(null)
                setEntries(prev => prev.filter(e => e.id !== id))
                const cacheKey = `entries_${activeGroup}`
                const cached = cacheRead(cacheKey) || []
                cacheWrite(cacheKey, cached.filter(e => e.id !== id))
                try {
                  await supabase.from('entries').delete().eq('id', id)
                } catch (e) { console.error('[VN] delete entry error:', e) }
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden image file picker */}
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} />

      <LoadingOverlay visible={loading} />

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-12px); } }
        @keyframes modalPop { from { opacity: 0; transform: scale(0.88) translateY(30px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes vnSlide { from { opacity: 0; transform: translateX(70px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes vnSlideBack { from { opacity: 0; transform: translateX(-70px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes vnFlip { from { opacity: 0.2; transform: rotateY(-80deg); } to { opacity: 1; transform: rotateY(0); } }
        @keyframes vnSpiral { from { opacity: 0; transform: rotate(-10deg) scale(0.82); } to { opacity: 1; transform: rotate(0) scale(1); } }
        @keyframes vnFade { from { opacity: 0.2; } to { opacity: 1; } }
        @keyframes vnZoom { from { opacity: 0; transform: scale(0.86); } to { opacity: 1; transform: scale(1); } }
        @keyframes vnEntryIn { 0% { opacity: 0; transform: translateY(18px) scale(0.96); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes vnEntryOut { 0% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0.25; transform: translateY(-18px) scale(0.96); } }
      `}</style>
    </div>
  )
}

const SURFACE_ALT = 'var(--vn-panel)'
const s = {
  root: { fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: cv.bg, color: cv.text, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none' },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: `1px solid rgba(255,255,255,0.07)` },
  topnav: { height: 38, background: cv.surface, borderBottom: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', padding: '0 4px', gap: 2, flexShrink: 0, overflowX: 'hidden' },
  navItem: { padding: '5px 12px', borderRadius: 6, fontSize: 12.5, color: cv.textDim, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' },
  navActive: { color: cv.accent, background: cv.accentDim, fontWeight: 500 },
  toolbar: { height: 68, background: SURFACE_ALT, borderBottom: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 2, flexShrink: 0, overflowX: 'auto' },
  toolBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '6px 14px', borderRadius: 8, cursor: 'pointer', minWidth: 58, transition: 'background 0.15s' },
  toolBtnActive: { background: cv.accentDim },
  toolLabel: { fontSize: 10.5, color: cv.textDim, whiteSpace: 'nowrap' },
  toolSep: { width: 1, height: 36, background: cv.border, margin: '0 4px', flexShrink: 0, alignSelf: 'center' },
  subInput: { background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 11, color: cv.text, outline: 'none', fontFamily: 'inherit', width: 140, userSelect: 'text' },
  writing: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: cv.bg },
  canvas: { borderRadius: 20, border: `1px solid rgba(255,255,255,0.06)`, boxShadow: 'inset 0 0 60px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, minWidth: 600, minHeight: 500, width: '100%', height: '100%', overflow: 'hidden', transition: 'background 0.4s ease' },
  entriesView: { width: '100%', maxWidth: 640, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 24px' },
  entriesHeader: { display: 'flex', flexDirection: 'column', gap: 4, padding: '24px 0 16px', flexShrink: 0 },
  entriesTitle: { fontFamily: 'Georgia, serif', fontSize: 22, color: cv.text, fontWeight: 400 },
  entriesSubtitle: { fontSize: 12, color: cv.textDim },
  entriesList: { display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingBottom: 24, scrollbarGutter: 'stable' },
  entryCard: { background: cv.surface, border: `1px solid ${cv.border}`, borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', gap: 6 },
  entryCardExpanded: { background: cv.hover, border: `1px solid rgba(255,255,255,0.12)` },
  entryExpand: { marginTop: 8, paddingTop: 12, borderTop: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  openBtn: { padding: '7px 16px', borderRadius: 8, background: cv.accent, border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  entryTitle: { fontSize: 14, fontWeight: 500, color: cv.text },
  renameInput: { fontSize: 14, fontWeight: 500, color: cv.text, background: 'transparent', border: 'none', borderBottom: `1px solid ${cv.accent}`, outline: 'none', fontFamily: 'inherit', width: '100%', padding: '0 2px', userSelect: 'text' },
  entryDate: { fontSize: 11, color: cv.textDim, flexShrink: 0 },
  entryPreview: { fontSize: 12, color: cv.textMid, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  newEntryCard: { background: 'transparent', border: `1px dashed ${cv.border}`, borderRadius: 14, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, color: cv.textDim, transition: 'all 0.2s ease' },
  metaBar: { minHeight: 36, background: SURFACE_ALT, borderBottom: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0, flexWrap: 'wrap' },
  metaPill: { background: cv.elevated, border: `1px solid ${cv.border}`, color: cv.textMid, borderRadius: 20, padding: '3px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 },
  sizePreview: { borderRadius: '50%', border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 },
  tag: { background: cv.accentDim, border: `1px solid ${cv.accentBorder}`, color: cv.accent, borderRadius: 20, padding: '2px 10px', fontSize: 11, display: 'flex', alignItems: 'center' },
  tagSmall: { background: cv.accentDim, color: cv.accent, borderRadius: 20, padding: '1px 8px', fontSize: 10 },
  tagInput: { background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: cv.text, fontFamily: 'inherit', width: 180, userSelect: 'text' },
  moodBtn: { fontSize: 18, cursor: 'pointer', padding: '3px 6px', borderRadius: 6, transition: 'all 0.15s' },
  statusbar: { height: 24, background: SURFACE_ALT, borderTop: `1px solid ${cv.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 16, flexShrink: 0, position: 'relative' },
  statusItem: { fontSize: 10.5, color: cv.textDim, display: 'flex', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: '50%', background: cv.green },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: cv.surface, border: `1px solid ${cv.border}`, borderRadius: 16, padding: 28, width: 380, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', animation: 'modalPop 0.35s cubic-bezier(0.23,1,0.32,1)' },
  modalTitle: { fontSize: 18, fontWeight: 600, color: cv.text },
  modalSub: { fontSize: 12, color: cv.textDim, marginTop: -8 },
  modalInput: { background: cv.elevated, border: `1px solid ${cv.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: cv.text, outline: 'none', fontFamily: 'inherit', userSelect: 'text' },
  modalBtnPrimary: { padding: '8px 20px', borderRadius: 8, background: cv.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  modalBtnSecondary: { padding: '8px 20px', borderRadius: 8, background: 'transparent', border: `1px solid ${cv.border}`, color: cv.textMid, fontSize: 13, cursor: 'pointer' },
  presentOverlay: { position: 'fixed', inset: 0, background: 'radial-gradient(circle at center, #1a1a24 0%, #060608 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, overflow: 'hidden' },
  presentClose: { position: 'fixed', top: 18, right: 18, zIndex: 1201, padding: '8px 14px', borderRadius: 8, border: `1px solid ${cv.border}`, background: cv.surface, color: cv.textMid, cursor: 'pointer', fontFamily: 'inherit' },
}