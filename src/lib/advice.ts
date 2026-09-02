import type { Player, Role } from '../types'
import { ROLES } from '../types'
import { fvm } from './listone'
import type { Market } from './market'
import type { TeamStats } from './stats'

/** Da dove arriva il prezzo atteso di un giocatore. */
export type FontePrezzo = 'override' | 'listino'

export interface PrezzoAtteso {
  (p: Player): number
  fonte: (p: Player) => FontePrezzo
}

/**
 * Costruisce la funzione prezzo atteso, in ordine di precedenza:
 *
 * 1. correzione a mano fatta in dashboard (`priceOverrides`);
 * 2. listino d'asta dinamico calcolato da `buildMarket`.
 *
 * Il prezzo consigliato del workbook (`p.cons`) resta visibile a parte: e' una
 * taratura fissa sulla lega da 500 crediti e 10 squadre, mentre il listino qui
 * si muove con l'asta, perche la quotazione e' una base d'asta e non un prezzo.
 */
export function makePrezzoAtteso(market: Market, overrides: Record<number, number> = {}): PrezzoAtteso {
  const fn = ((p: Player) => {
    const o = overrides[p.id]
    if (o != null && o > 0) return Math.round(o)
    return Math.max(1, market.prezzi.get(p.id) ?? 1)
  }) as PrezzoAtteso

  fn.fonte = (p) => {
    const o = overrides[p.id]
    return o != null && o > 0 ? 'override' : 'listino'
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

export function roleNorms(available: Player[], prezzo: PrezzoAtteso): Record<Role, RoleNorm> {
  const norms = {} as Record<Role, RoleNorm>
  for (const r of ROLES) norms[r] = { maxFvm: 1, maxValue: 1 }
  for (const p of available) {
    const n = norms[p.r]
    const f = fvm(p)
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
  /** Il prezzo atteso ha gia superato il prezzo max del listone. */
  sopraMax: boolean
  motivi: string[]
}

/** Moltiplicatori per i dati del listone: rigori e gerarchia pesano davvero. */
const BONUS_RIGORISTA: Record<number, number> = { 1: 1.15, 2: 1.07, 3: 1.03, 4: 1.01 }
const BONUS_PIAZZATI: Record<number, number> = { 1: 1.05, 2: 1.03, 3: 1.01 }
const PESO_GERARCHIA = { Titolare: 1.1, Ballottaggio: 0.95, Riserva: 0.8 } as const

/**
 * Quanto pesa una nota di infortunio. Le categorie sono quelle del foglio
 * Infortunati: chi rientra a ottobre vale molto meno all'asta di chi salta
 * una giornata.
 */
function malusInfortunio(p: Player): { mult: number; motivo: string } | null {
  if (!p.inf) return null
  const testo = `${p.inf.stato} ${p.nota}`.toLowerCase()
  if (testo.includes('lungo stop')) return { mult: 0.6, motivo: 'infortunato, lungo stop' }
  if (testo.includes('settembre')) return { mult: 0.85, motivo: 'infortunato, rientro a breve' }
  if (testo.includes('dubbio')) return { mult: 0.95, motivo: 'in dubbio per la prossima' }
  return { mult: 0.9, motivo: 'nota fisica da valutare' }
}

/**
 * Punteggio di un giocatore per la squadra indicata.
 *
 * Pesa insieme quanto vale in assoluto nel suo reparto (per non premiare solo
 * i giocatori da 1 credito) e quanto rende per credito speso, poi corregge con
 * i dati del listone: rigorista, gerarchia e stato fisico valgono piu di
 * quanto dica la quotazione, che e' fatta prima che il campionato inizi.
 *
 * Infine penalizza chi non serve o non e' sostenibile: quei giocatori scendono
 * in fondo senza scomparire, perche' in asta servono anche da rilancio.
 */
export function adviceFor(
  p: Player,
  prezzo: PrezzoAtteso,
  norms: Record<Role, RoleNorm>,
  team?: TeamStats,
): Advice {
  const expPrice = prezzo(p)
  const f = fvm(p)
  const value = f / expPrice
  const n = norms[p.r]

  const qual = Math.min(1, f / n.maxFvm)
  const eff = Math.min(1, value / n.maxValue)
  let base = 0.55 * qual + 0.45 * eff

  const motivi: string[] = []

  if (p.rig) {
    base *= BONUS_RIGORISTA[p.rig] ?? 1
    motivi.push(p.rig === 1 ? 'primo rigorista' : `${p.rig}o rigorista`)
  }
  if (p.piaz) {
    base *= BONUS_PIAZZATI[p.piaz] ?? 1
    motivi.push(p.piaz === 1 ? 'primo sui calci piazzati' : `${p.piaz}o sui calci piazzati`)
  }

  base *= PESO_GERARCHIA[p.gerarchia] ?? 1
  if (p.gerarchia !== 'Titolare') motivi.push(p.gerarchia.toLowerCase())

  const inf = malusInfortunio(p)
  if (inf) {
    base *= inf.mult
    motivi.push(inf.motivo)
  }

  if (p.s26.gol) motivi.push(`${p.s26.gol} gol in campionato`)

  const needed = team ? team.byRole[p.r].left > 0 : true
  const affordable = team ? expPrice <= team.maxBid : true
  const sopraMax = p.max > 0 && expPrice > p.max

  if (!needed) base *= 0.15
  if (!affordable) base *= 0.35

  if (eff > 0.8) motivi.push('ottimo rapporto FVM/credito')
  if (qual > 0.8) motivi.push(`tra i migliori ${p.r} liberi`)
  if (sopraMax) motivi.push(`il listone si ferma a ${p.max}`)
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
    sopraMax,
    motivi,
  }
}

export function adviceMap(
  available: Player[],
  prezzo: PrezzoAtteso,
  team?: TeamStats,
): Map<number, Advice> {
  const norms = roleNorms(available, prezzo)
  return new Map(available.map((p) => [p.id, adviceFor(p, prezzo, norms, team)]))
}
