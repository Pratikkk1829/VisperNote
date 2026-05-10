import { useState, useEffect } from 'react'
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

export default function App() {
  const [screen, setScreen]               = useState('login')
  const [authUser, setAuthUser]           = useState(null)
  const [profile, setProfile]             = useState(null)
  const [groups, setGroups]               = useState([])
  const [activeGroup, setActiveGroup]     = useState(null)
  const [showGroupCreate, setShowGroupCreate] = useState(false)

  const [showSplash, setShowSplash]       = useState(true)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  const [authReady, setAuthReady]         = useState(false)
  const [dataReady, setDataReady]         = useState(false)
  const [themeId, setThemeId] = useState(() => {
    try { return localStorage.getItem('vn_theme') || 'default' } catch { return 'default' }
  })

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

    // ============== AUTO CHECK FOR UPDATES ON STARTUP ==============
  useEffect(() => {
    const { ipcRenderer } = window.require ? window.require('electron') : {}

    if (ipcRenderer) {
      console.log("🔄 Auto-checking for updates on startup...")
      
      const timer = setTimeout(() => {
        ipcRenderer.send('check-for-update')
      }, 3000)   // Check 3 seconds after app loads

      return () => clearTimeout(timer)
    }
  }, [])

  // Minimum times for premium feel
  const MIN_AUTH_TIME = 800
  const MIN_DATA_TIME = 1200
  const MIN_TOTAL_TIME = 2300

  const appStartTime = Date.now()

  // ── Auth Session ──────────────────────────────
  useEffect(() => {
    const authStart = Date.now()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user)
        setScreen('group')
      }
      const elapsed = Date.now() - authStart
      setTimeout(() => setAuthReady(true), Math.max(0, MIN_AUTH_TIME - elapsed))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthUser(session.user)
        setScreen('group')
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
          const g = data.map(row => row.groups).filter(Boolean)
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
              setGroups(g)
              if (cachedActive) setActiveGroup(cachedActive)
              else if (g.length > 0) setActiveGroup(g[0].id)
            }
          } catch {}
        }
        markLoaded()
      })
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
      const elapsed = Date.now() - appStartTime
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
    setIsPageLoading(true)
    setTimeout(() => {
      setScreen(newScreen)
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
      } catch {}
    }
    await supabase.auth.signOut()
  }

  const handleCreateGroup = async (newGroup) => {
    if (!authUser) return

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

    if (error || !group) return

    await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: authUser.id, role: 'owner' })

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
      <LoadingOverlay visible={isPageLoading} />

      {screen === 'login'    && <LoginPage key={themeId} onLogin={handleLogin} />}
      {screen === 'group'    && <GroupPage key={themeId} {...sharedProps} />}
      {screen === 'dm'       && <DMPage key={themeId} {...sharedProps} onGoGroup={() => changeScreen('group')} />}
      {screen === 'settings' && <SettingsPage {...sharedProps} onBack={() => changeScreen('group')} user={profile || authUser} onUpdateUser={handleUpdateUser} onLogout={handleLogout} />}

      {showGroupCreate && (
        <GroupCreate
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