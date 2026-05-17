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

    supabase.from('group_members')
      .select('group_id, groups(*)')
      .eq('user_id', authUser.id)
      .then(({ data, error }) => {
        if (data && data.length > 0) {
          const g = applySavedGroupOrder(data.map(row => row.groups).filter(Boolean), authUser.id)
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
        const { data, error } = await supabase.from('group_members')
          .select('group_id, groups(*)')
          .eq('user_id', authUser.id)

        if (error) {
          console.warn('[sync] refreshGroups error:', error)
          return
        }

        if (!data) return
        const g = applySavedGroupOrder(data.map(row => row.groups).filter(Boolean), authUser.id)
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

    // Also watch the groups table directly for new group inserts (catches invites from others)
    const ch2 = supabase.channel(`new-groups-watch-${authUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'groups' }, () => {
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
        .select('from_user, to_user, from_profile:profiles!friend_requests_from_user_fkey(id,username,display_name,avatar_url), to_profile:profiles!friend_requests_to_user_fkey(id,username,display_name,avatar_url)')
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

    await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: authUser.id, role: 'owner' })

    const invitedRows = (newGroup.inviteIds || newGroup.members || [])
      .filter(id => id && id !== authUser.id)
      .map(id => ({ group_id: group.id, user_id: id, role: 'member' }))

    if (invitedRows.length) {
      await supabase.from('group_members').insert(invitedRows)
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
    </>
  )
}