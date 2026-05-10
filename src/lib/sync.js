// src/lib/sync.js
// Sync engine: flushes offline outbox to Supabase, pulls fresh data down

import { supabase } from './supabase'
import {
  cacheRead, cacheWrite, cacheMergeArray,
  outboxGetAll, outboxRemove,
  metaSet,
} from './cache'

// ── Flush outbox to server ────────────────────────────────────
export async function flushOutbox(onProgress) {
  const items = outboxGetAll()
  if (!items.length) return { flushed: 0, failed: 0 }
  let flushed = 0, failed = 0

  for (const item of items) {
    try {
      if (item.operation === 'insert') {
        const payload = { ...item.payload }
        // If it has a local id (starts with 'local_'), remove it — server will assign real id
        const hadLocalId = typeof payload.id === 'string' && payload.id.startsWith('local_')
        if (hadLocalId) delete payload.id
        const { data, error } = await supabase.from(item.table).insert(payload).select().single()
        if (error) throw error
        // Update local cache: replace local_id with real server id
        if (hadLocalId && data) {
          const cacheKey = item.cacheKey
          if (cacheKey) {
            const cached = cacheRead(cacheKey) || []
            const updated = cached.map(r => r.id === item.payload.id ? { ...r, ...data } : r)
            cacheWrite(cacheKey, updated)
          }
        }
      } else if (item.operation === 'update') {
        const { error } = await supabase.from(item.table).update(item.payload).eq('id', item.payload.id)
        if (error) throw error
      } else if (item.operation === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.payload.id)
        if (error) throw error
      }
      outboxRemove(item.id)
      flushed++
      onProgress?.({ flushed, failed, total: items.length, item })
    } catch (e) {
      console.warn('[sync] outbox item failed:', item, e)
      failed++
    }
  }
  return { flushed, failed }
}

// ── Pull fresh data from server ───────────────────────────────
export async function pullGroups(userId) {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('groups(*)')
      .eq('user_id', userId)
    if (error || !data) return null
    const groups = data.map(r => r.groups).filter(Boolean)
    cacheWrite('groups', groups)
    metaSet('groups_synced_at', Date.now())
    return groups
  } catch (e) { console.warn('[sync] pullGroups error:', e); return null }
}

export async function pullEntries(groupId) {
  try {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
    if (error || !data) return null
    cacheWrite(`entries_${groupId}`, data)
    metaSet(`entries_synced_at_${groupId}`, Date.now())
    return data
  } catch (e) { console.warn('[sync] pullEntries error:', e); return null }
}

export async function pullMessages(groupId) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(username)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (error || !data) return null
    cacheWrite(`messages_${groupId}`, data)
    metaSet(`messages_synced_at_${groupId}`, Date.now())
    return data
  } catch (e) { console.warn('[sync] pullMessages error:', e); return null }
}

export async function pullEntry(entryId) {
  try {
    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('id', entryId)
      .single()
    if (error || !data) return null
    return data
  } catch (e) { console.warn('[sync] pullEntry error:', e); return null }
}

// ── Full sync for a group ─────────────────────────────────────
export async function syncGroup(groupId, userId, onProgress) {
  const results = { outbox: null, entries: null, messages: null }
  results.outbox  = await flushOutbox(onProgress)
  results.entries  = await pullEntries(groupId)
  results.messages = await pullMessages(groupId)
  return results
}
