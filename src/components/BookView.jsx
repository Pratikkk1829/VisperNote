import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { colors } from '../styles/theme'

const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const LINE_H = 28
const makeCursor = (emoji) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><text y="22" font-size="22">${emoji}</text></svg>`
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 2 22, crosshair`
}
const DRAW_CURSOR = {
  Pencil: makeCursor('✏️'),
  Pen: makeCursor('🖊️'),
  Brush: makeCursor('🖌️'),
  Eraser: makeCursor('◻️'),
}
const strokeForTool = (tool, color, size) => {
  if (tool === 'Brush') return { stroke: color, strokeWidth: size, opacity: 0.68 }
  if (tool === 'Pen') return { stroke: color, strokeWidth: Math.max(2, size * 0.7), opacity: 0.92 }
  return { stroke: color, strokeWidth: Math.max(1.5, size * 0.45), opacity: 0.78 }
}
const pointsToPath = (points) => {
  if (!points.length) return ''
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`).join(' ')
}
const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// Inject placeholder CSS once — hardcoded style so formatting never affects it
if (typeof document !== 'undefined' && !document.getElementById('diary-placeholder-style')) {
  const style = document.createElement('style')
  style.id = 'diary-placeholder-style'
  style.textContent = `
    [contenteditable][data-placeholder]:empty:before {
      content: attr(data-placeholder);
      color: rgba(90,42,24,0.4);
      font-style: italic !important;
      font-family: Georgia, serif !important;
      font-size: 13px !important;
      text-align: left !important;
      pointer-events: none;
      display: block;
    }
  `
  document.head.appendChild(style)
}

// ── FLOATING ELEMENT (draggable + resizable) ─────────────────
function FloatingElement({ el, onUpdate, onSelect, isSelected, onDelete, pageW, pageH, onCrossPage, isLocked }) {
  const dragRef = useRef(null)
  const resizeRef = useRef(null)
  const tooltipTimerRef = useRef(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(el.text || el.href || '')
  const isHoveringEl = useRef(false)
  const isHoveringTip = useRef(false)

  const openLink = () => {
    if (!el.href) return
    try {
      const { shell } = window.require('electron')
      shell.openExternal(el.href)
    } catch {
      window.open(el.href, '_blank')
    }
  }

  const startHoverTimer = () => {
    if (el.type !== 'link' || !el.href) return
    tooltipTimerRef.current = setTimeout(() => setShowTooltip(true), 750)
  }
  const cancelHoverTimer = () => {
    clearTimeout(tooltipTimerRef.current)
    setTimeout(() => {
      if (!isHoveringEl.current && !isHoveringTip.current) setShowTooltip(false)
    }, 80)
  }

  const clamp = (x, y, w, h) => ({
    x: Math.max(0, Math.min(x, pageW - w)),
    y: Math.max(0, Math.min(y, pageH - h)),
    w: Math.max(40, Math.min(w, pageW)),
    h: Math.max(24, Math.min(h, pageH)),
  })

  const onMouseDownDrag = (e) => {
    if (isLocked) return
    if (e.target === resizeRef.current) return
    e.preventDefault()
    onSelect()
    const rect = dragRef.current?.closest('[data-page]')?.getBoundingClientRect()
    const startX = e.clientX - el.x
    const startY = e.clientY - el.y
    const onMove = (ev) => {
      if (!rect) { const { x, y } = clamp(ev.clientX - startX, ev.clientY - startY, el.w, el.h); onUpdate({ x, y }); return }
      // Calculate x relative to page
      const rawX = ev.clientX - rect.left - (e.clientX - rect.left - el.x)
      const rawY = ev.clientY - rect.top  - (e.clientY - rect.top  - el.y)
      // Detect cross-page: only fire in the outward direction
      if (onCrossPage) {
        if (rawX > pageW - el.w * 0.4) { onCrossPage('next', 10, Math.max(0, Math.min(rawY, pageH - el.h))); return }
        if (rawX < -el.w * 0.6) { onCrossPage('prev', Math.max(0, pageW - el.w - 10), Math.max(0, Math.min(rawY, pageH - el.h))); return }
      }
      const { x, y } = clamp(rawX, rawY, el.w, el.h)
      onUpdate({ x, y })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onMouseDownResize = (e) => {
    if (isLocked) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startW = el.w
    const startH = el.h
    const onMove = (ev) => {
      const { w, h } = clamp(el.x, el.y, startW + ev.clientX - startX, startH + ev.clientY - startY)
      onUpdate({ w, h })
    }
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={dragRef}
      data-floating-el
      onMouseDown={onMouseDownDrag}
      onMouseEnter={() => {
        isHoveringEl.current = true
        startHoverTimer()
      }}
      onMouseLeave={() => {
        isHoveringEl.current = false
        cancelHoverTimer()
      }}
      onDoubleClick={(e) => {
        if (el.type === 'link' && !isLocked) { e.stopPropagation(); setEditing(true) }
      }}
      style={{
        position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
        cursor: isLocked ? 'default' : el.type === 'inkStroke' ? 'default' : 'move',
        userSelect: 'none',
        pointerEvents: el.type === 'inkStroke' ? 'none' : 'auto',
        outline: isSelected && el.type !== 'inkStroke' ? '2px solid #c97b5a' : '2px solid transparent',
        borderRadius: el.type === 'link' ? 6 : 4,
        boxSizing: 'border-box', zIndex: isSelected ? 10 : 5,
        overflow: 'visible',
        animation: el.animation || 'none',
      }}
    >
      {/* Hover pill tooltip for links */}
      {showTooltip && el.type === 'link' && (
        <div
          onMouseEnter={() => { isHoveringTip.current = true }}
          onMouseLeave={() => { isHoveringTip.current = false; cancelHoverTimer() }}
          onClick={(e) => { e.stopPropagation(); openLink() }}
          style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(20,16,10,0.92)', color: '#e8d8c8',
            fontSize: 11, padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap',
            border: '1px solid rgba(255,255,255,0.12)', zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            cursor: 'pointer', userSelect: 'none',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          🔗 <span>Open link</span>
        </div>
      )}
      {/* Clip inner content to element bounds */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
      {el.type === 'image' && (
        <img src={el.src} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 4, display: 'block', pointerEvents: 'none' }} />
      )}
      {el.type === 'shape' && (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block', pointerEvents: 'none' }}>
          {el.shape === 'Rectangle' && <rect x="2" y="2" width="96" height="96" rx="4" fill="none" stroke="#c97b5a" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
          {el.shape === 'Square'    && <rect x="2" y="2" width="96" height="96" rx="4" fill="none" stroke="#c97b5a" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
          {el.shape === 'Circle'    && <ellipse cx="50" cy="50" rx="48" ry="48" fill="none" stroke="#c97b5a" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
          {el.shape === 'Triangle'  && <polygon points="50,3 97,97 3,97" fill="none" stroke="#c97b5a" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
          {el.shape === 'Star'      && <polygon points="50,5 61,35 95,35 68,57 79,91 50,70 21,91 32,57 5,35 39,35" fill="none" stroke="#c97b5a" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
          {el.shape === 'Diamond'   && <polygon points="50,2 98,50 50,98 2,50" fill="none" stroke="#c97b5a" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
          {el.shape === 'Line'      && <line x1="2" y1="50" x2="98" y2="50" stroke="#c97b5a" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
          {el.shape === 'Arrow'     && <><line x1="2" y1="50" x2="88" y2="50" stroke="#c97b5a" strokeWidth="3" vectorEffect="non-scaling-stroke" /><polygon points="88,38 98,50 88,62" fill="#c97b5a" /></>}
        </svg>
      )}
      {el.type === 'ink' && (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: 'block', pointerEvents: 'none' }}>
          <path
            d={el.path || 'M8 70 C24 18 42 82 58 30 S82 18 94 58'}
            fill="none"
            stroke={el.stroke || '#5a2a18'}
            strokeWidth={el.strokeWidth || 4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={el.opacity || 0.9}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {el.type === 'inkStroke' && (
        <svg width="100%" height="100%" viewBox={`0 0 ${el.w || pageW} ${el.h || pageH}`} preserveAspectRatio="none" style={{ display: 'block', pointerEvents: 'none' }}>
          <path
            d={el.path || ''}
            fill="none"
            stroke={el.stroke || '#5a2a18'}
            strokeWidth={el.strokeWidth || 4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={el.opacity || 0.9}
          />
        </svg>
      )}
      {el.type === 'link' && (
        editing ? (
          <input
            autoFocus
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={() => { setEditing(false); onUpdate({ text: editText }) }}
            onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onUpdate({ text: editText }) } e.stopPropagation() }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              color: el.linkColor || '#7a8ec9', fontSize: 12,
              fontFamily: "'DM Sans', sans-serif", border: 'none',
              background: 'rgba(255,255,255,0.15)', outline: `1.5px solid ${el.linkColor || '#7a8ec9'}`,
              borderRadius: 6, padding: '2px 8px', boxSizing: 'border-box', textAlign: 'center',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: el.boxBg || 'transparent',
            border: el.borderVisible ? `1.5px solid ${el.linkColor || '#7a8ec9'}` : 'none',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2px 6px', boxSizing: 'border-box', pointerEvents: 'none',
          }}>
            <a href={el.href} style={{ color: el.linkColor || '#7a8ec9', textDecoration: 'underline', fontSize: 12, fontFamily: "'DM Sans', sans-serif", pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {el.text || el.href}
            </a>
          </div>
        )
      )}
      </div>{/* end clip div */}
      {isSelected && !isLocked && el.type !== 'inkStroke' && (
        <>
          <div onClick={(e) => { e.stopPropagation(); onDelete() }}
            style={{ position: 'absolute', top: -10, right: -10, width: 20, height: 20, borderRadius: '50%', background: '#e05555', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 20 }}>✕</div>
          <div ref={resizeRef} onMouseDown={onMouseDownResize}
            style={{ position: 'absolute', bottom: -4, right: -4, width: 12, height: 12, borderRadius: 2, background: '#c97b5a', cursor: 'se-resize', zIndex: 20 }} />
        </>
      )}
    </div>
  )
}

// ── DIARY LAYOUT ─────────────────────────────────────────────
const DiaryLayout = forwardRef(function DiaryLayout({ layoutType = 'diary', groupName, leftText, rightText, onLeftChange, onRightChange, entryDate, isLocked, textColor, textAlign, fontFamily, activeFormat, onFocusTextarea, onRegisterInsert, initialElements, onElementsChange, showGrid, showRuler, pageAnimation, drawTool, drawColor, drawSize, onSelectElement }, ref) {
  const [spreads, setSpreads] = useState([{ left: leftText || '', right: rightText || '' }])
  const [currentSpread, setCurrentSpread] = useState(0)
  const [turn, setTurn] = useState(null)
  const totalSpreads = spreads.length

  const turnTo = useCallback((dir) => {
    const canTurn = dir === 'next' ? currentSpread < spreads.length - 1 : currentSpread > 0
    if (!canTurn) return
    setTurn(dir)
    setTimeout(() => {
      setCurrentSpread(p => dir === 'next' ? Math.min(spreads.length - 1, p + 1) : Math.max(0, p - 1))
      setTimeout(() => setTurn(null), 440)
    }, 420)
  }, [currentSpread, spreads.length])

  useImperativeHandle(ref, () => ({
    nextPage: () => turnTo('next'),
    prevPage: () => turnTo('prev'),
  }))  // no dep array — always fresh, avoids stale closure

  const leftRef = useRef(null)
  const rightRef = useRef(null)
  const initializedRef = useRef(false)
  const lastFormatRef = useRef({})
  const [elements, setElements] = useState(() => Array.isArray(initialElements) ? initialElements : [])
  const [selectedEl, setSelectedEl] = useState(null)
  const drawingRef = useRef(null)

  // Deselect element when clicking anywhere outside a floating element
  useEffect(() => {
    const onMouseDown = (e) => {
      if (!e.target.closest('[data-floating-el]')) setSelectedEl(null)
    }
    window.addEventListener('mousedown', onMouseDown)
    return () => window.removeEventListener('mousedown', onMouseDown)
  }, [])

  useEffect(() => {
    setElements(Array.isArray(initialElements) ? initialElements : [])
  }, [initialElements])

  // Notify parent whenever elements change so they can be persisted
  const setElementsAndNotify = useCallback((updater) => {
    setElements(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      onElementsChange?.(next)
      return next
    })
  }, [onElementsChange])
  const leftPageRef = useRef(null)
  const rightPageRef = useRef(null)
  const [pageDims, setPageDims] = useState({ w: 300, h: 480 })

  useEffect(() => {
    const measure = () => {
      if (leftPageRef.current) {
        setPageDims({ w: leftPageRef.current.offsetWidth, h: leftPageRef.current.offsetHeight })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const localPoint = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top, rect.height)),
    }
  }

  const beginDraw = (page, e) => {
    if (!drawTool || isLocked) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const start = localPoint(e)
    if (drawTool === 'Eraser') {
      drawingRef.current = { tool: 'Eraser', page }
      eraseInkAt(page, start)
      return
    }
    const id = Date.now()
    const stroke = {
      id,
      type: 'inkStroke',
      page,
      x: 0,
      y: 0,
      w: pageDims.w,
      h: pageDims.h,
      points: [start],
      path: pointsToPath([start]),
      ...strokeForTool(drawTool, drawColor, drawSize || 6),
    }
    drawingRef.current = { id, points: [start], tool: drawTool }
    setElementsAndNotify(prev => [...prev, stroke])
  }

  const moveDraw = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    const point = localPoint(e)
    if (drawingRef.current.tool === 'Eraser') {
      eraseInkAt(drawingRef.current.page, point)
      return
    }
    // Capture ref values before async setState to avoid null access
    const drawId = drawingRef.current.id
    drawingRef.current.points = [...drawingRef.current.points, point]
    const pts = drawingRef.current.points
    const path = pointsToPath(pts)
    setElementsAndNotify(prev => prev.map(el => (
      el && el.id === drawId ? { ...el, points: pts, path } : el
    )))
  }

  const endDraw = (e) => {
    if (!drawingRef.current) return
    e.preventDefault()
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    drawingRef.current = null
  }

  const eraseInkAt = (page, point) => {
    const radius = Math.max(6, (drawSize || 6) / 2)
    setElementsAndNotify(prev => prev.flatMap(el => {
      if (el.type !== 'inkStroke' || el.page !== page) return [el]
      const chunks = []
      let current = []
      ;(el.points || []).forEach(p => {
        if (pointDistance(p, point) <= radius) {
          if (current.length > 1) chunks.push(current)
          current = []
        } else {
          current.push(p)
        }
      })
      if (current.length > 1) chunks.push(current)
      if (!chunks.length) return []
      return chunks.map((points, idx) => ({
        ...el,
        id: idx === 0 ? el.id : `${el.id}-${Date.now()}-${idx}`,
        points,
        path: pointsToPath(points),
      }))
    }))
  }

  // Expose insertElement to parent via callback
  useEffect(() => {
    onRegisterInsert?.((el) => {
      const w = el.w || (el.type === 'link' ? 160 : el.type === 'shape' ? 80 : 120)
      const h = el.h || (el.type === 'link' ? 36 : el.type === 'shape' ? 80 : 90)
      setElementsAndNotify(prev => [...prev, {
        id: Date.now(),
        page: focusedPageRef.current || 'left',
        x: Math.max(0, (pageDims.w - w) / 2),
        y: Math.max(0, (pageDims.h - h) / 2),
        w, h,
        ...el,
      }])
    })
  }, [pageDims])

  // Initialize content once on mount
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      if (leftRef.current)  leftRef.current.innerHTML  = leftText  || ''
      if (rightRef.current) rightRef.current.innerHTML = rightText || ''
    }
  }, [])

  const focusedPageRef = useRef(null) // 'left' | 'right' | null

  // Apply formatting commands when activeFormat changes
  useEffect(() => {
    const prev = lastFormatRef.current
    if (!activeFormat || !focusedPageRef.current) { lastFormatRef.current = { ...activeFormat }; return }
    const el = focusedPageRef.current === 'left' ? leftRef.current : rightRef.current
    if (!el) return
    el.focus()
    if (activeFormat.bold      !== prev.bold)      document.execCommand('bold')
    if (activeFormat.italic    !== prev.italic)    document.execCommand('italic')
    if (activeFormat.underline !== prev.underline) document.execCommand('underline')
    if (activeFormat.strike    !== prev.strike)    document.execCommand('strikeThrough')
    lastFormatRef.current = { ...activeFormat }
  }, [activeFormat])

  // Apply color
  useEffect(() => {
    if (!textColor || !focusedPageRef.current) return
    const el = focusedPageRef.current === 'left' ? leftRef.current : rightRef.current
    if (!el) return
    el.focus()
    document.execCommand('foreColor', false, textColor)
  }, [textColor])

  // Apply font
  useEffect(() => {
    if (!fontFamily || !focusedPageRef.current) return
    const el = focusedPageRef.current === 'left' ? leftRef.current : rightRef.current
    if (!el) return
    el.focus()
    document.execCommand('fontName', false, fontFamily)
  }, [fontFamily])

  // Apply align
  useEffect(() => {
    if (!textAlign || !focusedPageRef.current) return
    const el = focusedPageRef.current === 'left' ? leftRef.current : rightRef.current
    if (!el) return
    el.focus()
    const cmds = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' }
    if (cmds[textAlign]) document.execCommand(cmds[textAlign])
  }, [textAlign])

  const isFull = (el) => el && el.scrollHeight > el.clientHeight + 2

  const addNewSpread = useCallback(() => {
    setSpreads(prev => [...prev, { left: '', right: '' }])
    setCurrentSpread(prev => prev + 1)
  }, [])

  const handleInput = useCallback((side) => {
    const el = side === 'left' ? leftRef.current : rightRef.current
    if (!el) return
    if (el.innerHTML === '<br>' || el.innerHTML === '<br/>') el.innerHTML = ''
    const html = el.innerHTML
    setSpreads(prev => prev.map((s, i) => i === currentSpread ? { ...s, [side]: html } : s))
    if (side === 'left') onLeftChange?.(html)
    else onRightChange?.(html)
    if (isFull(el)) {
      if (side === 'left') rightRef.current?.focus()
      else addNewSpread()
    }
  }, [currentSpread, addNewSpread, onLeftChange, onRightChange])

  // When spread changes, update contentEditable content
  useEffect(() => {
    const spread = spreads[currentSpread]
    if (!spread) return
    if (leftRef.current  && leftRef.current.innerHTML  !== spread.left)  leftRef.current.innerHTML  = spread.left  || ''
    if (rightRef.current && rightRef.current.innerHTML !== spread.right) rightRef.current.innerHTML = spread.right || ''
    setTimeout(() => leftRef.current?.focus(), 20)
  }, [currentSpread])

  const spread = spreads[currentSpread] || { left: '', right: '' }
  const isProject = layoutType === 'project'
  const leftPageNum  = currentSpread * 2 + 1
  const rightPageNum = currentSpread * 2 + 2

  const editableStyle = {
    ...diaryText,
    overflow: 'hidden',
    outline: 'none',
    cursor: isLocked ? 'not-allowed' : 'text',
    opacity: isLocked ? 0.7 : 1,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <style>{`
        @keyframes vnPageFlipNext {
          0% { transform: rotateY(0deg) translateX(0) translateZ(2px) skewY(0deg); filter: brightness(1); box-shadow: -2px 0 8px rgba(0,0,0,0.14); }
          28% { transform: rotateY(-38deg) translateX(-5px) translateZ(18px) skewY(-0.8deg); filter: brightness(1.03); box-shadow: -10px 0 24px rgba(0,0,0,0.20); }
          58% { transform: rotateY(-104deg) translateX(-12px) translateZ(28px) skewY(-1.8deg); filter: brightness(0.96); box-shadow: -24px 0 42px rgba(0,0,0,0.24); }
          100% { transform: rotateY(-176deg) translateX(-4px) translateZ(4px) skewY(-0.4deg); filter: brightness(0.9); box-shadow: -6px 0 14px rgba(0,0,0,0.14); }
        }
        @keyframes vnPageFlipPrev {
          0% { transform: rotateY(0deg) translateX(0) translateZ(2px) skewY(0deg); filter: brightness(1); box-shadow: 2px 0 8px rgba(0,0,0,0.14); }
          28% { transform: rotateY(38deg) translateX(5px) translateZ(18px) skewY(0.8deg); filter: brightness(1.03); box-shadow: 10px 0 24px rgba(0,0,0,0.20); }
          58% { transform: rotateY(104deg) translateX(12px) translateZ(28px) skewY(1.8deg); filter: brightness(0.96); box-shadow: 24px 0 42px rgba(0,0,0,0.24); }
          100% { transform: rotateY(176deg) translateX(4px) translateZ(4px) skewY(0.4deg); filter: brightness(0.9); box-shadow: 6px 0 14px rgba(0,0,0,0.14); }
        }
      `}</style>
      <div style={{ perspective: 1200 }}>
      <div style={{ ...bookShell, animation: pageAnimation || 'none', position: 'relative', transformStyle: 'preserve-3d', perspective: 1400, overflow: 'visible' }}>

        {/* Left page */}
        <div ref={leftPageRef} data-page="left" style={{ ...diaryPage, borderRadius: '14px 4px 4px 14px', position: 'relative', overflow: 'hidden' }}>
          {showGrid && <div style={gridOverlay} />}
          {showRuler && <div style={rulerTop} />}
          {showRuler && <div style={rulerSide} />}
          <div style={diaryDate}>{isProject ? 'Folder page' : 'Date'} : {isProject ? groupName : (entryDate || today)}</div>
          <div ref={leftRef} contentEditable={!isLocked} suppressContentEditableWarning style={editableStyle}
            data-placeholder={isProject ? 'Blank project page...' : 'Begin writing your thoughts here...'}
            onInput={() => !isLocked && handleInput('left')}
            onFocus={() => { focusedPageRef.current = 'left'; onFocusTextarea?.(leftRef.current) }} />
          {elements.filter(e => e && e.id != null && e.page === 'left').map(el => (
            <FloatingElement key={el.id} el={el} isSelected={selectedEl === el.id}
              pageW={pageDims.w} pageH={pageDims.h}
              onSelect={() => { setSelectedEl(el.id); onSelectElement?.(el.id) }}
              onUpdate={(fields) => setElementsAndNotify(prev => prev.map(e => e.id === el.id ? { ...e, ...fields } : e))}
              onDelete={() => { setElementsAndNotify(prev => prev.filter(e => e.id !== el.id)); setSelectedEl(null); onSelectElement?.(null) }}
              isLocked={isLocked}
              onCrossPage={(dir, nx, ny) => {
                if (dir === 'next') setElementsAndNotify(prev => prev.map(e => e.id === el.id ? { ...e, page: 'right', x: nx, y: ny } : e))
                // 'prev' intentionally ignored — left page has no left neighbour
              }}
            />
          ))}
          {drawTool && !isLocked && (
            <div
              style={{ ...drawOverlay, cursor: DRAW_CURSOR[drawTool] || 'crosshair' }}
              onPointerDown={(e) => beginDraw('left', e)}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
            />
          )}
          <div style={diaryFooter}>
            <button style={{ ...navBtn, opacity: currentSpread === 0 ? 0.3 : 1 }}
              onClick={() => turnTo('prev')} disabled={currentSpread === 0}>←</button>
            <span style={pageNum2}>{leftPageNum}</span>
          </div>
        </div>

        {/* Spine */}
        <div style={{ width: 3, background: '#0e0a04', borderRadius: 2, flexShrink: 0, margin: '8px 0' }} />

        {/* Right page */}
        <div ref={rightPageRef} data-page="right" style={{ ...diaryPage, borderRadius: '4px 14px 14px 4px', position: 'relative', overflow: 'hidden' }}>
          {showGrid && <div style={gridOverlay} />}
          {showRuler && <div style={rulerTop} />}
          {showRuler && <div style={rulerSide} />}
          <div style={diaryDate}>{isProject ? 'Folder page' : 'Date'} : {isProject ? groupName : (entryDate || today)}</div>
          <div ref={rightRef} contentEditable={!isLocked} suppressContentEditableWarning style={editableStyle}
            data-placeholder={isProject ? 'Add notes, plans, drafts, or references...' : '...continue on the next page.'}
            onInput={() => !isLocked && handleInput('right')}
            onFocus={() => { focusedPageRef.current = 'right'; onFocusTextarea?.(rightRef.current) }} />
          {elements.filter(e => e && e.id != null && e.page === 'right').map(el => (
            <FloatingElement key={el.id} el={el} isSelected={selectedEl === el.id}
              pageW={pageDims.w} pageH={pageDims.h}
              onSelect={() => { setSelectedEl(el.id); onSelectElement?.(el.id) }}
              onUpdate={(fields) => setElementsAndNotify(prev => prev.map(e => e.id === el.id ? { ...e, ...fields } : e))}
              onDelete={() => { setElementsAndNotify(prev => prev.filter(e => e.id !== el.id)); setSelectedEl(null); onSelectElement?.(null) }}
              isLocked={isLocked}
              onCrossPage={(dir, nx, ny) => {
                if (dir === 'prev') setElementsAndNotify(prev => prev.map(e => e.id === el.id ? { ...e, page: 'left', x: nx, y: ny } : e))
              }}
            />
          ))}
          {drawTool && !isLocked && (
            <div
              style={{ ...drawOverlay, cursor: DRAW_CURSOR[drawTool] || 'crosshair' }}
              onPointerDown={(e) => beginDraw('right', e)}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
            />
          )}
          <div style={diaryFooter}>
            <span style={pageNum2}>{rightPageNum}</span>
            <button style={{ ...navBtn, opacity: currentSpread >= totalSpreads - 1 ? 0.3 : 1 }}
              onClick={() => turnTo('next')}
              disabled={currentSpread >= totalSpreads - 1}>→</button>
          </div>
        </div>
        {turn && (
          <div style={{
            ...turnPage,
            left: turn === 'next' ? 309 : 6,
            borderRadius: turn === 'next' ? '4px 14px 14px 4px' : '14px 4px 4px 14px',
            transformOrigin: turn === 'next' ? 'left center' : 'right center',
            animation: turn === 'next'
              ? 'vnPageFlipNext 0.88s cubic-bezier(0.18,0.72,0.14,1) both'
              : 'vnPageFlipPrev 0.88s cubic-bezier(0.18,0.72,0.14,1) both',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: turn === 'next' ? 'linear-gradient(90deg, rgba(80,36,18,0.14), transparent 24%, rgba(255,255,255,0.22) 66%, rgba(80,36,18,0.1))' : 'linear-gradient(90deg, rgba(80,36,18,0.1), rgba(255,255,255,0.22) 34%, transparent 76%, rgba(80,36,18,0.14))', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, [turn === 'next' ? 'left' : 'right']: 0, width: 18, background: 'linear-gradient(90deg, rgba(70,32,16,0.18), transparent)', filter: 'blur(2px)' }} />
            <div style={{ ...diaryDate, opacity: 0.5 }}>{isProject ? 'Folder page' : 'Date'} : {isProject ? groupName : (entryDate || today)}</div>
          </div>
        )}
      </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(10,8,6,0.55)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '5px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={label}>{isProject ? '🗂️ Folder' : '📔 Diary'} — {groupName} &nbsp;·&nbsp; Spread {currentSpread + 1} of {totalSpreads}</div>
        {currentSpread === totalSpreads - 1 && (
          <button
            style={{ fontSize: 11, color: colors.accent, background: 'transparent', border: `1px solid ${colors.accentBorder}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
            onClick={addNewSpread}
          >+ New page</button>
        )}
      </div>
    </div>
  )
})

// ── FOLDER PAGE LAYOUT ───────────────────────────────────────
const parseFolderPages = (leftText, rightText) => {
  try {
    const parsed = JSON.parse(rightText || '[]')
    if (Array.isArray(parsed) && parsed.length) {
      const pages = parsed.map(p => String(p || ''))
      if (leftText && !pages[0]) pages[0] = leftText
      return pages
    }
  } catch {}
  return [leftText || '']
}

const FolderLayout = forwardRef(function FolderLayout({ groupName, groupColor = colors.accent, groupIcon = '📁', leftText, rightText, onLeftChange, onRightChange, entryDate, isLocked, onFocusTextarea, showGrid, showRuler }, ref) {
  const [pages, setPages] = useState(() => parseFolderPages(leftText, rightText))
  const [currentPage, setCurrentPage] = useState(0)
  const [turn, setTurn] = useState(null)
  const pageRef = useRef(null)
  const pageCount = Math.max(1, pages.length)
  const currentHtml = pages[currentPage] || ''

  useEffect(() => {
    if (pageRef.current && pageRef.current.innerHTML !== currentHtml) {
      pageRef.current.innerHTML = currentHtml
    }
    setTimeout(() => pageRef.current?.focus(), 35)
  }, [currentPage])

  const persistPages = useCallback((nextPages) => {
    onLeftChange?.(nextPages[0] || '')
    onRightChange?.(JSON.stringify(nextPages))
  }, [onLeftChange, onRightChange])

  const handleInput = () => {
    if (!pageRef.current || isLocked) return
    const html = pageRef.current.innerHTML === '<br>' ? '' : pageRef.current.innerHTML
    setPages(prev => {
      const next = [...prev]
      next[currentPage] = html
      persistPages(next)
      return next
    })
  }

  const turnFolderPage = useCallback((dir) => {
    if (dir === 'prev' && currentPage === 0) return
    setTurn(dir)
    setTimeout(() => {
      setCurrentPage(prev => {
        if (dir === 'prev') return Math.max(0, prev - 1)
        if (prev < pages.length - 1) return prev + 1
        const nextPages = [...pages, '']
        setPages(nextPages)
        persistPages(nextPages)
        return prev + 1
      })
      setTimeout(() => setTurn(null), 430)
    }, 380)
  }, [currentPage, pages, persistPages])

  useImperativeHandle(ref, () => ({
    nextPage: () => turnFolderPage('next'),
    prevPage: () => turnFolderPage('prev'),
  }), [turnFolderPage])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <style>{`
        @keyframes vnFolderPageIn {
          from { opacity: 0; transform: translateY(18px) rotateX(8deg) scale(0.96); }
          to { opacity: 1; transform: translateY(0) rotateX(0) scale(1); }
        }
        @keyframes vnFolderFlipNext {
          0% { transform: rotateY(0deg) translateX(0) translateZ(2px) skewY(0); filter: brightness(1); }
          35% { transform: rotateY(-46deg) translateX(-8px) translateZ(18px) skewY(-0.7deg); filter: brightness(1.03); }
          68% { transform: rotateY(-118deg) translateX(-18px) translateZ(28px) skewY(-1.4deg); filter: brightness(0.96); }
          100% { transform: rotateY(-176deg) translateX(-6px) translateZ(3px) skewY(-0.2deg); filter: brightness(0.9); }
        }
        @keyframes vnFolderFlipPrev {
          0% { transform: rotateY(0deg) translateX(0) translateZ(2px) skewY(0); filter: brightness(1); }
          35% { transform: rotateY(46deg) translateX(8px) translateZ(18px) skewY(0.7deg); filter: brightness(1.03); }
          68% { transform: rotateY(118deg) translateX(18px) translateZ(28px) skewY(1.4deg); filter: brightness(0.96); }
          100% { transform: rotateY(176deg) translateX(6px) translateZ(3px) skewY(0.2deg); filter: brightness(0.9); }
        }
      `}</style>
      <div style={{ position: 'relative', perspective: 1500 }}>
        <div style={{
          width: 560,
          minHeight: 620,
          borderRadius: 18,
          background: '#f1e3cc',
          color: '#4f2b18',
          boxShadow: `0 28px 75px rgba(0,0,0,0.46), 0 0 0 1px ${groupColor}55`,
          overflow: 'hidden',
          animation: 'vnFolderPageIn 0.38s cubic-bezier(0.2,0.8,0.2,1) both',
          position: 'relative',
        }}>
          {showGrid && <div style={gridOverlay} />}
          {showRuler && <div style={rulerTop} />}
          {showRuler && <div style={rulerSide} />}
          <div style={{ height: 72, padding: '18px 28px 12px', background: `linear-gradient(135deg, ${groupColor}33, rgba(255,255,255,0.22))`, borderBottom: `1px solid ${groupColor}55`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${groupColor}26`, border: `1px solid ${groupColor}77`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{groupIcon}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 700, color: '#3d2114', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{groupName || 'Project folder'}</div>
              <div style={{ fontSize: 12, color: '#8a6144', marginTop: 3 }}>Page {currentPage + 1} of {pageCount} · {entryDate || today}</div>
            </div>
          </div>
          <div style={{ padding: '30px 42px 36px', position: 'relative' }}>
            <div
              ref={pageRef}
              contentEditable={!isLocked}
              suppressContentEditableWarning
              data-placeholder="Start writing in this folder page..."
              onInput={handleInput}
              onFocus={() => onFocusTextarea?.(pageRef.current)}
              style={{
                minHeight: 460,
                outline: 'none',
                color: '#4f2b18',
                fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
                fontSize: 14,
                lineHeight: '28px',
                userSelect: 'text',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                backgroundImage: `repeating-linear-gradient(transparent, transparent ${LINE_H - 1}px, rgba(117,75,42,0.18) ${LINE_H - 1}px, rgba(117,75,42,0.18) ${LINE_H}px)`,
                backgroundPositionY: 24,
                opacity: isLocked ? 0.65 : 1,
                cursor: isLocked ? 'not-allowed' : 'text',
              }}
            />
          </div>
        </div>
        {turn && (
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            background: '#f1e3cc',
            zIndex: 4,
            pointerEvents: 'none',
            transformOrigin: turn === 'next' ? 'left center' : 'right center',
            animation: turn === 'next'
              ? 'vnFolderFlipNext 0.82s cubic-bezier(0.18,0.72,0.14,1) both'
              : 'vnFolderFlipPrev 0.82s cubic-bezier(0.18,0.72,0.14,1) both',
            boxShadow: turn === 'next' ? '-18px 0 38px rgba(0,0,0,0.22)' : '18px 0 38px rgba(0,0,0,0.22)',
            overflow: 'hidden',
            willChange: 'transform, filter',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: turn === 'next' ? 'linear-gradient(90deg, rgba(83,45,20,0.14), transparent 26%, rgba(255,255,255,0.3) 68%, rgba(83,45,20,0.08))' : 'linear-gradient(90deg, rgba(83,45,20,0.08), rgba(255,255,255,0.3) 32%, transparent 74%, rgba(83,45,20,0.14))' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, [turn === 'next' ? 'left' : 'right']: 0, width: 22, background: 'linear-gradient(90deg, rgba(83,45,20,0.16), transparent)', filter: 'blur(2px)' }} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(10,8,6,0.55)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '7px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <button style={{ ...navBtn, opacity: currentPage === 0 ? 0.35 : 1 }} onClick={() => turnFolderPage('prev')} disabled={currentPage === 0}>←</button>
        <div style={label}>🗂️ Folder page {currentPage + 1} / {pageCount}</div>
        <button style={navBtn} onClick={() => turnFolderPage('next')}>→</button>
      </div>
    </div>
  )
})

// ── LETTER LAYOUT ─────────────────────────────────────────────
function LetterLayout({ leftText, onLeftChange, groupName, showGrid, showRuler, pageAnimation }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 480, background: '#f5f0e8', borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.5), 2px 2px 0 #d4c5a9', padding: '40px 44px', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 520, position: 'relative', animation: pageAnimation || 'none' }}>
        {showGrid && <div style={gridOverlay} />}
        {showRuler && <div style={rulerTop} />}
        {showRuler && <div style={rulerSide} />}
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
function ScriptLayout({ leftText, onLeftChange, groupName, showGrid, showRuler, pageAnimation }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 520, background: '#fafafa', borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', padding: '32px 0', minHeight: 520, display: 'flex', flexDirection: 'column', position: 'relative', animation: pageAnimation || 'none' }}>
        {showGrid && <div style={gridOverlay} />}
        {showRuler && <div style={rulerTop} />}
        {showRuler && <div style={rulerSide} />}
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

function ProjectLayout({ groupName, showGrid, pageAnimation }) {
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
      <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 820, overflowX: 'auto', paddingBottom: 8, position: 'relative', animation: pageAnimation || 'none' }}>
        {showGrid && <div style={gridOverlay} />}
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
const turnPage = {
  ...diaryPage,
  background: '#edbea4',
  flex: 'none',
  position: 'absolute',
  top: 6,
  width: 300,
  height: 480,
  zIndex: 85,
  pointerEvents: 'none',
  transformStyle: 'preserve-3d',
  backfaceVisibility: 'hidden',
  overflow: 'hidden',
  border: '1px solid rgba(112,58,31,0.12)',
  willChange: 'transform, filter',
}
const bookShell = {
  display: 'flex',
  background: '#1a1008',
  borderRadius: 20,
  padding: 6,
  boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.6)',
}
const gridOverlay = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 2,
  backgroundImage: 'linear-gradient(rgba(90,42,24,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(90,42,24,0.12) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
}
const rulerTop = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  height: 14,
  zIndex: 3,
  pointerEvents: 'none',
  background: 'repeating-linear-gradient(90deg, rgba(90,42,24,0.26) 0 1px, transparent 1px 24px)',
  borderBottom: '1px solid rgba(90,42,24,0.18)',
}
const rulerSide = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 14,
  zIndex: 3,
  pointerEvents: 'none',
  background: 'repeating-linear-gradient(180deg, rgba(90,42,24,0.26) 0 1px, transparent 1px 24px)',
  borderRight: '1px solid rgba(90,42,24,0.18)',
}
const drawOverlay = {
  position: 'absolute',
  inset: 0,
  zIndex: 30,
  touchAction: 'none',
  userSelect: 'none',
}
const diaryDate = { fontFamily: 'Georgia, serif', fontSize: 13, color: '#c4816a', fontWeight: 600, marginBottom: 8, letterSpacing: '0.04em', lineHeight: `${LINE_H}px`, height: LINE_H, position: 'relative', zIndex: 20, pointerEvents: 'none' }
const diaryText = {
  flex: 1,
  fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  fontSize: 13,
  color: '#5a2a18',
  lineHeight: `${LINE_H}px`,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  resize: 'none',
  width: '100%',
  fontStyle: 'normal',
  userSelect: 'text',
  overflow: 'hidden',
  padding: 0,
  margin: 0,
  wordBreak: 'break-word',
  whiteSpace: 'pre-wrap',
}
const diaryFooter = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, flexShrink: 0, position: 'relative', zIndex: 40 }
const navBtn = { width: 28, height: 28, borderRadius: '50%', background: 'rgba(90,42,24,0.15)', border: '1px solid rgba(90,42,24,0.2)', cursor: 'pointer', fontSize: 13, color: '#5a2a18' }
const pageNum2 = { fontFamily: 'Georgia, serif', fontSize: 11, color: '#c4816a' }
const label = { fontSize: 12, color: colors.textDim, letterSpacing: '0.06em' }

// ── MAIN EXPORT ───────────────────────────────────────────────
const BookView = forwardRef(function BookView({ layout = 'diary', groupName, groupColor, groupIcon, leftText, rightText, onLeftChange, onRightChange, pageNum = 1, entryDate, isLocked, isOwner, textColor, textAlign, fontFamily, activeFormat, onFocusTextarea, onRegisterInsert, initialElements, onElementsChange, showGrid, showRuler, pageAnimation, drawTool, drawColor, drawSize, onSelectElement }, ref) {
  if (layout === 'letter') return <LetterLayout leftText={leftText} onLeftChange={isLocked ? () => {} : onLeftChange} groupName={groupName} showGrid={showGrid} showRuler={showRuler} pageAnimation={pageAnimation} />
  if (layout === 'script') return <ScriptLayout leftText={leftText} onLeftChange={isLocked ? () => {} : onLeftChange} groupName={groupName} showGrid={showGrid} showRuler={showRuler} pageAnimation={pageAnimation} />
  if (layout === 'project') return <FolderLayout ref={ref} groupName={groupName} groupColor={groupColor} groupIcon={groupIcon} leftText={leftText} rightText={rightText} onLeftChange={onLeftChange} onRightChange={onRightChange} entryDate={entryDate} isLocked={isLocked} onFocusTextarea={onFocusTextarea} showGrid={showGrid} showRuler={showRuler} />
  return <DiaryLayout ref={ref} groupName={groupName} leftText={leftText} rightText={rightText} onLeftChange={onLeftChange} onRightChange={onRightChange} entryDate={entryDate} isLocked={isLocked} textColor={textColor} textAlign={textAlign} fontFamily={fontFamily} activeFormat={activeFormat} onFocusTextarea={onFocusTextarea} onRegisterInsert={onRegisterInsert} initialElements={initialElements} onElementsChange={onElementsChange} showGrid={showGrid} showRuler={showRuler} pageAnimation={pageAnimation} drawTool={drawTool} drawColor={drawColor} drawSize={drawSize} onSelectElement={onSelectElement} />
})
export default BookView
