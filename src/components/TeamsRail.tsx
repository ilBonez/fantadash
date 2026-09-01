import { int } from '../lib/format'
import type { TeamStats } from '../lib/stats'
import { ROLES } from '../types'
import { Bar, ROLE_BAR, Section } from './ui'

interface Props {
  teams: TeamStats[]
  myTeamId: string | null
  onPickTeam: (id: string) => void
}

/** Colonna compatta con budget e slot di ogni squadra: la vista "chi manca" a colpo d'occhio. */
export default function TeamsRail({ teams, myTeamId, onPickTeam }: Props) {
  return (
    <Section title="Crediti e slot" className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 divide-y divide-ink-800 overflow-auto">
        {teams.map((t) => {
          const spentPct = t.budget > 0 ? t.spent / t.budget : 0
          const mine = t.team.id === myTeamId
          return (
            <button
              key={t.team.id}
              onClick={() => onPickTeam(t.team.id)}
              className={`block w-full px-3 py-2 text-left transition-colors hover:bg-ink-850 ${
                mine ? 'bg-sky-500/10' : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {mine && <span className="mr-1 text-sky-400">&#9733;</span>}
                  {t.team.nome}
                </span>
                <span className="shrink-0 text-xs">
                  <span className={t.remaining < 0 ? 'font-bold text-rose-400' : 'font-semibold text-ink-100'}>
                    {int(t.remaining)}
                  </span>
                  <span className="text-ink-500">/{int(t.budget)}</span>
                </span>
              </div>

              <div className="mt-1.5">
                <Bar
                  value={t.spent}
                  max={t.budget}
                  className={spentPct > 1 ? 'bg-rose-500' : spentPct > 0.85 ? 'bg-amber-500' : 'bg-sky-500'}
                />
              </div>

              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-400">
                {ROLES.map((r) => {
                  const s = t.byRole[r]
                  const done = s.left === 0
                  return (
                    <span key={r} className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${done ? 'bg-ink-600' : ROLE_BAR[r]}`} />
                      <span className={done ? 'text-ink-600' : 'text-ink-300'}>
                        {r} {s.filled}/{s.need}
                      </span>
                    </span>
                  )
                })}
                <span className="ml-auto font-medium text-ink-300">max {int(t.maxBid)}</span>
              </div>
            </button>
          )
        })}
        {!teams.length && <div className="px-3 py-6 text-sm text-ink-400">Aggiungi le squadre in Impostazioni.</div>}
      </div>
    </Section>
  )
}
