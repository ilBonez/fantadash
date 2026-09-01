export const int = (n: number) => Math.round(n).toLocaleString('it-IT')

export const dec = (n: number, d = 1) =>
  Number.isFinite(n) ? n.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-'

/** Percentuale senza segno: quote, share, avanzamento. */
export const pct = (n: number, d = 0) =>
  Number.isFinite(n) ? `${(n * 100).toLocaleString('it-IT', { maximumFractionDigits: d })}%` : '-'

/** Percentuale con segno esplicito: scostamenti rispetto a un riferimento. */
export const pctSigned = (n: number, d = 0) =>
  Number.isFinite(n) ? `${n > 0 ? '+' : ''}${(n * 100).toLocaleString('it-IT', { maximumFractionDigits: d })}%` : '-'

export const signed = (n: number) => `${n > 0 ? '+' : ''}${int(n)}`

export const time = (ts: number) =>
  new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Normalizza per la ricerca: minuscolo, senza accenti e punteggiatura. */
export const norm = (s: string) =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
