import { dec, int, pct, signed } from '../lib/format'
import type { TeamStats } from '../lib/stats'
import { useLeague } from '../lib/useLeague'
import { useAuction } from '../store/useAuction'
import { ROLES, type Role } from '../types'
import { Bar, Empty, ROLE_BAR, RoleBadge, Section, Stat } from './ui'

export default function TeamsView() {
  const league = useLeague()
  const unassign = useAuction((s) => s.unassign)
  const myTeamId = useAuction((s) => s.myTeamId)

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
      <MissingGrid teams={league.teams} />

      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {league.teams.map((t) => (
          <TeamCard key={t.team.id} t={t} mine={t.team.id === myTeamId} onUnassign={unassign} />
        ))}
      </div>

      {!league.teams.length && (
        <Section title="Squadre">
          <Empty>Nessuna squadra. Aggiungile in Impostazioni.</Empty>
        </Section>
      )}
    </div>
  )
}

/** Matrice squadre x ruoli: quanti slot mancano ancora a ognuno. */
function MissingGrid({ teams }: { teams: TeamStats[] }) {
  if (!teams.length) return null
  const totalLeft = teams.reduce((n, t) => n + t.slotsLeft, 0)

  return (
    <Section
      title="Chi manca"
      right={<span className="text-[11px] text-ink-400">{int(totalLeft)} slot da riempire in lega</span>}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-400">
              <th className="px-3 py-1.5 text-left font-semibold">Squadra</th>
              {ROLES.map((r) => (
                <th key={r} className="px-3 py-1.5 text-center font-semibold">
                  {r}
                </th>
              ))}
              <th className="px-3 py-1.5 text-center font-semibold">Slot</th>
              <th className="px-3 py-1.5 text-right font-semibold">Residui</th>
              <th className="px-3 py-1.5 text-right font-semibold" title="Offerta massima lasciando 1 credito per slot">
                Max
              </th>
              <th className="px-3 py-1.5 text-right font-semibold" title="Crediti medi per slot ancora libero">
                Cr/slot
              </th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.team.id} className="border-t border-ink-800">
                <td className="max-w-40 truncate px-3 py-1.5 font-medium">{t.team.nome}</td>
                {ROLES.map((r) => {
                  const s = t.byRole[r]
                  return (
                    <td key={r} className="px-3 py-1.5 text-center">
                      {s.left === 0 ? (
                        <span className="text-emerald-500">&#10003;</span>
                      ) : (
                        <span className="font-semibold text-amber-400">-{s.left}</span>
                      )}
                      <span className="ml-1 text-[11px] text-ink-500">
                        {s.filled}/{s.need}
                      </span>
                    </td>
                  )
                })}
                <td className="px-3 py-1.5 text-center text-ink-300">
                  {t.slotsFilled}/{t.slotsTotal}
                </td>
                <td
                  className={`px-3 py-1.5 text-right font-semibold ${
                    t.remaining < 0 ? 'text-rose-400' : 'text-ink-100'
                  }`}
                >
                  {int(t.remaining)}
                </td>
                <td className="px-3 py-1.5 text-right text-ink-300">{int(t.maxBid)}</td>
                <td className="px-3 py-1.5 text-right text-ink-400">
                  {t.slotsLeft > 0 ? dec(t.remaining / t.slotsLeft) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function TeamCard({
  t,
  mine,
  onUnassign,
}: {
  t: TeamStats
  mine: boolean
  onUnassign: (playerId: number) => void
}) {
  const spentPct = t.budget > 0 ? t.spent / t.budget : 0

  return (
    <Section
      title={`${mine ? '★ ' : ''}${t.team.nome}`}
      right={
        <span className="text-[11px] text-ink-400">
          {t.slotsFilled}/{t.slotsTotal} slot
          {t.complete && <span className="ml-1 text-emerald-400">completa</span>}
        </span>
      }
    >
      <div className="space-y-2.5 px-3 py-2.5">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Spesi" value={int(t.spent)} />
          <Stat
            label="Residui"
            value={int(t.remaining)}
            tone={t.remaining < 0 ? 'bad' : t.remaining < t.slotsLeft ? 'warn' : 'default'}
            sub={`max ${int(t.maxBid)}`}
          />
          <Stat
            label="Su Qt.A"
            value={signed(t.deltaCredits)}
            tone={t.deltaCredits > 0 ? 'bad' : t.deltaCredits < 0 ? 'good' : 'default'}
            sub={Number.isFinite(t.priceRatio) ? `${dec(t.priceRatio, 2)}x` : undefined}
          />
          <Stat label="FVM rosa" value={int(t.totalFvm)} />
        </div>

        <Bar
          value={t.spent}
          max={t.budget}
          className={spentPct > 1 ? 'bg-rose-500' : spentPct > 0.85 ? 'bg-amber-500' : 'bg-sky-500'}
        />

        <div className="flex gap-1.5">
          {ROLES.map((r) => {
            const s = t.byRole[r]
            const share = t.spent > 0 ? s.spent / t.spent : 0
            return (
              <div key={r} className="flex-1" title={`${r}: ${int(s.spent)} crediti (${pct(share)})`}>
                <div className="mb-1 flex items-center justify-between text-[10px] text-ink-400">
                  <span>{r}</span>
                  <span>{pct(share)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div className={`h-full ${ROLE_BAR[r]}`} style={{ width: `${share * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        <RosterList t={t} onUnassign={onUnassign} />
      </div>
    </Section>
  )
}

function RosterList({ t, onUnassign }: { t: TeamStats; onUnassign: (playerId: number) => void }) {
  if (!t.picks.length) return <div className="py-3 text-center text-xs text-ink-500">Rosa vuota.</div>

  const byRole = (r: Role) => t.picks.filter((p) => p.player.r === r)

  return (
    <div className="space-y-1.5">
      {ROLES.map((r) => {
        const list = byRole(r)
        const s = t.byRole[r]
        if (!list.length && s.left === s.need) return null
        return (
          <div key={r}>
            <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-ink-500">
              <RoleBadge role={r} />
              <span>
                {s.filled}/{s.need}
              </span>
              <span className="text-ink-600">· {int(s.spent)} cr</span>
            </div>
            <ul className="divide-y divide-ink-800/70">
              {list.map((p) => (
                <li key={p.playerId} className="group flex items-center gap-2 py-0.5 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{p.player.nome}</span>
                  <span className="shrink-0 text-[11px] text-ink-500">{p.player.squadra}</span>
                  <span className="w-9 shrink-0 text-right font-semibold">{int(p.price)}</span>
                  <span
                    className={`w-9 shrink-0 text-right text-[11px] ${
                      p.delta > 0 ? 'text-rose-400' : p.delta < 0 ? 'text-emerald-400' : 'text-ink-500'
                    }`}
                  >
                    {signed(p.delta)}
                  </span>
                  <button
                    onClick={() => onUnassign(p.playerId)}
                    title="Rimuovi"
                    className="shrink-0 rounded px-1 text-ink-600 opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-300"
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
