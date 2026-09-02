import type { Fascia, Player } from '../types'
import { FASCIA_SHORT } from '../types'

/**
 * Marcatori compatti per i dati del listone.
 *
 * Una o due lettere per non allargare le righe della lista: il testo completo
 * sta nel title, e la legenda e in fondo alla vista Asta.
 */

/** Colori delle sei fasce: dal verde del Top al grigio della Scommessa. */
export const FASCIA_COLOR: Record<Fascia, string> = {
  Top: 'border-emerald-400/60 bg-emerald-400/20 text-emerald-300',
  '1a fascia': 'border-sky-400/60 bg-sky-400/20 text-sky-300',
  '2a fascia': 'border-indigo-400/50 bg-indigo-400/15 text-indigo-300',
  '3a fascia': 'border-ink-600 bg-ink-800 text-ink-300',
  '4a fascia': 'border-ink-700 bg-ink-850 text-ink-400',
  Scommessa: 'border-violet-400/40 bg-violet-400/10 text-violet-300',
}

export function FasciaBadge({ fascia, full = false }: { fascia: Fascia; full?: boolean }) {
  return (
    <span
      title={`Fascia: ${fascia}`}
      className={`inline-flex items-center justify-center rounded border px-1 py-px text-[10px] font-bold leading-4 ${FASCIA_COLOR[fascia]}`}
    >
      {full ? fascia : FASCIA_SHORT[fascia]}
    </span>
  )
}

/** Gravita della nota di infortunio, per colorare l'avviso. */
export function tonoInfortunio(p: Player): 'grave' | 'medio' | 'lieve' | null {
  if (!p.inf) return null
  const testo = `${p.inf.stato} ${p.nota}`.toLowerCase()
  if (testo.includes('lungo stop')) return 'grave'
  if (testo.includes('settembre')) return 'medio'
  return 'lieve'
}

const INF_COLOR = {
  grave: 'border-rose-400/60 bg-rose-400/20 text-rose-300',
  medio: 'border-amber-400/60 bg-amber-400/20 text-amber-300',
  lieve: 'border-amber-400/30 bg-amber-400/10 text-amber-400/80',
} as const

export default function PlayerTags({ p, className = '' }: { p: Player; className?: string }) {
  const tags: { key: string; label: string; title: string; cls: string }[] = []

  const inf = tonoInfortunio(p)
  if (inf) {
    tags.push({
      key: 'inf',
      label: '!',
      title: [p.inf?.stato, p.inf?.dettaglio].filter(Boolean).join(' — '),
      cls: INF_COLOR[inf],
    })
  }

  if (p.rig) {
    tags.push({
      key: 'rig',
      label: `R${p.rig}`,
      title: p.rig === 1 ? 'Primo rigorista designato' : `${p.rig}a scelta dal dischetto`,
      cls:
        p.rig === 1
          ? 'border-amber-400/60 bg-amber-400/20 text-amber-300'
          : 'border-amber-400/30 bg-amber-400/10 text-amber-400/70',
    })
  }

  if (p.piaz) {
    tags.push({
      key: 'piaz',
      label: `P${p.piaz}`,
      title: p.piaz === 1 ? 'Primo tiratore da fermo' : `${p.piaz}a scelta sui calci piazzati`,
      cls: 'border-sky-400/50 bg-sky-400/15 text-sky-300',
    })
  }

  if (p.gerarchia === 'Titolare') {
    tags.push({
      key: 'tit',
      label: 'T',
      title: `Titolare stimato · ${p.nota}`,
      cls: 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300',
    })
  } else if (p.gerarchia === 'Ballottaggio') {
    tags.push({
      key: 'bal',
      label: 'B',
      title: `In ballottaggio · ${p.nota}`,
      cls: 'border-ink-600 bg-ink-800 text-ink-300',
    })
  }

  if (p.s26.gol) {
    tags.push({
      key: 'gol',
      label: String(p.s26.gol),
      title: `${p.s26.gol} gol nelle prime giornate 2026/27`,
      cls: 'border-rose-400/50 bg-rose-400/15 text-rose-300',
    })
  }

  if (p.nuovo) {
    tags.push({
      key: 'new',
      label: 'N',
      title: 'Nuovo: cambia squadra o arriva da fuori Serie A, nessuno storico italiano',
      cls: 'border-violet-400/40 bg-violet-400/10 text-violet-300',
    })
  }

  if (!tags.length) return null

  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 ${className}`}>
      {tags.map((t) => (
        <span
          key={t.key}
          title={t.title}
          className={`inline-flex h-4 min-w-4 items-center justify-center rounded border px-0.5 text-[9px] font-bold leading-none ${t.cls}`}
        >
          {t.label}
        </span>
      ))}
    </span>
  )
}

/** Legenda delle sigle, da mostrare una volta per vista. */
export function TagsLegend({ className = '' }: { className?: string }) {
  return (
    <span className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-ink-500 ${className}`}>
      <span>
        <b className="text-rose-300">!</b> infortunio
      </span>
      <span>
        <b className="text-amber-300">R1</b> rigorista
      </span>
      <span>
        <b className="text-sky-300">P1</b> piazzati
      </span>
      <span>
        <b className="text-emerald-300">T</b> titolare
      </span>
      <span>
        <b className="text-ink-300">B</b> ballottaggio
      </span>
      <span>
        <b className="text-violet-300">N</b> nuovo
      </span>
    </span>
  )
}
