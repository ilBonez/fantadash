import { useMemo } from 'react'
import type { Abbinamento } from '../lib/abbinamenti'
import { giudizio } from '../lib/abbinamenti'
import type { Advice } from '../lib/advice'
import { int } from '../lib/format'
import type { EnrichedPick } from '../lib/stats'
import type { Player } from '../types'
import PlayerTags, { FasciaBadge } from './PlayerTags'
import { RoleBadge, TONO_TRASFERTE } from './ui'

export type SortKey =
  | 'consiglio'
  | 'prio'
  | 'quot'
  | 'cons'
  | 'atteso'
  | 'fvm'
  | 'fascia'
  | 'nome'
  | 'squadra'
  | 'abbinamento'
  | 'prezzo'

interface Props {
  rows: Player[]
  pickByPlayer: Map<number, EnrichedPick>
  advice: Map<number, Advice>
  abbinamenti: Map<number, Abbinamento>
  targetIds: Set<number>
  selectedId: number | null
  highlightIndex: number
  sort: { key: SortKey; desc: boolean }
  onSort: (key: SortKey) => void
  onSelect: (p: Player) => void
  onUnassign: (playerId: number) => void
  onToggleTarget: (playerId: number) => void
  /** true se la ricerca testuale e attiva: in quel caso non riordiniamo. */
  searching: boolean
}

const HEAD: { key: SortKey; label: string; className: string; title?: string }[] = [
  { key: 'nome', label: 'Giocatore', className: 'text-left' },
  { key: 'squadra', label: 'Sq', className: 'text-left' },
  { key: 'fascia', label: 'Fascia', className: 'text-left', title: 'Fascia del listone: da Top a Scommessa' },
  { key: 'prio', label: 'Prio', className: 'text-right', title: 'Priorita nel reparto secondo l indice del listone' },
  { key: 'quot', label: 'Qt.A', className: 'text-right', title: 'Quotazione attuale Classic' },
  { key: 'cons', label: 'Cons', className: 'text-right', title: 'Prezzo consigliato dal listone (e prezzo max nel tooltip)' },
  { key: 'atteso', label: 'Asta', className: 'text-right', title: 'Prezzo a cui il giocatore finira davvero: listino d asta modellato sul budget della lega, non la quotazione' },
  { key: 'fvm', label: 'FVM', className: 'text-right', title: 'Fanta Valore di Mercato' },
  { key: 'consiglio', label: 'Score', className: 'text-right', title: 'Quanto conviene a te adesso: qualita nel reparto, resa per credito, slot che ti servono e budget sostenibile' },
  { key: 'abbinamento', label: 'Abbinamento', className: 'text-left', title: 'Con chi accoppiarlo fra i giocatori ancora liberi: coppia e terzetto che si coprono meglio sul calendario' },
  { key: 'prezzo', label: 'Pagato', className: 'text-right' },
]

const scoreColor = (a: Advice) => {
  if (!a.needed) return 'text-ink-600'
  if (!a.affordable) return 'text-amber-500/80'
  if (a.score >= 70) return 'text-emerald-400'
  if (a.score >= 45) return 'text-sky-300'
  return 'text-ink-400'
}

export default function PlayerTable({
  rows,
  pickByPlayer,
  advice,
  abbinamenti,
  targetIds,
  selectedId,
  highlightIndex,
  sort,
  onSort,
  onSelect,
  onUnassign,
  onToggleTarget,
  searching,
}: Props) {
  const sorted = useMemo(() => {
    if (searching) return rows
    const dir = sort.desc ? -1 : 1
    const val = (p: Player): number | string => {
      switch (sort.key) {
        case 'nome':
          return p.nome
        case 'squadra':
          return p.squadra
        case 'fascia':
          // Le fasce alte hanno indice basso: si invertono per ordinarle come i numeri.
          return -p.fasciaIdx
        case 'prio':
          return -p.prio
        case 'fvm':
          return p.fvm
        case 'cons':
          return p.cons
        case 'atteso':
          return advice.get(p.id)?.expPrice ?? p.qtA
        case 'abbinamento':
          // Meno trasferte in comune = abbinamento migliore, quindi va in cima.
          return -(abbinamenti.get(p.id)?.coppia?.t ?? 99)
        case 'consiglio':
          // I giocatori gia presi non hanno consiglio: restano in fondo.
          return advice.get(p.id)?.score ?? -1
        case 'prezzo':
          return pickByPlayer.get(p.id)?.price ?? -1
        default:
          return p.qtA
      }
    }
    return [...rows].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb), 'it') * dir
      }
      return (va - vb) * dir || b.indice - a.indice
    })
  }, [rows, sort, pickByPlayer, advice, abbinamenti, searching])

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="border-b border-ink-700 bg-ink-850 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              R
            </th>
            <th className="w-6 border-b border-ink-700 bg-ink-850" title="Obiettivo" />
            {HEAD.map((h) => (
              <th
                key={h.key}
                title={h.title}
                onClick={() => onSort(h.key)}
                className={`cursor-pointer select-none border-b border-ink-700 bg-ink-850 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 hover:text-ink-100 ${h.className}`}
              >
                {h.label}
                {!searching && sort.key === h.key && (
                  <span className="ml-1 text-sky-400">{sort.desc ? '▾' : '▴'}</span>
                )}
              </th>
            ))}
            <th className="border-b border-ink-700 bg-ink-850 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              Preso da
            </th>
            <th className="w-8 border-b border-ink-700 bg-ink-850" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => {
            const pick = pickByPlayer.get(p.id)
            const a = advice.get(p.id)
            const ab = abbinamenti.get(p.id)
            const isTarget = targetIds.has(p.id)
            const isSel = p.id === selectedId
            const isHi = i === highlightIndex
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                data-row={i}
                title={[p.nota, p.inf?.dettaglio].filter(Boolean).join(' — ')}
                className={`cursor-pointer border-b border-ink-800/70 ${
                  isSel
                    ? 'bg-sky-500/15'
                    : isHi
                      ? 'bg-ink-800'
                      : pick
                        ? 'bg-ink-900/40 text-ink-400'
                        : isTarget
                          ? 'bg-amber-400/5 hover:bg-ink-850'
                          : 'hover:bg-ink-850'
                }`}
              >
                <td className="px-2 py-1">
                  <RoleBadge role={p.r} />
                </td>
                <td className="px-0 py-1 text-center">
                  <button
                    title={isTarget ? 'Togli dagli obiettivi' : 'Segna come obiettivo'}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleTarget(p.id)
                    }}
                    className={`px-1 text-sm leading-none ${
                      isTarget ? 'text-amber-400' : 'text-ink-700 hover:text-ink-400'
                    }`}
                  >
                    &#9733;
                  </button>
                </td>
                <td className="max-w-56 px-2 py-1 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate">
                      {pick ? <span className="line-through decoration-ink-600">{p.nome}</span> : p.nome}
                    </span>
                    <PlayerTags p={p} />
                  </span>
                </td>
                <td className="px-2 py-1 font-mono text-[11px] text-ink-300" title={p.squadra}>
                  {p.cod}
                </td>
                <td className="px-2 py-1">
                  <FasciaBadge fascia={p.fascia} />
                </td>
                <td className="px-2 py-1 text-right text-ink-400" title={`Indice di priorita ${p.indice}`}>
                  {int(p.prio)}
                </td>
                <td className="px-2 py-1 text-right font-semibold">{int(p.qtA)}</td>
                <td className="px-2 py-1 text-right text-ink-300" title={`Prezzo max consigliato: ${p.max}`}>
                  {int(p.cons)}
                  <span className="ml-1 text-[10px] text-ink-500">/{int(p.max)}</span>
                </td>
                <td
                  className={`px-2 py-1 text-right ${
                    a?.fontePrezzo === 'override'
                      ? 'font-semibold text-sky-300'
                      : a?.sopraMax
                        ? 'font-semibold text-amber-300'
                        : 'text-ink-300'
                  }`}
                  title={
                    a?.fontePrezzo === 'override'
                      ? 'Prezzo corretto a mano'
                      : a?.sopraMax
                        ? `Il listino d asta lo porta oltre il prezzo max del listone (${p.max})`
                        : undefined
                  }
                >
                  {a ? int(a.expPrice) : '-'}
                </td>
                <td className="px-2 py-1 text-right text-ink-300">{int(p.fvm)}</td>
                <td className="px-2 py-1 text-right" title={a?.motivi.join(' · ')}>
                  {a ? (
                    <span className={`font-semibold ${scoreColor(a)}`}>{a.score}</span>
                  ) : (
                    <span className="text-ink-700">-</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  <AbbinamentoCell ab={ab} />
                </td>
                <td className="px-2 py-1 text-right">
                  {pick ? (
                    <span className="font-semibold text-ink-100">
                      {int(pick.price)}
                      <span
                        className={`ml-1 text-[11px] font-normal ${
                          pick.price > p.max
                            ? 'text-rose-400'
                            : pick.price <= p.cons
                              ? 'text-emerald-400'
                              : 'text-ink-400'
                        }`}
                        title={`Consigliato ${p.cons}, max ${p.max}`}
                      >
                        {pick.price > p.max ? '↑' : pick.price <= p.cons ? '↓' : '='}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-600">-</span>
                  )}
                </td>
                <td className="max-w-28 truncate px-2 py-1 text-xs text-ink-300">{pick?.team.nome ?? ''}</td>
                <td className="px-1 py-1 text-right">
                  {pick && (
                    <button
                      title="Annulla assegnazione"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnassign(p.id)
                      }}
                      className="rounded px-1 text-ink-400 hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      &times;
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
          {!sorted.length && (
            <tr>
              <td colSpan={15} className="px-3 py-8 text-center text-sm text-ink-400">
                Nessun giocatore trovato con questi filtri.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Con chi accoppiarlo: sopra la coppia migliore, sotto il terzetto.
 *
 * Il numero e' quante volte su 38 giornate le squadre giocano ENTRAMBE in
 * trasferta: piu basso, meglio si coprono a vicenda quando si ruota.
 */
function AbbinamentoCell({ ab }: { ab: Abbinamento | undefined }) {
  if (!ab?.coppia) return <span className="text-ink-700">-</span>

  const { coppia, terzetto } = ab
  const g = giudizio(coppia.t)
  const terzo = terzetto?.altri.filter((p) => p.id !== coppia.partner.id) ?? []

  return (
    <div className="min-w-0 max-w-52 leading-tight">
      <div className="truncate text-xs" title={`Coppia consigliata: ${coppia.partner.nome} (${coppia.partner.squadra}) — ${coppia.t} trasferte in comune su 38 · ${g.label}`}>
        <span className="text-ink-200">{coppia.partner.nome}</span>
        <span className="ml-1 font-mono text-[10px] text-ink-500">{coppia.partner.cod}</span>
        <span className={`ml-1.5 text-[11px] font-semibold ${TONO_TRASFERTE[g.tono]}`}>{coppia.t}</span>
      </div>
      {terzetto && (
        <div
          className="truncate text-[11px] text-ink-500"
          title={`Terzetto: ${terzetto.altri.map((p) => `${p.nome} (${p.squadra})`).join(' + ')} — trasferte in comune ${terzetto.t.join(' + ')} = ${terzetto.tot}`}
        >
          +{' '}
          {terzo.length
            ? terzo.map((p) => `${p.nome} ${p.cod}`).join(', ')
            : terzetto.altri.map((p) => `${p.nome} ${p.cod}`).join(', ')}
          <span className="ml-1 text-ink-600">· {terzetto.tot}</span>
        </div>
      )}
    </div>
  )
}
