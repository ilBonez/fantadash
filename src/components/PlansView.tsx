import { useMemo, useState } from 'react'
import { dec, int, pct } from '../lib/format'
import { TEMPERATURE, type Market } from '../lib/market'
import { buildPlans, type Plan, type PlanPick, type RolePlan } from '../lib/plans'
import { useLeague } from '../lib/useLeague'
import { useAuction } from '../store/useAuction'
import { ROLES } from '../types'
import PlayerTags from './PlayerTags'
import { Bar, Empty, ROLE_BAR, RoleBadge, Section, Stat } from './ui'

export default function PlansView() {
  const league = useLeague()
  const teams = useAuction((s) => s.teams)
  const myTeamId = useAuction((s) => s.myTeamId)
  const setMyTeam = useAuction((s) => s.setMyTeam)
  const setTargets = useAuction((s) => s.setTargets)
  const targetIds = useAuction((s) => s.targetIds)

  const [forTeamId, setForTeamId] = useState<string | null>(myTeamId)
  const team = league.teams.find((t) => t.team.id === (forTeamId ?? myTeamId)) ?? league.teams[0]

  const plans = useMemo(() => {
    if (!team) return []
    return buildPlans({
      available: league.available,
      team,
      prezzo: league.prezzo,
      sogliaTop: league.sogliaTop,
    })
  }, [league.available, league.prezzo, league.sogliaTop, team])

  if (!team) {
    return (
      <div className="min-h-0 flex-1 p-3">
        <Section title="Piani rosa">
          <Empty>Aggiungi almeno una squadra in Impostazioni.</Empty>
        </Section>
      </div>
    )
  }

  const maxFvm = Math.max(1, ...plans.map((p) => p.totalFvm))

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
      <Section
        title="Piani rosa"
        right={
          <div className="flex items-center gap-2">
            <select value={team.team.id} onChange={(e) => setForTeamId(e.target.value)} className="field py-1 text-xs">
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                  {t.id === myTeamId ? ' (la mia)' : ''}
                </option>
              ))}
            </select>
            {team.team.id !== myTeamId && (
              <button className="btn py-1 text-xs" onClick={() => setMyTeam(team.team.id)}>
                Segna come mia
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-3 px-3 py-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Crediti da spendere" value={int(team.remaining)} sub={`di ${int(team.budget)}`} />
            <Stat
              label="Slot da riempire"
              value={`${team.slotsLeft}`}
              sub={
                ROLES.filter((r) => team.byRole[r].left > 0)
                  .map((r) => `${r} ${team.byRole[r].left}`)
                  .join(' · ') || 'rosa completa'
              }
            />
            <Stat
              label="Crediti per slot"
              value={team.slotsLeft > 0 ? dec(team.remaining / team.slotsLeft) : '-'}
              sub="media disponibile"
            />
            <Stat
              label="Listino d'asta"
              value={TEMPERATURE[league.market.temperatura].label}
              sub="si aggiorna a ogni acquisto"
            />
            <Stat label="Giocatori liberi" value={int(league.available.length)} sub="esclusi i venduti" />
          </div>

          <p className="text-xs text-ink-400">
            Ogni piano riempie <strong className="text-ink-200">solo gli slot che mancano</strong> con i crediti
            residui, ai prezzi attesi di adesso. I portieri seguono sempre la stessa regola:{' '}
            <strong className="text-ink-200">primo e secondo della stessa squadra</strong>, cosi non resti mai senza
            voto. &ldquo;Usa come obiettivi&rdquo; mette la stella a quei giocatori: nella vista Asta li filtri con la
            spunta <em>obiettivi</em>.
          </p>
        </div>
      </Section>

      <Listino market={league.market} sogliaTop={league.sogliaTop} />

      {team.slotsLeft === 0 ? (
        <Section title="Rosa completa">
          <Empty>Questa squadra ha tutti gli slot pieni: non c&apos;e nulla da pianificare.</Empty>
        </Section>
      ) : (
        <>
          <Confronto plans={plans} maxFvm={maxFvm} />

          <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.strategy.id}
                plan={plan}
                best={plan.totalFvm === maxFvm}
                applied={plan.picks.length > 0 && plan.picks.every((p) => targetIds.includes(p.player.id))}
                onApply={() => setTargets(plan.picks.map((p) => p.player.id))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Il listino d'asta usato per i piani: serve a capire perche un piano non
 * compra due top nello stesso reparto.
 */
function Listino({ market, sogliaTop }: { market: Market; sogliaTop: number }) {
  const salito = ROLES.filter((r) => market.reparti[r].lambda > 1.05)

  return (
    <Section
      title="Listino d'asta"
      right={
        <span className="text-[11px] text-ink-500">
          {TEMPERATURE[market.temperatura].label}
          {salito.length > 0 && ` · sopra il listone su ${salito.join(', ')}`}
        </span>
      }
    >
      <p className="border-b border-ink-800 px-3 py-2 text-xs text-ink-400">
        Si parte dal <strong className="text-ink-200">prezzo consigliato</strong> del listone e si corregge con quello
        che l&apos;asta sta dicendo. Comprato un attaccante Top salgono gli altri Top, sale poco la 1a fascia e non si
        muove la 2a: la spinta dipende da quanta parte della fascia e&apos; gia&apos; andata, e ogni acquisto pesa meno del
        precedente. Sopra a tutto c&apos;e&apos; <strong className="text-ink-200">lambda</strong>, che tiene insieme quanti
        crediti restano e quanto la lega ha strapagato finora.
      </p>
      <p className="border-b border-ink-800 px-3 py-2 text-xs text-ink-400">
        Temperatura attesa <span className="font-semibold text-ink-200">{dec(market.clima.prior, 2)}x</span>
        {market.clima.osservata !== null && (
          <>
            {' · osservata finora '}
            <span
              className={`font-semibold ${
                market.clima.osservata > 1.1
                  ? 'text-rose-400'
                  : market.clima.osservata < 0.9
                    ? 'text-emerald-400'
                    : 'text-ink-200'
              }`}
            >
              {dec(market.clima.osservata, 2)}x
            </span>
            {' · usata adesso '}
            <span className="font-semibold text-ink-200">{dec(market.clima.usata, 2)}x</span>
            {' (fiducia '}
            {Math.round(market.clima.confidenza * 100)}
            {'%)'}
          </>
        )}
        {market.clima.osservata === null && ' · nessuna assegnazione ancora: si va di sola attesa.'}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-400">
              <th className="px-3 py-1.5 text-left font-semibold">Reparto</th>
              <th className="px-3 py-1.5 text-right font-semibold" title="Crediti che la lega spendera ancora nel reparto">
                Budget che resta
              </th>
              <th className="px-3 py-1.5 text-right font-semibold" title="Slot ancora da riempire in tutta la lega">
                Slot
              </th>
              <th
                className="px-3 py-1.5 text-right font-semibold"
                title="Scostamento dai prezzi consigliati in questo reparto: sopra 1 la lega sta pagando piu del listone"
              >
                Lambda
              </th>
              <th className="px-3 py-1.5 text-right font-semibold" title="Prezzo del migliore ancora libero">
                Il migliore libero
              </th>
              <th
                className="px-3 py-1.5 text-right font-semibold"
                title="Prezzo del migliore del reparto a inizio asta: e un altro giocatore, serve solo da riferimento di scala"
              >
                Era il top
              </th>
              <th
                className="px-3 py-1.5 text-left font-semibold"
                title="Quanto e salita ogni fascia da inizio asta, e quanti giocatori le restano"
              >
                Spinta per fascia
              </th>
              <th className="px-3 py-1.5 text-right font-semibold" title="Giocatori liberi che valgono 1 credito">
                A 1 credito
              </th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => {
              const m = market.reparti[r]
              return (
                <tr key={r} className="border-t border-ink-800">
                  <td className="px-3 py-1.5">
                    <RoleBadge role={r} />
                  </td>
                  <td className="px-3 py-1.5 text-right text-ink-300">{int(m.budgetResiduo)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-300">{int(m.slotResidui)}</td>
                  <td
                    className={`px-3 py-1.5 text-right font-semibold ${
                      m.lambda > 1.1 ? 'text-rose-400' : m.lambda < 0.9 && m.lambda > 0 ? 'text-emerald-400' : 'text-ink-200'
                    }`}
                  >
                    {m.lambda > 0 ? `${dec(m.lambda, 2)}x` : '-'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold">{int(m.topOra)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-500">{int(m.topIniziale)}</td>
                  <td className="px-3 py-1.5">
                    <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                      {m.pressioni.map((f) => (
                        <span
                          key={f.fascia}
                          title={`${f.fascia}: ${f.liberi} liberi su ${f.iniziali}`}
                          className={f.spinta > 1.1 ? 'text-rose-400' : 'text-ink-500'}
                        >
                          {f.fascia.replace(' fascia', '')} {dec(f.spinta, 2)}x
                        </span>
                      ))}
                      {!m.pressioni.length && <span className="text-ink-600">-</span>}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-ink-400">{int(m.aUnCredito)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-ink-800 px-3 py-2 text-[11px] text-ink-500">
        <strong className="text-ink-300">Spinta per fascia</strong> e&apos; quanto i prezzi di quella fascia sono saliti
        da inizio asta: sopra 1 ne restano meno di quanti ne servono. Si scaldano solo le fasce che concentrano
        crediti — gli attaccanti Top, i portieri di 2a-3a, i difensori di 3a — e il contagio arriva alla fascia
        accanto, non oltre. <strong className="text-ink-300">Lambda</strong> e&apos; lo scostamento complessivo dai
        prezzi consigliati: presto segue quanto la lega ha strapagato, tardi quanti crediti restano davvero.
        Un giocatore conta come &ldquo;fascia alta&rdquo; sopra {int(sogliaTop)} crediti: i piani ne prendono al massimo
        2 a centrocampo e 1 in attacco, che e&apos; la media reale di una rosa.
      </p>
    </Section>
  )
}

/** Tabella di confronto: serve per scegliere il piano senza scorrere tutte le schede. */
function Confronto({ plans, maxFvm }: { plans: Plan[]; maxFvm: number }) {
  const riferimento = plans.find((p) => p.totalFvm === maxFvm)
  const idsRif = new Set(riferimento?.picks.map((c) => c.player.id) ?? [])
  const diversi = (p: Plan) => p.picks.filter((c) => !idsRif.has(c.player.id)).length

  return (
    <Section title="Confronto" right={<span className="text-[11px] text-ink-500">{plans.length} piani</span>}>
      <p className="border-b border-ink-800 px-3 py-2 text-xs text-ink-400">
        Se vedi piu piani <em>identici</em> non e un errore: le quote per reparto sono un obiettivo, ma chi decide e
        il mercato. Quando i giocatori ancora liberi costano meno della quota, non c&apos;e nulla su cui spendere di
        piu e i piani convergono sulla stessa rosa. Le differenze vere le fanno le colonne{' '}
        <strong className="text-ink-200">Rig.</strong> e <strong className="text-ink-200">Tit.</strong>, e i piani che
        cambiano la composizione (Tre intoccabili, Cinque big, Tieni crediti).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-400">
              <th className="px-3 py-1.5 text-left font-semibold">Piano</th>
              <th className="px-3 py-1.5 text-right font-semibold">Costo</th>
              <th className="px-3 py-1.5 text-right font-semibold">Avanzo</th>
              <th className="px-3 py-1.5 text-right font-semibold" title="FVM aggiunto dal piano">
                FVM
              </th>
              <th className="w-40 px-3 py-1.5 text-left font-semibold" />
              <th
                className="px-3 py-1.5 text-center font-semibold"
                title="Giocatori di fascia alta per reparto (D / C / A)"
              >
                Top D/C/A
              </th>
              <th className="px-3 py-1.5 text-right font-semibold" title="Slot presi a 1-2 crediti">
                1-2 cr
              </th>
              <th className="px-3 py-1.5 text-right font-semibold" title="Rigoristi designati nel piano">
                Rig.
              </th>
              <th className="px-3 py-1.5 text-right font-semibold" title="Titolari della formazione tipo">
                Tit.
              </th>
              <th
                className="px-3 py-1.5 text-right font-semibold"
                title="Quanti giocatori cambiano rispetto al piano con FVM piu alto"
              >
                Diverso
              </th>
              <th className="px-3 py-1.5 text-left font-semibold" title="Blocco portieri e trasferte in comune">Blocco portieri</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.strategy.id} className="border-t border-ink-800">
                <td className="px-3 py-1.5 font-medium">{p.strategy.nome}</td>
                <td className="px-3 py-1.5 text-right">{int(p.cost)}</td>
                <td
                  className={`px-3 py-1.5 text-right ${
                    p.residuo < 0 ? 'text-rose-400' : p.residuo > p.budget * 0.2 ? 'text-amber-400' : 'text-ink-300'
                  }`}
                >
                  {int(p.residuo)}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold">{int(p.totalFvm)}</td>
                <td className="px-3 py-1.5">
                  <Bar value={p.totalFvm} max={maxFvm} className="bg-violet-500" />
                </td>
                <td className="px-3 py-1.5 text-center font-mono text-xs text-ink-300">
                  {p.top.D}/{p.top.C}/{p.top.A}
                </td>
                <td className="px-3 py-1.5 text-right text-ink-400">{p.aPocoPrezzo}</td>
                <td className="px-3 py-1.5 text-right text-ink-300">{p.rigoristi}</td>
                <td className="px-3 py-1.5 text-right text-ink-300">
                  {p.titolari}/{p.picks.length}
                </td>
                <td
                  className={`px-3 py-1.5 text-right ${
                    diversi(p) === 0 ? 'text-ink-600' : 'text-ink-300'
                  }`}
                >
                  {diversi(p) === 0 ? 'identico' : `${diversi(p)} su ${p.picks.length}`}
                </td>
                <td className="px-3 py-1.5 text-xs text-ink-300">
                  {p.abbinamentoPortieri ?? <span className="text-amber-400">non applicato</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function PlanCard({
  plan,
  best,
  applied,
  onApply,
}: {
  plan: Plan
  best: boolean
  applied: boolean
  onApply: () => void
}) {
  const completo = plan.copertura >= 1

  return (
    <Section
      title={plan.strategy.nome}
      right={
        best ? (
          <span className="rounded border border-violet-500/50 bg-violet-500/15 px-1.5 py-px text-[10px] font-semibold uppercase text-violet-300">
            FVM piu alto
          </span>
        ) : undefined
      }
    >
      <div className="space-y-2.5 px-3 py-2.5">
        <p className="text-xs text-ink-400">{plan.strategy.descrizione}</p>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="Costo stimato" value={int(plan.cost)} sub={`su ${int(plan.budget)} residui`} />
          <Stat
            label="Avanzo"
            value={int(plan.residuo)}
            tone={plan.residuo < 0 ? 'bad' : plan.residuo > plan.budget * 0.2 ? 'warn' : 'good'}
            sub={plan.strategy.uso ? `${pct(plan.strategy.uso)} usato di proposito` : undefined}
          />
          <Stat label="FVM aggiunto" value={int(plan.totalFvm)} sub={`rosa a ${int(plan.totalFvmRosa)}`} />
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-400">
          <span>
            <span className="font-semibold text-ink-200">{plan.rigoristi}</span> rigoristi
          </span>
          <span>
            <span className="font-semibold text-ink-200">{plan.titolari}</span>/{plan.picks.length} titolari
          </span>
          <span title={`Fascia alta = oltre ${plan.sogliaTop} crediti`}>
            fascia alta <span className="font-semibold text-ink-200">{plan.top.D}/{plan.top.C}/{plan.top.A}</span> D/C/A
          </span>
          <span>
            <span className="font-semibold text-ink-200">{plan.aPocoPrezzo}</span> slot da 1-2 cr
          </span>
          {plan.abbinamentoPortieri && (
            <span title="Blocco portieri scelto per copertura di calendario: piu basso e il numero, meglio si alternano">
              portieri: <span className="font-semibold text-ink-200">{plan.abbinamentoPortieri}</span>
            </span>
          )}
        </div>

        {!completo && (
          <p className="text-xs text-amber-400">
            Con questi crediti il piano copre {plan.picks.length} slot su{' '}
            {Math.round(plan.picks.length / Math.max(plan.copertura, 0.001))}: servono piu crediti o obiettivi piu
            economici.
          </p>
        )}

        <div className="space-y-2">
          {plan.roles
            .filter((r) => r.need > 0)
            .map((r) => (
              <RoleBlock key={r.role} r={r} total={plan.cost} />
            ))}
        </div>

        <button className={applied ? 'btn w-full' : 'btn-primary w-full'} onClick={onApply}>
          {applied ? 'Obiettivi impostati su questo piano' : 'Usa come obiettivi'}
        </button>
      </div>
    </Section>
  )
}

function RoleBlock({ r, total }: { r: RolePlan; total: number }) {
  const share = total > 0 ? r.cost / total : 0

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[11px]">
        <RoleBadge role={r.role} />
        <span className="text-ink-400">
          {r.picks.length}/{r.need} slot
        </span>
        <span className="ml-auto text-ink-300" title={`Quota prevista dalla strategia: ${int(r.budget)} cr`}>
          {int(r.cost)} cr <span className="ml-1 text-ink-500">{pct(share)} della spesa</span>
        </span>
      </div>
      <Bar value={share} max={1} className={ROLE_BAR[r.role]} />
      {r.nota && <p className="mt-1 text-[11px] text-amber-400">{r.nota}</p>}
      <ul className="mt-1 divide-y divide-ink-800/70">
        {r.picks.map((c) => (
          <PickRow key={c.player.id} c={c} />
        ))}
      </ul>
    </div>
  )
}

function PickRow({ c }: { c: PlanPick }) {
  return (
    <li className="flex items-center gap-2 py-0.5 text-[13px]" title={c.player.nota}>
      <span className="min-w-0 flex-1 truncate">{c.player.nome}</span>
      <PlayerTags p={c.player} />
      <span className="shrink-0 text-[11px] text-ink-500">{c.player.squadra}</span>
      <span className="w-9 shrink-0 text-right font-semibold">{int(c.expPrice)}</span>
      <span className="w-10 shrink-0 text-right text-[11px] text-ink-400">{int(c.fvm)}</span>
    </li>
  )
}
