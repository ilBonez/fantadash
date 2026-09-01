import raw from '../data/listone.json'
import type { Listone, Mode, Player, Role } from '../types'
import { norm } from './format'

export const listone = raw as unknown as Listone

/** Solo giocatori attualmente in Serie A (esclude il foglio "Ceduti"). */
export const players: Player[] = listone.giocatori.filter((p) => !p.ceduto)

export const playersById = new Map<number, Player>(listone.giocatori.map((p) => [p.id, p]))

export const teamsSerieA: string[] = [...new Set(players.map((p) => p.squadra))].sort((a, b) =>
  a.localeCompare(b, 'it'),
)

export const mantraRoles: string[] = [...new Set(players.flatMap((p) => p.rm))].sort()

/** true se l'overlay curato ha davvero i titolari: senza dati non si penalizza nessuno. */
export const hasTitolari: boolean = players.some((p) => p.titolare === true)

/** Note per squadra dall'overlay: ballottaggi e gerarchie incerte. */
export const noteSquadre: Record<string, string> = listone.noteSquadre ?? {}

/** Chiave di ricerca precalcolata: nome + squadra. */
const searchKey = new Map<number, string>(players.map((p) => [p.id, norm(`${p.nome} ${p.squadra}`)]))

/** Quotazione attuale nella modalita scelta. */
export const quot = (p: Player, mode: Mode) => (mode === 'classic' ? p.qtA : p.qtAM)

/** Fanta Valore di Mercato nella modalita scelta. */
export const fvm = (p: Player, mode: Mode) => (mode === 'classic' ? p.fvm : p.fvmM)

export const roleLabelOf = (p: Player, mode: Mode) => (mode === 'classic' ? p.r : p.rm.join('/') || p.r)

export interface SearchFilters {
  q: string
  role: Role | 'ALL'
  squadra: string | 'ALL'
  mantraRole: string | 'ALL'
  soloDisponibili: boolean
  /** Solo i giocatori marcati come obiettivi. */
  soloObiettivi: boolean
  /** Solo i reparti in cui la tua squadra ha ancora slot liberi. */
  soloUtili: boolean
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
    if (filters.mantraRole !== 'ALL' && !p.rm.includes(filters.mantraRole)) continue
    if (filters.soloDisponibili && ctx.takenIds.has(p.id)) continue
    if (filters.soloObiettivi && !ctx.targetIds.has(p.id)) continue
    if (filters.soloUtili && !ctx.neededRoles.has(p.r)) continue
    const score = matchScore(p, tokens)
    if (score === null) continue
    out.push({ p, score })
  }

  if (tokens.length) out.sort((a, b) => a.score - b.score || b.p.qtA - a.p.qtA)
  return out.map((x) => x.p)
}
