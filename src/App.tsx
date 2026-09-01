import { useEffect, useState } from 'react'
import AstaView from './components/AstaView'
import Header, { type Tab } from './components/Header'
import PlansView from './components/PlansView'
import SetupView from './components/SetupView'
import StatsView from './components/StatsView'
import TeamsView from './components/TeamsView'
import { useAuction } from './store/useAuction'

export default function App() {
  const [tab, setTab] = useState<Tab>('asta')
  const undo = useAuction((s) => s.undo)

  // Ctrl+Z / Cmd+Z annulla l'ultima operazione da qualsiasi vista.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        const inField = e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)
        if (inField) return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  return (
    <div className="flex h-full flex-col">
      <Header tab={tab} onTab={setTab} />
      {tab === 'asta' && <AstaView />}
      {tab === 'piani' && <PlansView />}
      {tab === 'squadre' && <TeamsView />}
      {tab === 'stats' && <StatsView />}
      {tab === 'setup' && <SetupView />}
    </div>
  )
}
