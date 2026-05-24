import { useState, useEffect, useRef } from 'react'
import { applyTheme } from './styles/theme'
import { supabase } from './lib/supabase'
import SplashScreen from './components/SplashScreen'
import LoadingOverlay from './components/LoadingOverlay'
import LoginPage from './pages/LoginPage'
import GroupPage from './pages/GroupPage'
import DMPage from './pages/DMPage'
import SettingsPage from './pages/SettingsPage'
import GroupCreate from './components/GroupCreate'
import UpdateModal from './components/UpdateModal'
import { installButtonSounds } from './lib/sounds'

// Normalize profile so avatar and display_name are always consistent
function normalizeProfile(p) {
  if (!p) return p
  return {
    ...p,
    avatar: p.avatar_url || p.avatar || null,
    name: p.display_name || p.name || p.username || '',
    display_name: p.display_name || '',
  }
}

function applySavedGroupOrder(groups, userId) {
  if (!userId) return groups
  try {
    const order = JSON.parse(localStorage.getItem(`vn_group_order_${userId}`) || '[]')
    if (!Array.isArray(order) || order.length === 0) return groups
    const rank = new Map(order.map((id, index) => [id, index]))
    return [...groups].sort((a, b) => {
      const ar = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER
      const br = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER
      return ar - br
    })
  } catch {
    return groups
  }
}

function uniqueGroups(groups = []) {
  const seen = new Set()
  return groups.filter(group => {
    if (!group?.id || seen.has(group.id)) return false
    seen.add(group.id)
    return true
  })
}

async function fetchGroupsForUser(userId) {
  const { data: memberships, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id, role, groups(*)')
    .eq('user_id', userId)

  if (membershipError) throw membershipError

  const memberGroupIds = (memberships || []).map(row => row.group_id).filter(Boolean)
  const joinedGroups = (memberships || []).map(row => row.groups).filter(Boolean)
  const joinedIds = new Set(joinedGroups.map(group => group.id))
  const missingFromJoin = memberGroupIds.filter(id => !joinedIds.has(id))
  let fallbackGroups = []

  if (missingFromJoin.length) {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .in('id', missingFromJoin)

    if (error) {
      console.warn('[groups] memberships exist but groups are not readable:', missingFromJoin, error)
    } else {
      fallbackGroups = data || []
    }
  }

  const groups = applySavedGroupOrder(uniqueGroups([...joinedGroups, ...fallbackGroups]), userId)
  const readableIds = new Set(groups.map(group => group.id))
  const missingGroupIds = memberGroupIds.filter(id => !readableIds.has(id))
  if (missingGroupIds.length) {
    console.warn('[groups] unreadable shared diary memberships. Check Supabase RLS for groups:', missingGroupIds)
  }

  return { groups, memberships: memberships || [], missingGroupIds }
}

export default function App() {
  const [screen, setScreen]               = useState('login')
  const [authUser, setAuthUser]           = useState(null)
  const [profile, setProfile]             = useState(null)
  const [groups, setGroups]               = useState([])
  const [friends, setFriends]             = useState([])
  const [activeGroup, setActiveGroup]     = useState(null)
  const [showGroupCreate, setShowGroupCreate] = useState(false)

  const [showSplash, setShowSplash]       = useState(true)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Loading...')
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  const [authReady, setAuthReady]         = useState(false)
  const [dataReady, setDataReady]         = useState(false)
  const [themeId, setThemeId] = useState(() => {
    try { return localStorage.getItem('vn_theme') || 'default' } catch { return 'default' }
  })

  // Apply saved theme on every mount (fixes reset after close/reopen)
  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem('vn_theme') || 'default' } catch { return 'default' } })()
    applyTheme(saved)
  }, [])

  useEffect(() => installButtonSounds(), [])

  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [updateStatus, setUpdateStatus]       = useState('')
  const [updateProgress, setUpdateProgress]   = useState(null)
  const [updateVersion, setUpdateVersion]     = useState('')
  const [notificationToasts, setNotificationToasts] = useState([])

  useEffect(() => {
    const onNotification = (event) => {
      const detail = event.detail || {}
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
      setNotificationToasts(prev => [
        ...prev.slice(-2),
        {
          id,
          title: detail.title || 'VisperNote',
          body: detail.body || '',
          icon: detail.icon || null,
          type: detail.type || 'message',
        },
      ])
      setTimeout(() => {
        setNotificationToasts(prev => prev.filter(toast => toast.id !== id))
      }, 5200)
    }

    window.addEventListener('vn-notification', onNotification)
    return () => window.removeEventListener('vn-notification', onNotification)
  }, [])

  // ============== AUTO UPDATER LISTENERS ==============
  useEffect(() => {
    const handler = (e) => { setThemeId(e.detail?.id || 'default') }
    window.addEventListener('vn-theme-change', handler)
    return () => window.removeEventListener('vn-theme-change', handler)
  }, [])


  
  useEffect(() => {
    const { ipcRenderer } = window.require ? window.require('electron') : {}

    if (!ipcRenderer) return

    const handlers = {
      'update-status': (event, status) => {
        // status is now a clean code: 'checking' | 'available' | 'up-to-date' | 'downloaded' | 'error' | 'dev-mode'
        setUpdateStatus(status)
        if (status !== 'checking') setUpdateModalOpen(true)
      },
      'update-info': (event, info) => {
        setUpdateVersion(info.version)
      },
      'update-progress': (event, progress) => {
        setUpdateProgress(progress)
      },
      'update-ready': (event, version) => {
        setUpdateVersion(version)
        setUpdateStatus('downloaded')
        setUpdateModalOpen(true)
        setTimeout(() => ipcRenderer.send('quit-and-install'), 3000)
      },
      'update-error': (event, message) => {
        setUpdateStatus('error')
        setUpdateModalOpen(true)
      }
    }

    Object.keys(handlers).forEach(key => {
      ipcRenderer.on(key, handlers[key])
    })

    return () => {
      Object.keys(handlers).forEach(key => {
        ipcRenderer.removeListener(key, handlers[key])
      })
    }
  }, [])

  useEffect(() => {
    const { ipcRenderer } = window.require ? window.require('electron') : {}
    if (!ipcRenderer) return

    const onDeepLink = (_event, url) => {
      window.dispatchEvent(new CustomEvent('vn-deep-link', { detail: { url } }))
    }
    ipcRenderer.on('deep-link', onDeepLink)
    return () => ipcRenderer.removeListener('deep-link', onDeepLink)
  }, [])

    // ============== AUTO CHECK FOR UPDATES ON STARTUP ==============
  // Auto-update check is handled silently by electron.cjs on startup

  // Minimum times for premium feel
  const MIN_AUTH_TIME = 800
  const MIN_DATA_TIME = 1200
  const MIN_TOTAL_TIME = 2300

  const appStartTime = useRef(Date.now())

  // ── Auth Session ──────────────────────────────
  useEffect(() => {
    const authStart = Date.now()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user)
        const saved = (() => { try { return localStorage.getItem('vn_last_screen') } catch { return null } })()
        setScreen((saved && saved !== 'login') ? saved : 'group')
      }
      const elapsed = Date.now() - authStart
      setTimeout(() => setAuthReady(true), Math.max(0, MIN_AUTH_TIME - elapsed))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthUser(session.user)
        if (_event === 'SIGNED_IN') {
          setScreen(prev => {
            if (prev !== 'login') return prev
            const saved = (() => { try { return localStorage.getItem('vn_last_screen') } catch { return null } })()
            const next = (saved && saved !== 'login') ? saved : 'group'
            try { localStorage.setItem('vn_last_screen', next) } catch {}
            return next
          })
        }
      } else if (_event === 'SIGNED_OUT') {
        // Only clear state on explicit signout, not on network errors
        setAuthUser(null)
        setProfile(null)
        setGroups([])
        setScreen('login')
      }
      // If no session but not SIGNED_OUT, we're just offline — keep existing state
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Load Profile + Groups ─────────────────────────────
  useEffect(() => {
    if (!authUser) {
      setDataReady(true)
      return
    }

    const dataStart = Date.now()
    let loaded = 0
    const total = 2

    const markLoaded = () => {
      loaded++
      if (loaded >= total) {
        const elapsed = Date.now() - dataStart
        setTimeout(() => setDataReady(true), Math.max(0, MIN_DATA_TIME - elapsed))
      }
    }

    supabase.from('profiles').select('*').eq('id', authUser.id).single()
      .then(({ data }) => {
        if (data) {
          const normalized = normalizeProfile(data)
          setProfile(normalized)
          try { localStorage.setItem(`vn_profile_${authUser.id}`, JSON.stringify(normalized)) } catch {}
        } else {
          // Offline — restore from cache
          try {
            const cached = localStorage.getItem(`vn_profile_${authUser.id}`)
            if (cached) setProfile(JSON.parse(cached))
          } catch {}
        }
        markLoaded()
      })

    fetchGroupsForUser(authUser.id)
      .then(({ groups: g }) => {
        if (g.length > 0) {
          setGroups(g)
          if (g.length > 0 && !activeGroup) setActiveGroup(g[0].id)
          // Cache for offline use
          localStorage.setItem(`vn_groups_${authUser.id}`, JSON.stringify(g))
          localStorage.setItem(`vn_activeGroup_${authUser.id}`, g[0].id)
        } else {
          // Offline or empty — restore from cache
          try {
            const cached = localStorage.getItem(`vn_groups_${authUser.id}`)
            const cachedActive = localStorage.getItem(`vn_activeGroup_${authUser.id}`)
            if (cached) {
              const g = JSON.parse(cached)
              setGroups(applySavedGroupOrder(g, authUser.id))
              if (cachedActive) setActiveGroup(cachedActive)
              else if (g.length > 0) setActiveGroup(g[0].id)
            }
          } catch {}
        }
        markLoaded()
      })
      .catch((error) => {
        console.warn('[groups] initial load error:', error)
        try {
          const cached = localStorage.getItem(`vn_groups_${authUser.id}`)
          const cachedActive = localStorage.getItem(`vn_activeGroup_${authUser.id}`)
          if (cached) {
            const g = JSON.parse(cached)
            setGroups(applySavedGroupOrder(g, authUser.id))
            if (cachedActive) setActiveGroup(cachedActive)
            else if (g.length > 0) setActiveGroup(g[0].id)
          }
        } catch {}
        markLoaded()
      })
  }, [authUser])

  // Keep this user's profile/avatar fresh across settings saves and other windows.
  useEffect(() => {
    if (!authUser) return
    const ch = supabase.channel(`profile-${authUser.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${authUser.id}`,
      }, (payload) => {
        const normalized = normalizeProfile(payload.new)
        setProfile(normalized)
        try { localStorage.setItem(`vn_profile_${authUser.id}`, JSON.stringify(normalized)) } catch {}
      })
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [authUser])

  // ── Live refresh when someone invites/removes this user from a diary ─────
  useEffect(() => {
    if (!authUser) return

    const refreshGroups = async () => {
      try {
        const { groups: g } = await fetchGroupsForUser(authUser.id)
        setGroups(g)
        setActiveGroup(prev => {
          const stillExists = g.some(group => group.id === prev)
          return stillExists ? prev : (g[0]?.id || null)
        })
        try {
          localStorage.setItem(`vn_groups_${authUser.id}`, JSON.stringify(g))
          if (g[0]?.id) localStorage.setItem(`vn_activeGroup_${authUser.id}`, g[0].id)
        } catch {}
      } catch (e) {
        console.warn('[sync] refreshGroups exception:', e)
      }
    }

    const ch = supabase.channel(`my-group-memberships-${authUser.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `user_id=eq.${authUser.id}`,
      }, refreshGroups)
      .subscribe((status) => {
        // Force immediate refresh when subscription is established
        if (status === 'SUBSCRIBED') {
          refreshGroups()
        }
      })

    // Also watch the groups table directly so shared names/designs update for members.
    const ch2 = supabase.channel(`new-groups-watch-${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
        refreshGroups()
      })
      .subscribe()

    // Fallback: Refresh every 3 seconds to catch any missed realtime events
    const pollInterval = setInterval(refreshGroups, 3000)

    // Refresh when window regains focus (user switches tabs/windows)
    const handleFocus = () => {
      console.log('[sync] Window focused, refreshing groups')
      refreshGroups()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      supabase.removeChannel(ch); supabase.removeChannel(ch2)
      clearInterval(pollInterval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [authUser])

  // ── Load accepted friends for create/invite flows ─────────────────────
  useEffect(() => {
    if (!authUser) {
      setFriends([])
      return
    }

    let cancelled = false
    const loadFriends = async () => {
      const { data } = await supabase
        .from('friend_requests')
        .select('from_user, to_user, from_profile:profiles!friend_requests_from_user_fkey(id,username,display_name,avatar_url,bio,created_at), to_profile:profiles!friend_requests_to_user_fkey(id,username,display_name,avatar_url,bio,created_at)')
        .eq('status', 'accepted')
        .or(`from_user.eq.${authUser.id},to_user.eq.${authUser.id}`)

      if (cancelled) return
      if (data) {
        const list = data
          .map(r => r.from_user === authUser.id ? r.to_profile : r.from_profile)
          .filter(Boolean)
        setFriends(list)
        try { localStorage.setItem(`vn_friends_${authUser.id}`, JSON.stringify(list)) } catch {}
      } else {
        try {
          const cached = localStorage.getItem(`vn_friends_${authUser.id}`)
          if (cached) setFriends(JSON.parse(cached))
        } catch {}
      }
    }

    loadFriends()
    const ch = supabase.channel(`friends-${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, loadFriends)
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(ch)
    }
  }, [authUser])

  // ── Connection Status with Auto-Reconnect ─────────────────────────────
  useEffect(() => {
    let channel
    let reconnectTimer

    const connect = () => {
      if (channel) supabase.removeChannel(channel)

      channel = supabase.channel('connection-status')

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected')
          
          reconnectTimer = setTimeout(() => {
            if (connectionStatus !== 'connected') connect()
          }, 3000)
        } else {
          setConnectionStatus('connecting')
        }
      })
    }

    connect()

    return () => {
      if (channel) supabase.removeChannel(channel)
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])

  // ── Hide Splash ─────────────────────────────
  useEffect(() => {
    if (authReady && dataReady) {
      const elapsed = Date.now() - appStartTime.current
      const remaining = Math.max(0, MIN_TOTAL_TIME - elapsed)
      
      setTimeout(() => setShowSplash(false), remaining)
    }
  }, [authReady, dataReady])

  const handleCheckForUpdate = () => {
    const { ipcRenderer } = window.require ? window.require('electron') : {}
    if (ipcRenderer) {
      setUpdateProgress(null)
      setUpdateVersion('')
      setUpdateStatus('checking')
      setUpdateModalOpen(true)
      ipcRenderer.send('check-for-update')
    } else {
      alert("Update checker only works in the built app (.exe)")
    }
  }

  // ── Smooth Page Transition ─────────────────────────────
  const changeScreen = (newScreen) => {
    setLoadingMessage(newScreen === 'dm' ? 'Opening messages...' : newScreen === 'settings' ? 'Opening settings...' : 'Opening diary...')
    setIsPageLoading(true)
    setTimeout(() => {
      setScreen(newScreen)
      if (newScreen !== 'login') {
        try { localStorage.setItem('vn_last_screen', newScreen) } catch {}
      }
      setIsPageLoading(false)
    }, 420)
  }

  const handleUpdateUser = (updated) => {
    const normalized = normalizeProfile(updated)
    setProfile(normalized)
    try {
      if (authUser?.id) localStorage.setItem(`vn_profile_${authUser.id}`, JSON.stringify(normalized))
    } catch {}
  }
  const handleLogin = (authUserObj) => {
    setAuthUser(authUserObj)
    changeScreen('group')
  }

  const handleLogout = async () => {
    if (authUser) {
      try {
        localStorage.removeItem(`vn_groups_${authUser.id}`)
        localStorage.removeItem(`vn_activeGroup_${authUser.id}`)
        localStorage.removeItem(`vn_profile_${authUser.id}`)
        localStorage.removeItem(`vn_friends_${authUser.id}`)
        localStorage.removeItem('vn_last_screen')
      } catch {}
    }
    await supabase.auth.signOut()
  }

  const insertMembershipRows = async (rows) => {
    if (!rows.length) return { missing: [], errors: [] }

    const { error: bulkError } = await supabase.from('group_members').insert(rows)
    const errors = []

    if (bulkError) {
      console.warn('[groups] bulk membership insert failed, retrying row-by-row:', bulkError)
      for (const row of rows) {
        const { data: existing } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('group_id', row.group_id)
          .eq('user_id', row.user_id)
          .maybeSingle()

        if (existing) continue

        const { error } = await supabase.from('group_members').insert(row)
        if (error) {
          console.warn('[groups] membership insert failed:', row, error)
          errors.push({ row, error })
        }
      }
    } else {
      return { missing: [], errors: [] }
    }

    return { missing: errors.map(item => item.row).filter(Boolean), errors }
  }

  const handleCreateGroup = async (newGroup) => {
    if (!authUser) return
    setLoadingMessage('Creating diary...')
    setIsPageLoading(true)

    const { data: group, error } = await supabase
      .from('groups')
      .insert({ 
        name: newGroup.name, 
        icon: newGroup.icon, 
        color: newGroup.color, 
        layout: newGroup.layout, 
        created_by: authUser.id 
      })
      .select()
      .single()

    if (error || !group) {
      setIsPageLoading(false)
      return
    }

    const inviteIds = (newGroup.inviteIds || newGroup.members || [])
      .map(item => typeof item === 'string' ? item : item?.id)
      .filter(id => id && id !== authUser.id)
    const uniqueInviteIds = [...new Set(inviteIds)]
    const membershipRows = [
      { group_id: group.id, user_id: authUser.id, role: 'owner' },
      ...uniqueInviteIds.map(id => ({ group_id: group.id, user_id: id, role: 'member' })),
    ]

    const { missing, errors } = await insertMembershipRows(membershipRows)
    if (missing.length || errors.length) {
      const missingInviteNames = missing
        .filter(row => row.user_id !== authUser.id)
        .map(row => friends.find(friend => friend.id === row.user_id)?.username || row.user_id)
      console.warn('[groups] diary created but some memberships were not written:', { missing, errors })
      if (missingInviteNames.length) {
        window.alert(`Diary created, but these invite(s) could not be added: ${missingInviteNames.join(', ')}. This usually means the Supabase group_members insert policy needs to allow diary owners to invite members.`)
      } else if (missing.some(row => row.user_id === authUser.id)) {
        window.alert('Diary created, but the owner membership could not be verified. Please check Supabase group_members policies.')
      }
    }

    setGroups(prev => {
      const updated = [...prev, group]
      try { localStorage.setItem(`vn_groups_${authUser.id}`, JSON.stringify(updated)) } catch {}
      return updated
    })
    setActiveGroup(group.id)
    try { localStorage.setItem(`vn_activeGroup_${authUser.id}`, group.id) } catch {}
    setShowGroupCreate(false)
    changeScreen('group')
  }

  const handleSelectGroup = (id) => {
    setActiveGroup(id)
    changeScreen('group')
  }

  const handleReorderGroups = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return
    setGroups(prev => {
      const fromIndex = prev.findIndex(g => g.id === fromId)
      const toIndex = prev.findIndex(g => g.id === toId)
      if (fromIndex < 0 || toIndex < 0) return prev

      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      const insertIndex = fromIndex < toIndex ? toIndex : toIndex
      next.splice(insertIndex, 0, moved)

      try {
        localStorage.setItem(`vn_group_order_${authUser.id}`, JSON.stringify(next.map(g => g.id)))
        localStorage.setItem(`vn_groups_${authUser.id}`, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const handleUpdateGroup = (id, patch) => {
    setGroups(prev => {
      const next = prev.map(g => g.id === id ? { ...g, ...patch } : g)
      try { if (authUser?.id) localStorage.setItem(`vn_groups_${authUser.id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleDeleteGroup = async (id) => {
    if (!authUser || !id) return
    setLoadingMessage('Deleting diary...')
    setIsPageLoading(true)

    try {
      await supabase.from('messages').delete().eq('group_id', id)
      await supabase.from('entries').delete().eq('group_id', id)
      await supabase.from('group_members').delete().eq('group_id', id)
      const { error } = await supabase.from('groups').delete().eq('id', id).eq('created_by', authUser.id)
      if (error) throw error

      setGroups(prev => {
        const next = prev.filter(group => group.id !== id)
        try {
          localStorage.setItem(`vn_groups_${authUser.id}`, JSON.stringify(next))
          localStorage.removeItem(`entries_${id}`)
          localStorage.removeItem(`messages_${id}`)
          if (activeGroup === id) {
            if (next[0]?.id) localStorage.setItem(`vn_activeGroup_${authUser.id}`, next[0].id)
            else localStorage.removeItem(`vn_activeGroup_${authUser.id}`)
          }
        } catch {}
        if (activeGroup === id) setActiveGroup(next[0]?.id || null)
        return next
      })
    } catch (error) {
      console.error('[groups] delete diary failed:', error)
      window.alert('Could not delete this diary. Make sure you are the diary owner and the Supabase policies are updated.')
    } finally {
      setIsPageLoading(false)
    }
  }

  const handleJoinDiary = async (groupId) => {
    if (!authUser || !groupId) return
    setLoadingMessage('Joining diary...')
    setIsPageLoading(true)

    const { data: existing } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('group_id', groupId)
      .eq('user_id', authUser.id)
      .maybeSingle()

    const { error } = existing
      ? { error: null }
      : await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: authUser.id, role: 'member' })

    if (!error) {
      const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single()
      if (group) {
        setGroups(prev => {
          const updated = prev.find(g => g.id === group.id) ? prev : [...prev, group]
          try { localStorage.setItem(`vn_groups_${authUser.id}`, JSON.stringify(updated)) } catch {}
          return updated
        })
        setActiveGroup(group.id)
        try { localStorage.setItem(`vn_activeGroup_${authUser.id}`, group.id) } catch {}
        setScreen('group')
        try { localStorage.setItem('vn_last_screen', 'group') } catch {}
      }
    }

    setIsPageLoading(false)
  }

  useEffect(() => {
    const handler = (event) => {
      const url = event.detail?.url || ''
      const groupId = url.match(/^vispernote:\/\/join\/([^/?#]+)/i)?.[1]
      if (!groupId) return
      const decoded = decodeURIComponent(groupId)
      if (authUser) handleJoinDiary(decoded)
      else {
        try { localStorage.setItem('vn_pending_join', decoded) } catch {}
        setScreen('login')
      }
    }
    window.addEventListener('vn-deep-link', handler)
    return () => window.removeEventListener('vn-deep-link', handler)
  }, [authUser])

  useEffect(() => {
    if (!authUser) return
    let pending = null
    try {
      pending = localStorage.getItem('vn_pending_join')
      if (pending) localStorage.removeItem('vn_pending_join')
    } catch {}
    if (pending) handleJoinDiary(pending)
  }, [authUser])

  // Show Splash Screen
  if (showSplash) {
    let loadingMessage = "Loading VisperNote...";
    if (!authReady) loadingMessage = "Connecting to your account...";
    else if (!dataReady) loadingMessage = "Loading your diaries...";

    return <SplashScreen 
      onDone={() => setShowSplash(false)} 
      message={loadingMessage} 
    />
  }

  const sharedProps = {
    groups,
    activeGroup,
    onSelectGroup: handleSelectGroup,
    onReorderGroups: handleReorderGroups,
    onUpdateGroup: handleUpdateGroup,
    onDeleteGroup: handleDeleteGroup,
    onAddGroup: () => setShowGroupCreate(true),
    onGoDM: () => changeScreen('dm'),
    onGoSettings: () => changeScreen('settings'),
    screen,
    user: profile || authUser,
    onLogout: handleLogout,
    connectionStatus,           // ← Passed to GroupPage
    onCheckForUpdate: handleCheckForUpdate,
  }

  return (
    <>
      <LoadingOverlay visible={isPageLoading} message={loadingMessage} />

      {screen === 'login'    && <LoginPage key={themeId} onLogin={handleLogin} />}
      {screen === 'group'    && <GroupPage key={themeId} {...sharedProps} />}
      {screen === 'dm'       && <DMPage key={themeId} {...sharedProps} onGoGroup={() => changeScreen('group')} />}
      {screen === 'settings' && <SettingsPage {...sharedProps} onBack={() => changeScreen('group')} user={profile || authUser} onUpdateUser={handleUpdateUser} onLogout={handleLogout} />}

      {showGroupCreate && (
        <GroupCreate
          friends={friends}
          onClose={() => setShowGroupCreate(false)}
          onCreate={handleCreateGroup}
        />
      )}

      <UpdateModal
      isOpen={updateModalOpen}
      onClose={() => setUpdateModalOpen(false)}
      status={updateStatus}
      progress={updateProgress}
      version={updateVersion}
      />

      {notificationToasts.length > 0 && (
        <div style={notificationToastStyles.stack}>
          {notificationToasts.map(toast => (
            <div key={toast.id} style={notificationToastStyles.toast}>
              <div style={notificationToastStyles.avatar}>
                {toast.icon
                  ? <img src={toast.icon} alt="" style={notificationToastStyles.avatarImg} />
                  : <span>{toast.type === 'mention' ? '@' : 'V'}</span>
                }
              </div>
              <div style={notificationToastStyles.copy}>
                <div style={notificationToastStyles.title}>{toast.title}</div>
                {toast.body && <div style={notificationToastStyles.body}>{toast.body}</div>}
              </div>
              <button
                style={notificationToastStyles.close}
                onClick={() => setNotificationToasts(prev => prev.filter(item => item.id !== toast.id))}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

const notificationToastStyles = {
  stack: {
    position: 'fixed',
    right: 18,
    bottom: 48,
    zIndex: 1800,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    pointerEvents: 'none',
  },
  toast: {
    width: 330,
    minHeight: 74,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 14,
    border: '1px solid color-mix(in srgb, var(--vn-accent) 35%, var(--vn-border))',
    background: 'color-mix(in srgb, var(--vn-surface) 92%, #000 8%)',
    boxShadow: '0 18px 48px rgba(0,0,0,0.36), 0 0 0 1px rgba(255,255,255,0.03) inset',
    color: 'var(--vn-text)',
    pointerEvents: 'auto',
    animation: 'vnToastIn 0.28s cubic-bezier(.2,.8,.2,1) both',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(145deg, var(--vn-accent-dim), var(--vn-elevated))',
    color: 'var(--vn-accent)',
    fontWeight: 800,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  body: { marginTop: 3, fontSize: 12.5, lineHeight: 1.35, color: 'var(--vn-text-mid)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  close: { border: 'none', background: 'transparent', color: 'var(--vn-text-dim)', fontSize: 18, cursor: 'pointer', padding: 2, alignSelf: 'flex-start' },
}
