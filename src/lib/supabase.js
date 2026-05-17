import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wumxputtvpwjtdqyngrn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bXhwdXR0dnB3anRkcXluZ3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzM3NDIsImV4cCI6MjA5MzQwOTc0Mn0.Sty4U2c5NcL6gaZsGhx3p-Etb3hJsgkI8bDb_u8MBhk'

// Persistent storage using Electron's userData — survives dev restarts
const makeStorage = () => {
  try {
    const { ipcRenderer } = window.require('electron')
    // Electron context — use localStorage which IS persistent in Electron
    // (it persists in %APPDATA%/VisperNote/Local Storage/)
    return window.localStorage
  } catch {
    return window.localStorage
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: makeStorage(),
    storageKey: 'vn-auth-session',
  }
})