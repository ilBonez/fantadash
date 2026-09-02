import { useMemo } from 'react'
import { useAuction } from '../store/useAuction'
import { abbinamentiPerRuolo, type Abbinamento } from './abbinamenti'
import { adviceMap, makePrezzoAtteso, type Advice, type PrezzoAtteso } from './advice'
import { players } from './listone'
import { buildMarket, SOGLIA_TOP, type Market, type MarketConfig } from './market'
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
  /** Prezzo atteso: override a mano, poi listino dinamico. */
  prezzo: PrezzoAtteso
  /** Punteggio consigliato per ogni giocatore libero. */
  advice: Map<number, Advice>
  /** Coppia e terzetto migliori fra i liberi, per ogni giocatore libero. */
  abbinamenti: Map<number, Abbinamento>
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
    const enriched = enrich(picks, teams)
    const stats = leagueStats(settings, teams, picks, players)
    const takenIds = new Set(enriched.map((p) => p.playerId))
    const available = players.filter((p) => !takenIds.has(p.id))
    const myTeam = stats.teams.find((t) => t.team.id === myTeamId)
    const sogliaTop = Math.max(2, Math.round(settings.budget * SOGLIA_TOP))

    const slotIniziali = {} as Record<Role, number>
    const slotResidui = {} as Record<Role, number>
    const tettoFascia = {} as Record<Role, number>

    for (const r of ROLES) {
      slotIniziali[r] = teams.length * settings.slots[r]
      slotResidui[r] = stats.teams.reduce((n, t) => n + t.byRole[r].left, 0)
      // Il prezzo non puo superare l'offerta massima di chi cerca ancora.
      tettoFascia[r] = stats.teams.reduce(
        (max, t) => (t.byRole[r].left > 0 ? Math.max(max, t.maxBid) : max),
        0,
      )
    }

    // La temperatura osservata: quanto la lega ha pagato rispetto ai prezzi
    // consigliati del listone. E' il segnale che a inizio asta conta di piu'.
    const consVenduti = enriched.reduce((n, p) => n + p.player.cons, 0)

    const cfg: MarketConfig = {
      budgetSquadra: settings.budget,
      squadre: Math.max(1, teams.length),
      temperatura: settings.temperatura ?? 'normale',
      slotIniziali,
      creditiIniziali: stats.creditiTotali,
      slotResidui,
      creditiResidui: Math.max(0, stats.residui),
      speso: stats.spesi,
      consVenduti,
      assegnati: enriched.length,
      tettoFascia,
    }

    const market = buildMarket(available, cfg)
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
      advice: adviceMap(available, prezzo, myTeam),
      abbinamenti: abbinamentiPerRuolo(available),
    }
  }, [settings, teams, picks, myTeamId, targets, overrides])
}
