import { int, signed, time } from '../lib/format'
import type { EnrichedPick } from '../lib/stats'
import { Empty, RoleBadge, Section } from './ui'

/** Cronologia delle assegnazioni, dalla piu recente. */
export default function MovesLog({
  picks,
  onUnassign,
  limit = 40,
}: {
  picks: EnrichedPick[]
  onUnassign: (playerId: number) => void
  limit?: number
}) {
  const recent = [...picks].sort((a, b) => b.ts - a.ts).slice(0, limit)
  return (
    <Section
      title="Ultimi movimenti"
      right={<span className="text-[11px] text-ink-400">{picks.length} assegnati</span>}
      className="flex min-h-0 flex-col"
    >
      <div className="min-h-0 flex-1 divide-y divide-ink-800 overflow-auto">
        {recent.map((p) => (
          <div key={p.playerId} className="group flex items-center gap-2 px-3 py-1.5 text-sm">
            <RoleBadge role={p.player.r} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium leading-tight">{p.player.nome}</div>
              <div className="truncate text-[11px] text-ink-400">
                {p.team.nome} · {time(p.ts)}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold leading-tight">{int(p.price)}</div>
              <div
                className={`text-[11px] ${
                  p.delta > 0 ? 'text-rose-400' : p.delta < 0 ? 'text-emerald-400' : 'text-ink-400'
                }`}
              >
                {signed(p.delta)}
              </div>
            </div>
            <button
              onClick={() => onUnassign(p.playerId)}
              title="Annulla"
              className="rounded px-1 text-ink-600 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-300"
            >
              &times;
            </button>
          </div>
        ))}
        {!recent.length && <Empty>Nessun giocatore assegnato.</Empty>}
      </div>
    </Section>
  )
}
