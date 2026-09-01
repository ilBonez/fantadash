import { useEffect, useState } from 'react'
import AstaView from './components/AstaView'
import Header, { type Tab } from './components/Header'
import PlansView from './components/PlansView'
import SetupView from './components/SetupView'
import StatsView from './components/StatsView'
import TeamsView from './components/TeamsView'
import { storageDisponibile } from './lib/storage'
import { useAuction } from './store/useAuction'

// Calcolato una volta: se il browser non concede localStorage va detto subito,
// non alla prima ricarica con l'asta a metà.
const SENZA_STORAGE = !storageDisponibile()

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
      {SENZA_STORAGE && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
          <strong>Questo browser non salva niente in locale.</strong> L&apos;asta funziona, ma ricaricando la pagina si
          perde tutto: esporta il backup JSON da Impostazioni a ogni pausa. Succede aprendo il file direttamente
          (file://) o in finestra anonima — servi la cartella con <code>avvia.cmd</code> per risolvere.
        </div>
      )}
      {tab === 'asta' && <AstaView />}
      {tab === 'piani' && <PlansView />}
      {tab === 'squadre' && <TeamsView />}
      {tab === 'stats' && <StatsView />}
      {tab === 'setup' && <SetupView />}
    </div>
  )
}
