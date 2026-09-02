import type { Pick, Player, Role, Settings, Team } from '../types'
import { ROLES } from '../types'
import { fvm, playersById, quot } from './listone'

export interface EnrichedPick extends Pick {
  player: Player
  team: Team
  /** Quotazione attuale dal listone. */
  quot: number
  fvm: number
  /** prezzo - quotazione. */
  delta: number
  /** delta in percentuale sulla quotazione. */
  deltaPct: number
  /** FVM ottenuto per credito speso: piu alto = piu valore. */
  valueIdx: number
}

export interface RoleSlot {
  filled: number
  need: number
  left: number
  spent: number
}

export interface TeamStats {
  team: Team
  budget: number
  spent: number
  remaining: number
  picks: EnrichedPick[]
  byRole: Record<Role, RoleSlot>
  slotsTotal: number
  slotsFilled: number
  slotsLeft: number
  /** Offerta massima sostenibile lasciando 1 credito per ogni slot residuo. */
  maxBid: number
  totalQuot: number
  totalFvm: number
  /** spent - totalQuot: quanto sopra/sotto quotazione ha speso. */
  deltaCredits: number
  /** spent / totalQuot. */
  priceRatio: number
  complete: boolean
}

export interface LeagueStats {
  teams: TeamStats[]
  creditiTotali: number
  spesi: number
  residui: number
  /** Crediti spesi / somma quotazioni dei giocatori assegnati. */
  inflazione: number
  giocatoriAssegnati: number
  slotTotali: number
  avanzamento: number
  prezzoMedioRuolo: Record<Role, { medio: number; max: number; count: number }>
  /** Giocatori piu costosi dell'asta. */
  topAcquisti: EnrichedPick[]
  /** Pagati meno della quotazione. */
  affari: EnrichedPick[]
  /** Pagati molto sopra quotazione. */
  sovrapagati: EnrichedPick[]
  /** Quotazione bassa ma prezzo alto: scommesse vere. */
  scommesse: EnrichedPick[]
  /** Miglior FVM per credito. */
  miglioriValori: EnrichedPick[]
  /** Big rimasti sul mercato, per quotazione. */
  bigDisponibili: Player[]
}

const budgetOf = (t: Team, s: Settings) => t.budgetOverride ?? s.budget

export function enrich(picks: Pick[], teams: Team[]): EnrichedPick[] {
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const out: EnrichedPick[] = []
  for (const pick of picks) {
    const player = playersById.get(pick.playerId)
    const team = teamById.get(pick.teamId)
    if (!player || !team) continue
    const q = quot(player)
    const f = fvm(player)
    const delta = pick.price - q
    out.push({
      ...pick,
      player,
      team,
      quot: q,
      fvm: f,
      delta,
      deltaPct: q > 0 ? delta / q : Infinity,
      valueIdx: pick.price > 0 ? f / pick.price : Infinity,
    })
  }
  return out
}

export function teamStats(team: Team, all: EnrichedPick[], s: Settings): TeamStats {
  const picks = all.filter((p) => p.teamId === team.id).sort((a, b) => b.price - a.price)
  const budget = budgetOf(team, s)
  const spent = picks.reduce((n, p) => n + p.price, 0)

  const byRole = {} as Record<Role, RoleSlot>
  for (const r of ROLES) {
    const rp = picks.filter((p) => p.player.r === r)
    const need = s.slots[r]
    byRole[r] = {
      filled: rp.length,
      need,
      left: Math.max(0, need - rp.length),
      spent: rp.reduce((n, p) => n + p.price, 0),
    }
  }

  const slotsTotal = ROLES.reduce((n, r) => n + s.slots[r], 0)
  const slotsFilled = picks.length
  const slotsLeft = ROLES.reduce((n, r) => n + byRole[r].left, 0)
  const remaining = budget - spent
  const totalQuot = picks.reduce((n, p) => n + p.quot, 0)

  return {
    team,
    budget,
    spent,
    remaining,
    picks,
    byRole,
    slotsTotal,
    slotsFilled,
    slotsLeft,
    maxBid: slotsLeft > 0 ? Math.max(0, remaining - (slotsLeft - 1)) : 0,
    totalQuot,
    totalFvm: picks.reduce((n, p) => n + p.fvm, 0),
    deltaCredits: spent - totalQuot,
    priceRatio: totalQuot > 0 ? spent / totalQuot : NaN,
    complete: slotsLeft === 0,
  }
}

export function leagueStats(
  settings: Settings,
  teams: Team[],
  picks: Pick[],
  availablePlayers: Player[],
): LeagueStats {
  const all = enrich(picks, teams)
  const stats = teams.map((t) => teamStats(t, all, settings))

  const creditiTotali = teams.reduce((n, t) => n + budgetOf(t, settings), 0)
  const spesi = all.reduce((n, p) => n + p.price, 0)
  const quotTotali = all.reduce((n, p) => n + p.quot, 0)
  const slotTotali = teams.length * ROLES.reduce((n, r) => n + settings.slots[r], 0)

  const prezzoMedioRuolo = {} as LeagueStats['prezzoMedioRuolo']
  for (const r of ROLES) {
    const rp = all.filter((p) => p.player.r === r)
    prezzoMedioRuolo[r] = {
      medio: rp.length ? rp.reduce((n, p) => n + p.price, 0) / rp.length : 0,
      max: rp.length ? Math.max(...rp.map((p) => p.price)) : 0,
      count: rp.length,
    }
  }

  const byDeltaPct = [...all].sort((a, b) => a.deltaPct - b.deltaPct)

  return {
    teams: stats,
    creditiTotali,
    spesi,
    residui: creditiTotali - spesi,
    inflazione: quotTotali > 0 ? spesi / quotTotali : NaN,
    giocatoriAssegnati: all.length,
    slotTotali,
    avanzamento: slotTotali > 0 ? all.length / slotTotali : 0,
    prezzoMedioRuolo,
    topAcquisti: [...all].sort((a, b) => b.price - a.price).slice(0, 12),
    // Affari: sotto quotazione, ignorando i giocatori da 1-2 crediti (rumore).
    affari: byDeltaPct.filter((p) => p.delta < 0 && p.quot >= 5).slice(0, 12),
    sovrapagati: [...byDeltaPct].reverse().filter((p) => p.delta > 0 && p.quot >= 5).slice(0, 12),
    // Scommesse: quotazione bassa pagata almeno il triplo e almeno 6 crediti.
    scommesse: all
      .filter((p) => p.quot <= 8 && p.price >= 6 && p.price >= p.quot * 3)
      .sort((a, b) => b.deltaPct - a.deltaPct)
      .slice(0, 12),
    miglioriValori: all
      .filter((p) => p.price >= 3 && Number.isFinite(p.valueIdx))
      .sort((a, b) => b.valueIdx - a.valueIdx)
      .slice(0, 12),
    bigDisponibili: availablePlayers
      .filter((p) => !all.some((a) => a.playerId === p.id))
      .sort((a, b) => quot(b) - quot(a))
      .slice(0, 20),
  }
}
