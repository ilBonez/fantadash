import { dec, int, pct } from '../lib/format'
import { useLeague } from '../lib/useLeague'
import { useAuction } from '../store/useAuction'
import { Bar } from './ui'

export type Tab = 'asta' | 'piani' | 'squadre' | 'stats' | 'setup'

const TABS: { id: Tab; label: string }[] = [
  { id: 'asta', label: 'Asta' },
  { id: 'piani', label: 'Piani' },
  { id: 'squadre', label: 'Squadre' },
  { id: 'stats', label: 'Statistiche' },
  { id: 'setup', label: 'Impostazioni' },
]

export default function Header({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const settings = useAuction((s) => s.settings)
  const setMode = useAuction((s) => s.setMode)
  const undo = useAuction((s) => s.undo)
  const canUndo = useAuction((s) => s.undoStack.length > 0)
  const league = useLeague()

  return (
    <header className="border-b border-ink-700/70 bg-ink-900">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-bold tracking-tight">
            Fanta<span className="text-sky-400">Dash</span>
          </span>
          <span className="max-w-52 truncate text-sm text-ink-300">{settings.lega}</span>
        </div>

        <div className="flex items-center rounded-lg border border-ink-700 bg-ink-850 p-0.5 text-xs">
          {(['classic', 'mantra'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2 py-0.5 font-medium capitalize transition-colors ${
                settings.mode === m ? 'bg-sky-600 text-white' : 'text-ink-400 hover:text-ink-100'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="hidden min-w-40 max-w-64 flex-1 md:block">
          <div className="mb-1 flex justify-between text-[11px] text-ink-400">
            <span>
              {int(league.giocatoriAssegnati)}/{int(league.slotTotali)} slot
            </span>
            <span>{pct(league.avanzamento)}</span>
          </div>
          <Bar value={league.avanzamento} max={1} className="bg-emerald-500" />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Kpi label="spesi" value={int(league.spesi)} />
          <Kpi label="residui lega" value={int(league.residui)} tone={league.residui < 0 ? 'bad' : undefined} />
          <Kpi
            label="inflazione"
            value={Number.isFinite(league.inflazione) ? `${dec(league.inflazione, 2)}x` : '-'}
            tone={league.inflazione > 1.15 ? 'bad' : undefined}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="btn"
            disabled={!canUndo}
            onClick={undo}
            title="Annulla ultima operazione (Ctrl+Z)"
          >
            &#8630; Annulla
          </button>
          <nav className="flex items-center rounded-lg border border-ink-700 bg-ink-850 p-0.5 text-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  tab === t.id ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <span className="whitespace-nowrap">
      <span className={`font-semibold ${tone === 'bad' ? 'text-rose-400' : 'text-ink-100'}`}>{value}</span>{' '}
      <span className="text-ink-500">{label}</span>
    </span>
  )
}
