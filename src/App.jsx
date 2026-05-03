import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import GroupPage from './pages/GroupPage'
import DMPage from './pages/DMPage'
import SettingsPage from './pages/SettingsPage'
import GroupCreate from './components/GroupCreate'

const INITIAL_GROUPS = [
  { id: 1, name: 'Summer Stories', icon: '🌸', color: '#c97b5a' },
  { id: 2, name: 'Midnight Scripts', icon: '🌙', color: '#7a8ec9' },
  { id: 3, name: 'Ocean Diaries', icon: '🌊', color: '#7ab89a' },
]

export default function App() {
  const [screen, setScreen] = useState('login') // 'login' | 'home' | 'group' | 'dm' | 'settings'
  const [groups, setGroups] = useState(INITIAL_GROUPS)
  const [activeGroup, setActiveGroup] = useState(1)
  const [bookType, setBookType] = useState('diary')
  const [showGroupCreate, setShowGroupCreate] = useState(false)

  const handleCreateGroup = (newGroup) => {
    const group = { ...newGroup, id: Date.now() }
    setGroups(p => [...p, group])
    setActiveGroup(group.id)
    setBookType('diary')
    setScreen('group')
  }

  const handleSelectGroup = (id) => {
    setActiveGroup(id)
    setScreen('group')
  }

  const handleOpenBook = (type) => {
    setBookType(type)
    setScreen('group')
  }

  const sharedProps = {
    groups,
    activeGroup,
    onSelectGroup: handleSelectGroup,
    onAddGroup: () => setShowGroupCreate(true),
    onGoHome: () => setScreen('home'),
    onGoDM: () => setScreen('dm'),
  }

  return (
    <>
      {screen === 'login' && <LoginPage onLogin={() => setScreen('home')} />}
      {screen === 'home' && <HomePage {...sharedProps} onOpenBook={handleOpenBook} />}
      {screen === 'group' && <GroupPage {...sharedProps} bookType={bookType} />}
      {screen === 'dm' && <DMPage onGoHome={() => setScreen('home')} />}
      {screen === 'settings' && <SettingsPage onGoHome={() => setScreen('home')} />}

      {showGroupCreate && (
        <GroupCreate
          onClose={() => setShowGroupCreate(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </>
  )
}
