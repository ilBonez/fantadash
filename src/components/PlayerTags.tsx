import type { Player } from '../types'

/**
 * Marcatori compatti per i dati curati in data/extra.json.
 *
 * Una sigla di una lettera per non allargare le righe della lista: il testo
 * completo sta nel title, e la legenda e in fondo alla vista Asta.
 */
export default function PlayerTags({ p, className = '' }: { p: Player; className?: string }) {
  const tags: { key: string; label: string; title: string; cls: string }[] = []

  if (p.rigorista === 1) {
    tags.push({
      key: 'r1',
      label: 'R',
      title: 'Primo rigorista designato',
      cls: 'border-amber-400/60 bg-amber-400/20 text-amber-300',
    })
  } else if (p.rigorista === 2) {
    tags.push({
      key: 'r2',
      label: 'r',
      title: 'Alternativa dal dischetto',
      cls: 'border-amber-400/30 bg-amber-400/10 text-amber-400/70',
    })
  }

  if (p.titolare) {
    tags.push({
      key: 't',
      label: 'T',
      title: 'Titolare nella formazione tipo',
      cls: 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300',
    })
  }

  if (p.punizioni) {
    tags.push({
      key: 'p',
      label: 'P',
      title: 'Tira le punizioni',
      cls: 'border-sky-400/50 bg-sky-400/15 text-sky-300',
    })
  }

  if (p.angoli) {
    tags.push({
      key: 'c',
      label: 'C',
      title: 'Tira i calci d angolo',
      cls: 'border-violet-400/50 bg-violet-400/15 text-violet-300',
    })
  }

  if (p.gol) {
    tags.push({
      key: 'g',
      label: String(p.gol),
      title: `${p.gol} gol in campionato`,
      cls: 'border-rose-400/50 bg-rose-400/15 text-rose-300',
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
        <b className="text-amber-300">R</b> rigorista
      </span>
      <span>
        <b className="text-amber-400/70">r</b> alternativa
      </span>
      <span>
        <b className="text-emerald-300">T</b> titolare
      </span>
      <span>
        <b className="text-sky-300">P</b> punizioni
      </span>
      <span>
        <b className="text-violet-300">C</b> angoli
      </span>
      <span>
        <b className="text-rose-300">n</b> gol
      </span>
    </span>
  )
}
