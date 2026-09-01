import { useMemo } from 'react'
import { useAuction } from '../store/useAuction'
import { adviceMap, makePrezzoAtteso, type Advice, type PrezzoAtteso } from './advice'
import { hasTitolari, players } from './listone'
import {
  buildMarket,
  calibra,
  CERCATI_PER_SQUADRA,
  SOGLIA_TOP,
  type Market,
  type MarketConfig,
} from './market'
import { enrich, leagueStats, type EnrichedPick, type LeagueStats, type TeamStats } from './stats'
import { ROLES, type Player, type Role } from '../types'

export interface League extends LeagueStats {
  enriched: EnrichedPick[]
  pickByPlayer: Map<number, EnrichedPick>
  takenIds: Set<number>
  targetIds: Set<number>
  /** Giocatori ancora liberi. */
  available: Player[]
  /** La squadra marcata come propria, se impostata. */
  myTeam: TeamStats | undefined
  /** Listino d'asta ricalcolato sullo stato attuale dell'asta. */
  market: Market
  /** Prezzo oltre il quale un giocatore e di fascia alta. */
  sogliaTop: number
  /** Prezzo atteso: override a mano, poi prezzo curato, poi listino dinamico. */
  prezzo: PrezzoAtteso
  /** Punteggio consigliato per ogni giocatore libero. */
  advice: Map<number, Advice>
}

/** Tutti i dati derivati dell'asta, ricalcolati solo quando cambia lo stato rilevante. */
export function useLeague(): League {
  const settings = useAuction((s) => s.settings)
  const teams = useAuction((s) => s.teams)
  const picks = useAuction((s) => s.picks)
  const myTeamId = useAuction((s) => s.myTeamId)
  const targets = useAuction((s) => s.targetIds)
  const overrides = useAuction((s) => s.priceOverrides)

  return useMemo(() => {
    const enriched = enrich(picks, teams, settings.mode)
    const stats = leagueStats(settings, teams, picks, players)
    const takenIds = new Set(enriched.map((p) => p.playerId))
    const available = players.filter((p) => !takenIds.has(p.id))
    const myTeam = stats.teams.find((t) => t.team.id === myTeamId)
    const sogliaTop = Math.max(2, Math.round(settings.budget * SOGLIA_TOP))

    const slotIniziali = {} as Record<Role, number>
    const slotResidui = {} as Record<Role, number>
    const cercatiFascia = {} as Record<Role, number>
    const tettoFascia = {} as Record<Role, number>

    for (const r of ROLES) {
      slotIniziali[r] = teams.length * settings.slots[r]
      slotResidui[r] = stats.teams.reduce((n, t) => n + t.byRole[r].left, 0)
      // Domanda di fascia alta: quanti top cerca ancora ogni squadra, al netto
      // di quelli che ha gia in rosa e limitato dagli slot che le restano.
      cercatiFascia[r] = stats.teams.reduce((n, t) => {
        const gia = t.picks.filter((p) => p.player.r === r && p.price >= sogliaTop).length
        return n + Math.min(t.byRole[r].left, Math.max(0, CERCATI_PER_SQUADRA[r] - gia))
      }, 0)
      // Il prezzo non puo superare l'offerta massima di chi cerca ancora.
      tettoFascia[r] = stats.teams.reduce(
        (max, t) => (t.byRole[r].left > 0 ? Math.max(max, t.maxBid) : max),
        0,
      )
    }

    const cfg: MarketConfig = {
      budgetSquadra: settings.budget,
      squadre: Math.max(1, teams.length),
      temperatura: settings.temperatura ?? 'normale',
      slotIniziali,
      creditiIniziali: stats.creditiTotali,
      slotResidui,
      creditiResidui: Math.max(0, stats.residui),
      cercatiFascia,
      tettoFascia,
    }

    const cal = calibra(players, settings.mode, cfg)
    const market = buildMarket(available, settings.mode, cfg, cal)
    const prezzo = makePrezzoAtteso(market, overrides)

    return {
      ...stats,
      enriched,
      pickByPlayer: new Map(enriched.map((p) => [p.playerId, p])),
      takenIds,
      targetIds: new Set(targets),
      available,
      myTeam,
      market,
      sogliaTop,
      prezzo,
      advice: adviceMap(available, settings.mode, prezzo, myTeam, hasTitolari),
    }
  }, [settings, teams, picks, myTeamId, targets, overrides])
}
