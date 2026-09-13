import { useEffect } from 'react'
import { useStore } from './store/store'
import { connect } from './net/pear-client'
import { PearRoster } from './components/PearRoster'
import { ProblemList } from './components/ProblemList'
import './App.css'

function App() {
  const connected = useStore((s) => s.connected)

  useEffect(() => {
    const client = connect({
      onState: (msg) => useStore.getState().applyState(msg),
      onOpen: () => useStore.getState().setConnected(true),
      onClose: () => useStore.getState().setConnected(false),
    })
    return () => client.close()
  }, [])

  return (
    <main className="app">
      <header className="app-header">
        <h1>torrent</h1>
        <span className={`status ${connected ? 'on' : 'off'}`}>
          {connected ? 'connected' : 'offline'}
        </span>
      </header>

      <PearRoster />
      <ProblemList />
    </main>
  )
}

export default App