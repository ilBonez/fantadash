import { dec, int, pct, pctSigned, signed } from '../lib/format'
import { fvm, quot } from '../lib/listone'
import type { EnrichedPick } from '../lib/stats'
import { useLeague } from '../lib/useLeague'
import { useAuction } from '../store/useAuction'
import { ROLES, type Player } from '../types'
import { Bar, Empty, ROLE_BAR, RoleBadge, Section, Stat } from './ui'

export default function StatsView() {
  const league = useLeague()
  const mode = useAuction((s) => s.settings.mode)

  const leaderFvm = [...league.teams].sort((a, b) => b.totalFvm - a.totalFvm)
  const maxFvm = leaderFvm[0]?.totalFvm ?? 0

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Avanzamento asta"
          value={pct(league.avanzamento)}
          sub={`${int(league.giocatoriAssegnati)}/${int(league.slotTotali)} slot`}
        />
        <Stat label="Crediti spesi" value={int(league.spesi)} sub={`su ${int(league.creditiTotali)} totali`} />
        <Stat
          label="Crediti residui"
          value={int(league.residui)}
          tone={league.residui < 0 ? 'bad' : 'default'}
          sub={league.creditiTotali > 0 ? pct(league.residui / league.creditiTotali) : undefined}
        />
        <Stat
          label="Inflazione"
          value={Number.isFinite(league.inflazione) ? `${dec(league.inflazione, 2)}x` : '-'}
          tone={league.inflazione > 1.15 ? 'bad' : league.inflazione < 0.95 ? 'good' : 'default'}
          sub="spesa / quotazioni"
        />
        <Stat
          label="Prezzo medio"
          value={league.giocatoriAssegnati ? dec(league.spesi / league.giocatoriAssegnati) : '-'}
          sub="per giocatore"
        />
        <Stat
          label="Top acquisto"
          value={league.topAcquisti[0] ? int(league.topAcquisti[0].price) : '-'}
          sub={league.topAcquisti[0]?.player.nome}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Section title="Prezzo per reparto">
          <div className="space-y-2 px-3 py-2.5">
            {ROLES.map((r) => {
              const s = league.prezzoMedioRuolo[r]
              const speso = league.enriched
                .filter((p) => p.player.r === r)
                .reduce((n, p) => n + p.price, 0)
              const share = league.spesi > 0 ? speso / league.spesi : 0
              return (
                <div key={r}>
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <RoleBadge role={r} />
                    <span className="text-ink-300">{int(speso)} cr</span>
                    <span className="text-ink-500">
                      medio {dec(s.medio)} · max {int(s.max)} · {s.count} presi
                    </span>
                    <span className="ml-auto font-semibold text-ink-200">{pct(share)}</span>
                  </div>
                  <Bar value={share} max={1} className={ROLE_BAR[r]} />
                </div>
              )
            })}
          </div>
        </Section>

        <Section title="Classifica valore rose" right={<span className="text-[11px] text-ink-400">per FVM totale</span>}>
          {leaderFvm.length ? (
            <div className="space-y-2 px-3 py-2.5">
              {leaderFvm.map((t, i) => (
                <div key={t.team.id}>
                  <div className="mb-1 flex items-baseline gap-2 text-xs">
                    <span className="w-4 text-right font-mono text-ink-500">{i + 1}</span>
                    <span className="truncate font-medium">{t.team.nome}</span>
                    <span className="ml-auto shrink-0 text-ink-400">
                      {int(t.spent)} cr ·{' '}
                      <span className={t.deltaCredits > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                        {signed(t.deltaCredits)}
                      </span>
                    </span>
                    <span className="w-14 shrink-0 text-right font-semibold text-ink-100">{int(t.totalFvm)}</span>
                  </div>
                  <Bar value={t.totalFvm} max={maxFvm} className="bg-violet-500" />
                </div>
              ))}
            </div>
          ) : (
            <Empty>Nessuna squadra.</Empty>
          )}
        </Section>
      </div>

      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        <PickTable
          title="Top acquisti"
          hint="i piu costosi dell'asta"
          picks={league.topAcquisti}
          metric={(p) => ({ value: int(p.price), tone: 'default' })}
        />
        <PickTable
          title="Migliori affari"
          hint="pagati sotto quotazione (Qt.A >= 5)"
          picks={league.affari}
          metric={(p) => ({ value: `${signed(p.delta)} (${pctSigned(p.deltaPct)})`, tone: 'good' })}
        />
        <PickTable
          title="Sovrapagati"
          hint="pagati sopra quotazione (Qt.A >= 5)"
          picks={league.sovrapagati}
          metric={(p) => ({ value: `${signed(p.delta)} (${pctSigned(p.deltaPct)})`, tone: 'bad' })}
        />
        <PickTable
          title="Scommesse"
          hint="quotazione bassa, prezzo almeno 3x"
          picks={league.scommesse}
          metric={(p) => ({ value: `${int(p.price)} su Qt.A ${int(p.quot)}`, tone: 'warn' })}
        />
        <PickTable
          title="Miglior valore"
          hint="piu FVM per credito speso"
          picks={league.miglioriValori}
          metric={(p) => ({ value: `${dec(p.valueIdx)} FVM/cr`, tone: 'good' })}
        />
        <BigDisponibili players={league.bigDisponibili} mode={mode} />
      </div>
    </div>
  )
}

type Tone = 'default' | 'good' | 'bad' | 'warn'

const TONE: Record<Tone, string> = {
  default: 'text-ink-100',
  good: 'text-emerald-400',
  bad: 'text-rose-400',
  warn: 'text-amber-400',
}

function PickTable({
  title,
  hint,
  picks,
  metric,
}: {
  title: string
  hint: string
  picks: EnrichedPick[]
  metric: (p: EnrichedPick) => { value: string; tone: Tone }
}) {
  return (
    <Section title={title} right={<span className="text-[11px] text-ink-500">{hint}</span>}>
      {picks.length ? (
        <ul className="divide-y divide-ink-800">
          {picks.map((p) => {
            const m = metric(p)
            return (
              <li key={p.playerId} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
                <RoleBadge role={p.player.r} />
                <span className="min-w-0 flex-1 truncate font-medium">{p.player.nome}</span>
                <span className="shrink-0 truncate text-[11px] text-ink-500">{p.team.nome}</span>
                <span className={`shrink-0 text-right text-xs font-semibold ${TONE[m.tone]}`}>{m.value}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty>Ancora nulla da mostrare.</Empty>
      )}
    </Section>
  )
}

function BigDisponibili({ players, mode }: { players: Player[]; mode: 'classic' | 'mantra' }) {
  return (
    <Section title="Big ancora liberi" right={<span className="text-[11px] text-ink-500">per quotazione</span>}>
      {players.length ? (
        <ul className="divide-y divide-ink-800">
          {players.slice(0, 12).map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
              <RoleBadge role={p.r} />
              <span className="min-w-0 flex-1 truncate font-medium">{p.nome}</span>
              <span className="shrink-0 text-[11px] text-ink-500">{p.squadra}</span>
              <span className="w-8 shrink-0 text-right font-semibold">{int(quot(p, mode))}</span>
              <span className="w-10 shrink-0 text-right text-[11px] text-ink-400">{int(fvm(p, mode))}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Tutti presi.</Empty>
      )}
    </Section>
  )
}
