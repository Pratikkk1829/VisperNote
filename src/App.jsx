import { useState } from 'react'
import LoginPage from './pages/LoginPage'
import GroupPage from './pages/GroupPage'
import DMPage from './pages/DMPage'
import GroupCreate from './components/GroupCreate'

const INITIAL_GROUPS = [
  { id: 1, name: 'Summer Stories', icon: '🌸', color: '#c97b5a', layout: 'diary' },
  { id: 2, name: 'Midnight Scripts', icon: '🌙', color: '#7a8ec9', layout: 'script' },
  { id: 3, name: 'Ocean Diaries', icon: '🌊', color: '#7ab89a', layout: 'diary' },
]

export default function App() {
  const [screen, setScreen] = useState('login') // 'login' | 'group' | 'dm'
  const [groups, setGroups] = useState(INITIAL_GROUPS)
  const [activeGroup, setActiveGroup] = useState(1)
  const [showGroupCreate, setShowGroupCreate] = useState(false)

  const handleCreateGroup = (newGroup) => {
    const group = { ...newGroup, id: Date.now() }
    setGroups(p => [...p, group])
    setActiveGroup(group.id)
    setScreen('group')
  }

  const handleSelectGroup = (id) => {
    setActiveGroup(id)
    setScreen('group')
  }

  const sharedProps = {
    groups,
    activeGroup,
    onSelectGroup: handleSelectGroup,
    onAddGroup: () => setShowGroupCreate(true),
    onGoDM: () => setScreen('dm'),
    screen,
  }

  return (
    <>
      {screen === 'login' && <LoginPage onLogin={() => setScreen('group')} />}
      {screen === 'group' && <GroupPage {...sharedProps} />}
      {screen === 'dm' && <DMPage {...sharedProps} onGoGroup={() => setScreen('group')} />}

      {showGroupCreate && (
        <GroupCreate
          onClose={() => setShowGroupCreate(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </>
  )
}
