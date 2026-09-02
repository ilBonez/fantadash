import type { ReactNode } from 'react'
import { giudizio, type Abbinamento } from '../lib/abbinamenti'
import { ballottaggioDi, etichettaFonti, type Ballottaggio } from '../lib/ballottaggi'
import type { Advice } from '../lib/advice'
import { dec, int } from '../lib/format'
import { trasferteComuni } from '../lib/listone'
import type { TeamStats } from '../lib/stats'
import type { Player } from '../types'
import PlayerTags, { FasciaBadge, tonoInfortunio } from './PlayerTags'
import { RoleBadge, TONO_TRASFERTE } from './ui'

interface Props {
  player: Player
  advice?: Advice
  abbinamento?: Abbinamento
  /** La squadra di riferimento: serve per il confronto con chi hai gia in rosa. */
  myTeam?: TeamStats
  /** Obiettivi gia marcati: la stella nel ballottaggio si accende da qui. */
  targetIds: Set<number>
  onToggleTarget: (playerId: number) => void
  onChiudi: () => void
}

/**
 * Scheda completa del giocatore chiamato all'asta.
 *
 * Tutto quello che il listone sa sta qui invece che nelle righe della lista:
 * in asta si guarda un giocatore alla volta, e sono i trenta secondi in cui
 * serve avere davanti prezzi, stato fisico, rendimento e abbinamenti insieme.
 */
export default function PlayerCard({
  player: p,
  advice,
  abbinamento,
  myTeam,
  targetIds,
  onToggleTarget,
  onChiudi,
}: Props) {
  const inf = tonoInfortunio(p)
  const bal = ballottaggioDi(p)

  return (
    <div className="max-h-[46vh] min-h-28 overflow-auto border-t border-sky-500/40 bg-ink-900 shadow-[0_-12px_28px_-12px_rgba(0,0,0,0.8)]">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-ink-800 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <RoleBadge role={p.r} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-base font-semibold leading-tight">{p.nome}</span>
              <FasciaBadge fascia={p.fascia} full />
              <PlayerTags p={p} />
            </div>
            <div className="text-[11px] text-ink-400">
              {p.squadra} · {p.rm} · <span className="text-ink-300">#{int(p.prio)}</span> fra i{' '}
              {p.r === 'P' ? 'portieri' : p.r === 'D' ? 'difensori' : p.r === 'C' ? 'centrocampisti' : 'attaccanti'}
              {' · indice '}
              <span className="text-ink-300">{dec(p.indice, 1)}</span>
              {' · FVM #'}
              <span className="text-ink-300">{int(p.rankFvm)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onChiudi}
          title="Chiudi la scheda (Esc)"
          className="ml-auto rounded px-2 py-0.5 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-100"
        >
          &times;
        </button>
      </div>

      {(p.nota || p.inf) && (
        <div
          className={`border-b px-3 py-1.5 text-xs ${
            inf === 'grave'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : inf
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                : 'border-ink-800 bg-ink-850/60 text-ink-300'
          }`}
        >
          <strong className="font-semibold">{p.inf?.stato || p.nota}</strong>
          {p.inf?.dettaglio && <span className="ml-1.5">{p.inf.dettaglio}</span>}
          {p.inf?.stato && p.nota && <span className="ml-1.5 text-ink-400">({p.nota})</span>}
        </div>
      )}

      <div className="grid gap-3 px-3 py-2.5 md:grid-cols-2 xl:grid-cols-4">
        <Blocco titolo="Prezzi">
          <Riga label="Quotazione" value={`${int(p.qtI)} → ${int(p.qtA)}`} hint="iniziale → attuale" />
          <Riga label="FVM" value={int(p.fvm)} hint="Fanta Valore di Mercato" />
          <Riga
            label="Consigliato"
            value={
              <>
                {int(p.cons)}
                <span className="ml-1 text-[11px] font-normal text-ink-400">max {int(p.max)}</span>
              </>
            }
            hint="dal listone, su 500 crediti e 10 squadre"
          />
          {advice && (
            <>
              <Riga
                label="Listino d'asta"
                value={
                  <span
                    className={
                      advice.fontePrezzo === 'override'
                        ? 'text-sky-300'
                        : advice.sopraMax
                          ? 'text-amber-300'
                          : undefined
                    }
                  >
                    {int(advice.expPrice)}
                    {advice.fontePrezzo === 'override' && (
                      <span className="ml-1 text-[11px] font-normal text-ink-400">(tuo)</span>
                    )}
                  </span>
                }
                hint={
                  advice.sopraMax
                    ? 'oltre il prezzo max del listone: la lega lo sta pagando piu di quanto valga'
                    : 'prezzo atteso con l asta a questo punto'
                }
              />
              <Riga label="FVM per credito" value={dec(advice.value)} />
              <Riga
                label="Score per te"
                value={<span className={advice.score >= 70 ? 'text-emerald-400' : 'text-ink-100'}>{advice.score}</span>}
              />
            </>
          )}
          {myTeam && (
            <Riga
              label="Il tuo massimo"
              value={int(myTeam.maxBid)}
              hint={`${myTeam.team.nome}: ${int(myTeam.remaining)} crediti e ${myTeam.slotsLeft} slot`}
            />
          )}
        </Blocco>

        <Blocco titolo="Rendimento">
          {p.s25 ? (
            <>
              <Riga
                label="Presenze 25/26"
                value={
                  <span className={p.s25.pg >= 25 ? 'text-emerald-400' : p.s25.pg < 10 ? 'text-amber-400' : undefined}>
                    {int(p.s25.pg)}
                    <span className="text-[11px] font-normal text-ink-400">/38</span>
                  </span>
                }
                hint={`In Serie A 2025/26 con ${p.s25.squadra || p.squadra}${
                  p.s25.squadra && p.s25.squadra !== p.squadra ? ' — squadra diversa da quella attuale' : ''
                }`}
              />
              <Riga label="Fantamedia 25/26" value={dec(p.s25.fm ?? 0)} hint={`media voto ${dec(p.s25.mv ?? 0)}`} />
              <Riga label="Gol e assist 25/26" value={`${int(p.s25.gol)}G ${int(p.s25.ass)}A`} />
              <Riga
                label="Rigori 25/26"
                value={p.s25.rig}
                hint={`${int(p.s25.amm)} ammonizioni, ${int(p.s25.esp)} espulsioni`}
              />
            </>
          ) : (
            <div className="rounded border border-amber-500/25 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-200/90">
              <strong className="font-semibold">Non era in Serie A nel 2025/26.</strong> Nessuna presenza, nessuno
              storico su cui basarsi: per lui pesa quasi solo il valore di mercato.
            </div>
          )}
          <Riga
            label="FM ponderata"
            value={dec(p.fmPond)}
            hint="fantamedia 25/26 riportata verso 5,50 in base alle presenze"
          />
          <Riga
            label="2026/27"
            value={p.s26.pg ? `${dec(p.s26.fm ?? 0)} FM` : '-'}
            hint={
              p.s26.pg
                ? `${int(p.s26.pg)}/2 presenze, media voto ${dec(p.s26.mv ?? 0)}, ${int(p.s26.gol)}G ${int(p.s26.ass)}A`
                : 'nessuna presenza nelle prime due giornate'
            }
          />
          <Riga label="Gerarchia" value={p.gerarchia} hint={p.nota} />
          {(p.rig || p.piaz) && (
            <Riga
              label="Bonus"
              value={[p.rig ? `${p.rig}o rigorista` : null, p.piaz ? `${p.piaz}o piazzati` : null]
                .filter(Boolean)
                .join(' · ')}
            />
          )}
        </Blocco>

        <Blocco titolo="Ballottaggio">
          <Ballottaggi p={p} bal={bal} targetIds={targetIds} onToggleTarget={onToggleTarget} />
        </Blocco>

        <Blocco titolo="Abbinamenti di calendario">
          <Abbinamenti p={p} ab={abbinamento} myTeam={myTeam} />
        </Blocco>
      </div>

      {advice && advice.motivi.length > 0 && (
        <div className="border-t border-ink-800 px-3 py-1.5 text-[11px] text-ink-400">
          {advice.motivi.join(' · ')}
        </div>
      )}
    </div>
  )
}

/**
 * Chi si gioca il posto con lui, e la stella per portarsi dietro l'alternativa.
 *
 * All'asta la coppia titolare-riserva della stessa squadra vale piu' della
 * somma dei due: quando il titolare salta il turno il voto lo porta l'altro.
 * Per questo ogni nome del gruppo ha la sua stella: si segna l'obiettivo senza
 * uscire dalla scheda e senza perdere il giocatore che e' in asta adesso.
 */
function Ballottaggi({
  p,
  bal,
  targetIds,
  onToggleTarget,
}: {
  p: Player
  bal: Ballottaggio | null
  targetIds: Set<number>
  onToggleTarget: (playerId: number) => void
}) {
  if (!bal) {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] text-ink-400">
          <strong className="font-semibold text-ink-300">Non in ballottaggio.</strong> Nessun altro{' '}
          {p.squadra ? `nel ${p.squadra}` : 'in rosa'} ha il suo stesso ruolo ({p.rm.toLowerCase()}), quindi non c&apos;e&apos;
          un&apos;alternanza da leggere.
        </p>
        <p className="text-[10px] text-ink-500">Fonti: {etichettaFonti(p)}.</p>
      </div>
    )
  }

  const altro = bal.parte ? bal.riserva : bal.titolare

  return (
    <div className="space-y-1.5">
      {altro ? (
        <div className="text-[11px] leading-snug text-ink-400">
          {bal.parte ? 'La sua riserva diretta e ' : 'Davanti a lui parte '}
          <span className="font-semibold text-ink-100">{altro.nome}</span>
          {bal.parte ? '.' : '.'} {bal.parte ? 'Se salta il turno, gioca lui.' : 'E il posto che deve prendersi.'}
        </div>
      ) : (
        <div className="text-[11px] leading-snug text-ink-400">
          {bal.parte
            ? 'Nessuna riserva nel listone per il suo ruolo: se salta, la squadra cambia assetto.'
            : 'Nel gruppo non risulta un titolare designato.'}
        </div>
      )}

      <ul className="divide-y divide-ink-800/70 rounded border border-ink-800">
        {bal.gruppo.map((x) => {
          const parte = bal.titolari.some((t) => t.id === x.id)
          const isLui = x.id === p.id
          const isTarget = targetIds.has(x.id)
          return (
            <li
              key={x.id}
              className={`flex items-center gap-1.5 px-1.5 py-1 text-[11px] ${isLui ? 'bg-sky-500/10' : ''}`}
            >
              <span
                title={parte ? 'Parte titolare' : 'Parte dalla panchina'}
                className={`size-1.5 shrink-0 rounded-full ${parte ? 'bg-emerald-400' : 'bg-ink-600'}`}
              />
              <span className={`min-w-0 flex-1 truncate ${isLui ? 'font-semibold text-ink-100' : 'text-ink-300'}`}>
                {x.nome}
                {isLui && <span className="ml-1 text-[10px] font-normal text-sky-300">in asta</span>}
              </span>
              <span
                title={`${etichettaFonti(x)} · listone: ${x.gerarchia}`}
                className="shrink-0 font-mono text-[10px] text-ink-500"
              >
                {x.fonti}/2
              </span>
              <span className="w-7 shrink-0 text-right text-[10px] text-ink-500">{int(x.cons)}</span>
              {isLui ? (
                <span className="w-5 shrink-0" />
              ) : (
                <button
                  onClick={() => onToggleTarget(x.id)}
                  title={
                    isTarget
                      ? `Togli ${x.nome} dagli obiettivi`
                      : `Segna ${x.nome} come obiettivo, senza uscire da questa scheda`
                  }
                  className={`w-5 shrink-0 text-center text-sm leading-none ${
                    isTarget ? 'text-amber-400' : 'text-ink-700 hover:text-ink-300'
                  }`}
                >
                  &#9733;
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <p className="text-[10px] leading-snug text-ink-500">
        Il pallino verde e chi parte, <span className="font-mono">n/2</span> quante probabili formazioni lo mettono
        nell&apos;undici, poi il prezzo consigliato.
      </p>
    </div>
  )
}

function Abbinamenti({ p, ab, myTeam }: { p: Player; ab?: Abbinamento; myTeam?: TeamStats }) {
  // Chi hai gia in rosa nello stesso reparto: il confronto che conta davvero,
  // perche il portiere che compri deve coprire quello che hai gia.
  const inRosa = myTeam?.picks.filter((x) => x.player.r === p.r && x.playerId !== p.id) ?? []

  return (
    <>
      {ab?.coppia ? (
        <Riga
          label="Coppia migliore"
          value={
            <>
              {ab.coppia.partner.nome}
              <span className="ml-1 font-mono text-[10px] text-ink-500">{ab.coppia.partner.cod}</span>
              <span className={`ml-1.5 ${TONO_TRASFERTE[giudizio(ab.coppia.t).tono]}`}>{ab.coppia.t}</span>
            </>
          }
          hint={`${giudizio(ab.coppia.t).label}: giocano entrambi in trasferta ${ab.coppia.t} volte su 38`}
        />
      ) : (
        <p className="text-[11px] text-ink-400">Nessun compagno di reparto ancora libero.</p>
      )}

      {ab?.terzetto && (
        <Riga
          label="Terzetto migliore"
          value={
            <>
              {ab.terzetto.altri.map((x) => x.nome).join(' + ')}
              <span className={`ml-1.5 ${TONO_TRASFERTE[ab.terzetto.tot <= 19 ? 'ottimo' : ab.terzetto.tot <= 26 ? 'buono' : 'medio']}`}>
                {ab.terzetto.tot}
              </span>
            </>
          }
          hint={`Con ${p.nome}: ${ab.terzetto.altri.map((x) => x.cod).join(' + ')} · coppie ${ab.terzetto.t.join(' + ')} = ${ab.terzetto.tot} (19 e il minimo possibile)`}
        />
      )}

      {p.abb && (
        <Riga
          label="Dal listone"
          value={
            <>
              {p.abb}
              <span className={`ml-1.5 ${TONO_TRASFERTE[giudizio(p.abbTras).tono]}`}>{int(p.abbTras)}</span>
            </>
          }
          hint="abbinamento fisso calcolato nel workbook, anche se nel frattempo e stato comprato"
        />
      )}

      {inRosa.length > 0 && (
        <div className="mt-1.5 border-t border-ink-800 pt-1.5">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-500">
            Con i tuoi {p.r} gia in rosa
          </div>
          {inRosa.map((x) => {
            const t = trasferteComuni(p.squadra, x.player.squadra)
            return (
              <Riga
                key={x.playerId}
                label={x.player.nome}
                value={<span className={TONO_TRASFERTE[giudizio(t).tono]}>{t}</span>}
                hint={giudizio(t).label}
              />
            )
          })}
        </div>
      )}
    </>
  )
}

function Blocco({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-ink-800 bg-ink-850/50 px-2.5 py-2">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">{titolo}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function Riga({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="shrink-0 text-ink-400">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold text-ink-100" title={hint}>
        {value}
        {hint && <span className="ml-1 font-normal text-ink-500">ⓘ</span>}
      </span>
    </div>
  )
}
