function getCacheDir() {
  try {
    const os   = window.require('os')
    const path = window.require('path')
    const platform = process.platform
    if (platform === 'win32') {
      return path.join(os.homedir(), 'AppData', 'Roaming', 'VisperNote', 'cache')
    } else if (platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'VisperNote', 'cache')
    } else {
      return path.join(os.homedir(), '.config', 'VisperNote', 'cache')
    }
  } catch { return null }
}

function ensureDir(dir) {
  try {
    const fs = window.require('fs')
    fs.mkdirSync(dir, { recursive: true })
    return true
  } catch { return false }
}

function cacheFilePath(key) {
  try {
    const path = window.require('path')
    const dir  = getCacheDir()
    if (!dir) return null
    ensureDir(dir)
    // key examples: 'groups', 'entries_groupId', 'messages_groupId', 'outbox', 'meta'
    return path.join(dir, `${key}.json`)
  } catch { return null }
}

export function cacheRead(key) {
  try {
    const fs   = window.require('fs')
    const file = cacheFilePath(key)
    if (!file) return null
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) { console.warn('[cache] read error', key, e); return null }
}

export function cacheWrite(key, data) {
  try {
    const fs   = window.require('fs')
    const file = cacheFilePath(key)
    if (!file) return false
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
    return true
  } catch (e) { console.warn('[cache] write error', key, e); return false }
}

export function cacheMergeArray(key, items, idField = 'id') {
  const existing = cacheRead(key) || []
  const map = {}
  existing.forEach(i => { map[i[idField]] = i })
  items.forEach(i => { map[i[idField]] = i })
  const merged = Object.values(map)
  cacheWrite(key, merged)
  return merged
}

export function cacheDelete(key, id, idField = 'id') {
  const existing = cacheRead(key) || []
  const next = existing.filter(i => i[idField] !== id)
  cacheWrite(key, next)
  return next
}

// ── Outbox ───────────────────────────────────────────────────
// Each outbox item: { id, type, table, operation, payload, timestamp }

export function outboxAdd(item) {
  const outbox = cacheRead('outbox') || []
  // Deduplicate: if same table+id+operation already pending, replace it
  const filtered = outbox.filter(o =>
    !(o.table === item.table && o.payload?.id === item.payload?.id && o.operation === item.operation)
  )
  filtered.push({ ...item, id: `ob_${Date.now()}_${Math.random().toString(36).slice(2)}`, timestamp: Date.now() })
  cacheWrite('outbox', filtered)
}

export function outboxGetAll() {
  return cacheRead('outbox') || []
}

export function outboxRemove(outboxId) {
  const outbox = cacheRead('outbox') || []
  cacheWrite('outbox', outbox.filter(o => o.id !== outboxId))
}

export function outboxClear() {
  cacheWrite('outbox', [])
}

// ── Meta ─────────────────────────────────────────────────────
export function metaGet(key) {
  const meta = cacheRead('meta') || {}
  return meta[key]
}

export function metaSet(key, value) {
  const meta = cacheRead('meta') || {}
  meta[key] = value
  cacheWrite('meta', meta)
}

// ── Online detection ─────────────────────────────────────────
export function isOnline() {
  return navigator.onLine
}
