import type { Mode, Player, Role } from '../types'
import { ROLES } from '../types'
import { fvm } from './listone'
import type { Market } from './market'
import type { TeamStats } from './stats'

/** Da dove arriva il prezzo atteso di un giocatore. */
export type FontePrezzo = 'override' | 'mercato' | 'listino'

export interface PrezzoAtteso {
  (p: Player): number
  fonte: (p: Player) => FontePrezzo
}

/**
 * Costruisce la funzione prezzo atteso, in ordine di precedenza:
 *
 * 1. correzione a mano fatta in dashboard (`priceOverrides`);
 * 2. prezzo di mercato curato in `data/extra.json` (es. Malen a 300 dopo 5 gol
 *    in 2 giornate: nessun modello puo saperlo);
 * 3. listino d'asta dinamico calcolato da `buildMarket`.
 *
 * Il terzo punto e il cambio che conta: prima si usava la quotazione, e i piani
 * finivano per comprare Lautaro e Thuram insieme. La quotazione e una base
 * d'asta, non un prezzo, e il prezzo cambia mentre la lista si svuota.
 */
export function makePrezzoAtteso(market: Market, overrides: Record<number, number> = {}): PrezzoAtteso {
  const fn = ((p: Player) => {
    const o = overrides[p.id]
    if (o != null && o > 0) return Math.round(o)
    if (p.atteso != null && p.atteso > 0) return Math.round(p.atteso)
    return Math.max(1, market.prezzi.get(p.id) ?? 1)
  }) as PrezzoAtteso

  fn.fonte = (p) => {
    const o = overrides[p.id]
    if (o != null && o > 0) return 'override'
    if (p.atteso != null && p.atteso > 0) return 'mercato'
    return 'listino'
  }

  return fn
}

/** Inflazione da usare nei consigli: significativa solo dopo un po' di acquisti. */
export function usableInflation(inflazione: number, assegnati: number): number {
  if (assegnati < 10 || !Number.isFinite(inflazione) || inflazione <= 0) return 1
  // Limitata per non trasformare un'asta iniziale sbilanciata in prezzi assurdi.
  return Math.min(2.5, Math.max(0.5, inflazione))
}

export interface RoleNorm {
  /** FVM massimo tra i giocatori ancora liberi del reparto. */
  maxFvm: number
  /** Miglior rapporto FVM/prezzo atteso tra i liberi del reparto. */
  maxValue: number
}

export function roleNorms(available: Player[], mode: Mode, prezzo: PrezzoAtteso): Record<Role, RoleNorm> {
  const norms = {} as Record<Role, RoleNorm>
  for (const r of ROLES) norms[r] = { maxFvm: 1, maxValue: 1 }
  for (const p of available) {
    const n = norms[p.r]
    const f = fvm(p, mode)
    const v = f / prezzo(p)
    if (f > n.maxFvm) n.maxFvm = f
    if (v > n.maxValue) n.maxValue = v
  }
  return norms
}

export interface Advice {
  expPrice: number
  fontePrezzo: FontePrezzo
  /** FVM per credito atteso. */
  value: number
  /** Punteggio 0-100: qualita nel reparto, resa per credito, ruolo e budget. */
  score: number
  /** Il reparto ha ancora slot liberi nella squadra di riferimento. */
  needed: boolean
  /** Il prezzo atteso sta dentro l'offerta massima sostenibile. */
  affordable: boolean
  motivi: string[]
}

/** Moltiplicatori per i dati curati: rigori e titolarita pesano davvero all'asta. */
const BONUS_RIGORISTA = { 1: 1.15, 2: 1.05 } as const
const BONUS_TITOLARE = 1.1
const MALUS_NON_TITOLARE = 0.85

/**
 * Punteggio di un giocatore per la squadra indicata.
 *
 * Pesa insieme quanto vale in assoluto nel suo reparto (per non premiare solo
 * i giocatori da 1 credito) e quanto rende per credito speso, poi corregge con
 * i dati curati: rigorista e titolare valgono piu di quanto dica la
 * quotazione, che e' fatta prima che il campionato inizi.
 *
 * Infine penalizza chi non serve o non e' sostenibile: quei giocatori scendono
 * in fondo senza scomparire, perche' in asta servono anche da rilancio.
 */
export function adviceFor(
  p: Player,
  mode: Mode,
  prezzo: PrezzoAtteso,
  norms: Record<Role, RoleNorm>,
  team?: TeamStats,
  /** true se il listone ha davvero i titolari: senza dati non si penalizza nessuno. */
  conTitolari = false,
): Advice {
  const expPrice = prezzo(p)
  const f = fvm(p, mode)
  const value = f / expPrice
  const n = norms[p.r]

  const qual = Math.min(1, f / n.maxFvm)
  const eff = Math.min(1, value / n.maxValue)
  let base = 0.55 * qual + 0.45 * eff

  const motivi: string[] = []

  if (p.rigorista) {
    base *= BONUS_RIGORISTA[p.rigorista]
    motivi.push(p.rigorista === 1 ? 'primo rigorista' : 'alternativa dal dischetto')
  }
  if (p.punizioni || p.angoli) {
    const quali = [p.punizioni && 'punizioni', p.angoli && 'angoli'].filter(Boolean)
    motivi.push(quali.join(' e ') as string)
  }
  if (conTitolari) {
    if (p.titolare) {
      base *= BONUS_TITOLARE
      motivi.push('titolare nella formazione tipo')
    } else {
      base *= MALUS_NON_TITOLARE
      motivi.push('fuori dalla formazione tipo')
    }
  }
  if (p.gol) motivi.push(`${p.gol} gol in campionato`)

  const needed = team ? team.byRole[p.r].left > 0 : true
  const affordable = team ? expPrice <= team.maxBid : true

  if (!needed) base *= 0.15
  if (!affordable) base *= 0.35

  if (eff > 0.8) motivi.push('ottimo rapporto FVM/credito')
  if (qual > 0.8) motivi.push(`tra i migliori ${p.r} liberi`)
  if (!needed && team) motivi.push(`slot ${p.r} pieni`)
  if (!affordable && team) motivi.push(`sopra il tuo massimo (${team.maxBid})`)
  if (p.nota) motivi.push(p.nota)

  return {
    expPrice,
    fontePrezzo: prezzo.fonte(p),
    value,
    score: Math.min(100, Math.round(base * 100)),
    needed,
    affordable,
    motivi,
  }
}

export function adviceMap(
  available: Player[],
  mode: Mode,
  prezzo: PrezzoAtteso,
  team?: TeamStats,
  conTitolari = false,
): Map<number, Advice> {
  const norms = roleNorms(available, mode, prezzo)
  return new Map(available.map((p) => [p.id, adviceFor(p, mode, prezzo, norms, team, conTitolari)]))
}
