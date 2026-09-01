import { useMemo } from 'react'
import type { Advice } from '../lib/advice'
import { dec, int, signed } from '../lib/format'
import { fvm, noteSquadre, quot, roleLabelOf } from '../lib/listone'
import type { EnrichedPick } from '../lib/stats'
import type { Mode, Player } from '../types'
import PlayerTags from './PlayerTags'
import { RoleBadge } from './ui'

export type SortKey = 'consiglio' | 'quot' | 'atteso' | 'fvm' | 'valore' | 'nome' | 'squadra' | 'prezzo'

interface Props {
  rows: Player[]
  mode: Mode
  pickByPlayer: Map<number, EnrichedPick>
  advice: Map<number, Advice>
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
  { key: 'squadra', label: 'Squadra', className: 'text-left' },
  { key: 'quot', label: 'Qt.A', className: 'text-right', title: 'Quotazione attuale' },
  { key: 'atteso', label: 'Asta', className: 'text-right', title: 'Prezzo a cui il giocatore finira davvero: listino d asta modellato sul budget della lega, non la quotazione' },
  { key: 'fvm', label: 'FVM', className: 'text-right', title: 'Fanta Valore di Mercato' },
  { key: 'valore', label: 'FVM/cr', className: 'text-right', title: 'FVM per credito di prezzo d asta: e qui che si vede se un top conviene' },
  { key: 'consiglio', label: 'Score', className: 'text-right', title: 'Quanto conviene a te adesso: qualita nel reparto, resa per credito, slot che ti servono e budget sostenibile' },
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
  mode,
  pickByPlayer,
  advice,
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
        case 'fvm':
          return fvm(p, mode)
        case 'atteso':
          return advice.get(p.id)?.expPrice ?? quot(p, mode)
        case 'valore':
          return advice.get(p.id)?.value ?? 0
        case 'consiglio':
          // I giocatori gia presi non hanno consiglio: restano in fondo.
          return advice.get(p.id)?.score ?? -1
        case 'prezzo':
          return pickByPlayer.get(p.id)?.price ?? -1
        default:
          return quot(p, mode)
      }
    }
    return [...rows].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb), 'it') * dir
      }
      return (va - vb) * dir || fvm(b, mode) - fvm(a, mode)
    })
  }, [rows, sort, mode, pickByPlayer, advice, searching])

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
            const isTarget = targetIds.has(p.id)
            const q = quot(p, mode)
            const f = fvm(p, mode)
            const isSel = p.id === selectedId
            const isHi = i === highlightIndex
            const storico =
              p.fm2025 != null
                ? `2025/26: fantamedia ${p.fm2025}${p.gol2025 != null ? `, ${p.gol2025} gol` : ''}`
                : undefined
            const tooltip = [p.nota, storico].filter(Boolean).join(' — ') || undefined
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                data-row={i}
                title={tooltip}
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
                  <RoleBadge role={p.r} text={mode === 'mantra' ? roleLabelOf(p, mode) : p.r} />
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
                <td className="max-w-64 px-2 py-1 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate">
                      {pick ? <span className="line-through decoration-ink-600">{p.nome}</span> : p.nome}
                    </span>
                    <PlayerTags p={p} />
                  </span>
                </td>
                <td className="px-2 py-1 text-ink-300" title={noteSquadre[p.squadra]}>
                  {p.squadra}
                  {noteSquadre[p.squadra] && <span className="ml-1 text-amber-500/70">*</span>}
                </td>
                <td className="px-2 py-1 text-right font-semibold">{int(q)}</td>
                <td
                  className={`px-2 py-1 text-right ${
                    a?.fontePrezzo === 'override'
                      ? 'font-semibold text-sky-300'
                      : a?.fontePrezzo === 'mercato'
                        ? 'font-semibold text-amber-300'
                        : 'text-ink-300'
                  }`}
                  title={
                    a?.fontePrezzo === 'override'
                      ? 'Prezzo corretto a mano'
                      : a?.fontePrezzo === 'mercato'
                        ? 'Prezzo di mercato da data/extra.json'
                        : undefined
                  }
                >
                  {a ? int(a.expPrice) : '-'}
                </td>
                <td className="px-2 py-1 text-right text-ink-300">{int(f)}</td>
                <td className="px-2 py-1 text-right text-ink-400">{a ? dec(a.value) : '-'}</td>
                <td className="px-2 py-1 text-right" title={a?.motivi.join(' · ')}>
                  {a ? <span className={`font-semibold ${scoreColor(a)}`}>{a.score}</span> : <span className="text-ink-700">-</span>}
                </td>
                <td className="px-2 py-1 text-right">
                  {pick ? (
                    <span className="font-semibold text-ink-100">
                      {int(pick.price)}
                      <span
                        className={`ml-1 text-[11px] font-normal ${
                          pick.delta > 0 ? 'text-rose-400' : pick.delta < 0 ? 'text-emerald-400' : 'text-ink-400'
                        }`}
                      >
                        {signed(pick.delta)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-600">-</span>
                  )}
                </td>
                <td className="max-w-32 truncate px-2 py-1 text-xs text-ink-300">{pick?.team.nome ?? ''}</td>
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
              <td colSpan={12} className="px-3 py-8 text-center text-sm text-ink-400">
                Nessun giocatore trovato con questi filtri.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
