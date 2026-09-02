import raw from '../data/listone.json'
import type { Fascia, Listone, Player, Role } from '../types'
import { norm } from './format'

export const listone = raw as unknown as Listone

export const players: Player[] = listone.giocatori

export const playersById = new Map<number, Player>(players.map((p) => [p.id, p]))

export const teamsSerieA: string[] = listone.squadre

export const sigle: Record<string, string> = listone.sigle

/** Ruoli Mantra distinti, per il filtro a tendina. */
export const mantraRoles: string[] = [...new Set(players.map((p) => p.rm).filter(Boolean))].sort((a, b) =>
  a.localeCompare(b, 'it'),
)

export const fasce: Fascia[] = listone.fasce

/**
 * Trasferte in comune fra due squadre, su 38 giornate. Piu basso = si coprono
 * meglio a vicenda, perche non capita quasi mai che siano fuori casa insieme.
 */
export function trasferteComuni(a: string, b: string): number {
  if (a === b) return 19
  return listone.matrice[a]?.[b] ?? listone.matrice[b]?.[a] ?? 19
}

/** Indice di priorita massimo del reparto: normalizza i confronti di qualita. */
export const indiceMax: Record<Role, number> = (['P', 'D', 'C', 'A'] as Role[]).reduce(
  (acc, r) => {
    acc[r] = Math.max(1, ...players.filter((p) => p.r === r).map((p) => p.indice))
    return acc
  },
  {} as Record<Role, number>,
)

/** Quotazione: il workbook e solo Classic, quindi non c'e piu una modalita. */
export const quot = (p: Player) => p.qtA
export const fvm = (p: Player) => p.fvm

/** Chiave di ricerca precalcolata: nome + squadra + sigla. */
const searchKey = new Map<number, string>(
  players.map((p) => [p.id, norm(`${p.nome} ${p.squadra} ${p.cod}`)]),
)

export interface SearchFilters {
  q: string
  role: Role | 'ALL'
  squadra: string | 'ALL'
  fascia: Fascia | 'ALL'
  soloDisponibili: boolean
  /** Solo i giocatori marcati come obiettivi. */
  soloObiettivi: boolean
  /** Solo i reparti in cui la tua squadra ha ancora slot liberi. */
  soloUtili: boolean
  /** Nasconde chi ha una nota di infortunio. */
  senzaInfortunati: boolean
  /** Solo chi il workbook da per titolare. */
  soloTitolari: boolean
}

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  role: 'ALL',
  squadra: 'ALL',
  fascia: 'ALL',
  soloDisponibili: true,
  soloObiettivi: false,
  soloUtili: false,
  senzaInfortunati: false,
  soloTitolari: false,
}

export interface SearchContext {
  takenIds: Set<number>
  targetIds: Set<number>
  /** Ruoli in cui la squadra di riferimento ha ancora slot da riempire. */
  neededRoles: Set<Role>
}

/**
 * Ricerca con match a prefisso su ogni token digitato: "vla juve" trova
 * "Vlahovic (Juventus)". Ritorna un punteggio, piu basso = piu pertinente.
 */
export function matchScore(p: Player, tokens: string[]): number | null {
  if (!tokens.length) return 0
  const key = searchKey.get(p.id)
  if (!key) return null
  let score = 0
  for (const t of tokens) {
    const i = key.indexOf(t)
    if (i < 0) return null
    // Match a inizio parola pesa meno (= piu rilevante).
    const atBoundary = i === 0 || key[i - 1] === ' '
    score += atBoundary ? i : i + 100
  }
  return score
}

export function searchPlayers(filters: SearchFilters, ctx: SearchContext): Player[] {
  const tokens = norm(filters.q).split(' ').filter(Boolean)
  const out: { p: Player; score: number }[] = []

  for (const p of players) {
    if (filters.role !== 'ALL' && p.r !== filters.role) continue
    if (filters.squadra !== 'ALL' && p.squadra !== filters.squadra) continue
    if (filters.fascia !== 'ALL' && p.fascia !== filters.fascia) continue
    if (filters.soloDisponibili && ctx.takenIds.has(p.id)) continue
    if (filters.soloObiettivi && !ctx.targetIds.has(p.id)) continue
    if (filters.soloUtili && !ctx.neededRoles.has(p.r)) continue
    if (filters.senzaInfortunati && p.inf) continue
    if (filters.soloTitolari && p.gerarchia !== 'Titolare') continue
    const score = matchScore(p, tokens)
    if (score === null) continue
    out.push({ p, score })
  }

  if (tokens.length) out.sort((a, b) => a.score - b.score || b.p.indice - a.p.indice)
  return out.map((x) => x.p)
}
