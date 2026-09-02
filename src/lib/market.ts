import type { Player, Role } from '../types'
import { ROLES } from '../types'
import { fvm } from './listone'

/**
 * Listino d'asta dinamico.
 *
 * Le quotazioni dell'Excel sono una base d'asta, non un prezzo: la loro somma
 * e' calibrata sul budget, ma la distribuzione reale e' molto piu' ripida e
 * soprattutto **cambia durante l'asta**.
 *
 * Il meccanismo che conta: in una lega da 10 squadre ognuna vuole almeno un
 * attaccante di livello. La domanda di attaccanti forti parte da 10 e scende
 * solo quando qualcuno il suo lo ha preso, mentre l'offerta di attaccanti forti
 * si svuota a ogni acquisto. Quando restano quattro squadre senza bomber e tre
 * bomber sul mercato, quei tre costano molto piu' di quanto costavano all'inizio
 * — e uno che a inizio asta valeva 30 crediti ne vale 80.
 *
 * Il modello riproduce questo con due blocchi per reparto:
 *
 * - **fascia alta**: i migliori ancora liberi, tanti quanti ne cercano ancora
 *   le squadre. Si dividono una quota fissa del budget di reparto, quindi meno
 *   sono e piu' costano.
 * - **resto**: si divide quel che rimane. Oltre il numero di slot ancora da
 *   riempire in tutta la lega il prezzo e' 1: passato quel punto nessuno
 *   rilancia.
 *
 * Dentro ogni blocco il prezzo va come `fvm^gamma`, con gamma calibrato una
 * volta a inizio asta sui prezzi osservati nelle aste concluse.
 *
 * Fonti: fantacalcio-online.com (ripartizione mediana e prezzi medi da aste
 * concluse), economiaesport.it (prezzi massimi 2026/27).
 */

/** Quota di spesa per reparto, mediana delle aste concluse. */
export const QUOTA_REPARTO: Record<Role, number> = { P: 0.07, D: 0.19, C: 0.32, A: 0.42 }

/**
 * Prezzo del miglior giocatore del reparto a inizio asta, in quota del budget
 * di UNA squadra. Su 500 crediti: A 84, C 46, D 40, P 28.
 *
 * Le proporzioni tra reparti vengono dai prezzi massimi osservati da
 * economiaesport.it (A 164, C 89, D 78, P 55), riscalate sul livello delle aste
 * realmente concluse di fantacalcio-online (Lautaro 84, Thuram 71): le due
 * fonti concordano sulla forma, non sul livello, e il livello lo decide la
 * temperatura qui sotto.
 */
export const TOP_REPARTO: Record<Role, number> = { P: 0.056, D: 0.08, C: 0.092, A: 0.168 }

/** Un giocatore e di fascia alta se costa almeno questa quota del budget squadra. */
export const SOGLIA_TOP = 0.08

/** Quanti giocatori di fascia alta cerca una squadra per reparto. */
export const CERCATI_PER_SQUADRA: Record<Role, number> = { P: 1, D: 2, C: 2, A: 1 }

export type Temperatura = 'freddo' | 'normale' | 'caldo'

/** Quanto sono aggressivi i partecipanti sui top: scala il picco della curva. */
export const TEMPERATURE: Record<Temperatura, { label: string; scala: number; nota: string }> = {
  freddo: {
    label: 'Freddo',
    scala: 0.75,
    nota: 'Lega prudente, nessuno si scanna sui top: miglior attaccante intorno a 63 su 500 crediti.',
  },
  normale: {
    label: 'Normale',
    scala: 1,
    nota: 'Prezzi medi delle aste realmente concluse: miglior attaccante ~84, secondo ~70 su 500 crediti.',
  },
  caldo: {
    label: 'Caldo',
    scala: 1.95,
    nota: 'Lega da guerra sui top: miglior attaccante oltre 160, e il resto della rosa a 1-2 crediti.',
  },
}

export interface MarketConfig {
  budgetSquadra: number
  squadre: number
  temperatura: Temperatura
  /** Slot per reparto in tutta la lega a inizio asta. */
  slotIniziali: Record<Role, number>
  /** Crediti di tutta la lega a inizio asta. */
  creditiIniziali: number
  /** Slot ancora da riempire in tutta la lega. */
  slotResidui: Record<Role, number>
  /** Crediti ancora in mano alle squadre. */
  creditiResidui: number
  /**
   * Quanti giocatori di fascia alta cercano ancora le squadre, per reparto.
   * E' la domanda che tiene alti i prezzi quando l'offerta si svuota.
   */
  cercatiFascia: Record<Role, number>
  /**
   * Offerta massima sostenibile dalla squadra piu ricca che cerca ancora quel
   * reparto: nessun prezzo puo superarla, perche nessuno puo pagarla.
   */
  tettoFascia: Record<Role, number>
}

const GAMMA_MIN = 0.25
const GAMMA_MAX = 8
const PASSI = 40

const potenza = (rapporto: number, gamma: number) => Math.pow(Math.max(0, rapporto), gamma)

/**
 * Calibra la ripidita della curva sul prezzo osservato del migliore del
 * reparto: e' l'unico punto in cui entrano i dati esterni.
 */
function calibraGamma(rapporti: number[], top: number, budget: number): number {
  const somma = (g: number) => rapporti.reduce((n, r) => n + Math.max(1, Math.round(top * potenza(r, g))), 0)

  if (somma(GAMMA_MAX) > budget) return GAMMA_MAX
  if (somma(GAMMA_MIN) < budget) return GAMMA_MIN

  let lo = GAMMA_MIN
  let hi = GAMMA_MAX
  for (let i = 0; i < PASSI; i++) {
    const mid = (lo + hi) / 2
    if (somma(mid) > budget) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Quanto puo salire o scendere il livello dei prezzi rispetto alla curva base.
 * La fascia alta ha spazio per raddoppiare e oltre, la coda quasi no: e' la
 * scarsita dei top che fa i prezzi, non quella dei tappabuchi.
 */
const MULT_FASCIA = { min: 0.6, max: 3 }
const MULT_RESTO = { min: 0.6, max: 1.6 }

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

/**
 * Fattore per cui scalare la curva base di un blocco perche' la sua spesa si
 * avvicini al budget disponibile.
 *
 * Si scala il livello, non si ridistribuisce il budget sui pesi: normalizzando
 * i pesi la coda finiva tutta a 1 credito e il primo giocatore fuori dalla
 * fascia arrivava a 300.
 */
function moltiplicatore(base: number[], budget: number, limiti: { min: number; max: number }): number {
  const somma = base.reduce((n, x) => n + x, 0)
  if (somma <= 0 || budget <= 0) return limiti.min
  return clamp(budget / somma, limiti.min, limiti.max)
}

export interface MarketReparto {
  role: Role
  gamma: number
  /** Crediti che la lega spendera ancora nel reparto. */
  budgetResiduo: number
  /** Slot ancora da riempire nel reparto in tutta la lega. */
  slotResidui: number
  /** Giocatori di fascia alta ancora cercati: la domanda. */
  cercati: number
  /** Prezzo del migliore ancora libero. */
  topOra: number
  /** Prezzo che lo stesso reparto aveva a inizio asta. */
  topIniziale: number
  /** Quanti finiscono a 1 credito. */
  aUnCredito: number
  /** Di quanto e' scalata la curva sulla fascia alta rispetto a inizio asta. */
  multFascia: number
}

export interface Market {
  /** Prezzo d'asta atteso per id giocatore. */
  prezzi: Map<number, number>
  reparti: Record<Role, MarketReparto>
  temperatura: Temperatura
}

export interface Calibrazione {
  gamma: Record<Role, number>
  /** Quota del budget di reparto che finisce alla fascia alta. */
  quotaFascia: Record<Role, number>
  topIniziale: Record<Role, number>
  /** FVM del migliore del reparto a inizio asta: riferimento fisso della curva. */
  fvmTop: Record<Role, number>
}

/**
 * Calibrazione iniziale: fissa la ripidita di ogni reparto e la fetta di
 * budget che si prende la fascia alta. Dipende solo dal listone e dalle regole
 * di lega, quindi si calcola una volta.
 */
export function calibra(players: Player[], cfg: MarketConfig): Calibrazione {
  const scala = TEMPERATURE[cfg.temperatura].scala
  const gamma = {} as Record<Role, number>
  const quotaFascia = {} as Record<Role, number>
  const topIniziale = {} as Record<Role, number>
  const fvmTop = {} as Record<Role, number>

  for (const r of ROLES) {
    const lista = players.filter((p) => p.r === r).sort((a, b) => fvm(b) - fvm(a))
    const comprati = Math.min(lista.length, Math.max(1, cfg.slotIniziali[r]))
    const budget = QUOTA_REPARTO[r] * cfg.creditiIniziali
    const top = Math.max(1, Math.round(TOP_REPARTO[r] * cfg.budgetSquadra * scala))
    const fvmTop_ = Math.max(1, fvm(lista[0]))

    const rapporti = lista.slice(0, comprati).map((p) => fvm(p) / fvmTop_)
    const g = calibraGamma(rapporti, top, budget)

    // Quanto si prende la fascia alta a inizio asta, con la curva calibrata.
    // Qui serve la domanda iniziale, non quella corrente.
    const nFascia = Math.min(comprati, Math.max(1, CERCATI_PER_SQUADRA[r] * cfg.squadre))
    const prezziIniziali = rapporti.map((x) => Math.max(1, Math.round(top * potenza(x, g))))
    const totale = prezziIniziali.reduce((n, x) => n + x, 0)
    const fascia = prezziIniziali.slice(0, nFascia).reduce((n, x) => n + x, 0)

    gamma[r] = g
    quotaFascia[r] = totale > 0 ? fascia / totale : 0.3
    topIniziale[r] = prezziIniziali[0] ?? top
    fvmTop[r] = fvmTop_
  }

  return { gamma, quotaFascia, topIniziale, fvmTop }
}

/**
 * Costruisce il listino sullo stato attuale dell'asta.
 *
 * `available` sono i giocatori ancora liberi: e' la lista che si svuota, ed e'
 * quello che fa salire i prezzi di chi resta.
 */
export function buildMarket(available: Player[], cfg: MarketConfig, cal: Calibrazione): Market {
  const prezzi = new Map<number, number>()
  const reparti = {} as Record<Role, MarketReparto>

  // Il budget residuo si ripartisce tra i reparti in proporzione a quanto
  // costava uno slot di quel reparto a inizio asta, per gli slot che restano.
  const perSlot = {} as Record<Role, number>
  for (const r of ROLES) {
    perSlot[r] = cfg.slotIniziali[r] > 0 ? (QUOTA_REPARTO[r] * cfg.creditiIniziali) / cfg.slotIniziali[r] : 0
  }
  const pesoReparto = {} as Record<Role, number>
  for (const r of ROLES) pesoReparto[r] = perSlot[r] * Math.max(0, cfg.slotResidui[r])
  const pesoTotale = ROLES.reduce((n, r) => n + pesoReparto[r], 0)

  for (const r of ROLES) {
    const lista = available.filter((p) => p.r === r).sort((a, b) => fvm(b) - fvm(a))
    const slotResidui = Math.max(0, cfg.slotResidui[r])
    const budgetResiduo =
      pesoTotale > 0 ? (cfg.creditiResidui * pesoReparto[r]) / pesoTotale : 0

    if (!lista.length || slotResidui === 0 || budgetResiduo <= 0) {
      for (const p of lista) prezzi.set(p.id, 1)
      reparti[r] = {
        role: r,
        gamma: cal.gamma[r],
        budgetResiduo: Math.round(budgetResiduo),
        slotResidui,
        cercati: Math.max(0, cfg.cercatiFascia[r]),
        topOra: lista.length ? 1 : 0,
        topIniziale: cal.topIniziale[r],
        aUnCredito: lista.length,
        multFascia: 0,
      }
      continue
    }

    // Chi verra' comprato: oltre gli slot residui della lega nessuno rilancia.
    const comprabili = lista.slice(0, Math.min(lista.length, slotResidui))
    const fuori = lista.slice(comprabili.length)

    // Fascia alta: i migliori liberi, tanti quanti ne cercano ancora le squadre.
    // Si dividono una quota fissa del budget, quindi meno sono e piu' costano.
    const nFascia = Math.min(comprabili.length, Math.max(0, cfg.cercatiFascia[r]))
    const fascia = comprabili.slice(0, nFascia)
    const resto = comprabili.slice(nFascia)

    // Curva base: riferita al migliore di INIZIO asta, non a quello che resta.
    // Se il riferimento si spostasse, togliere il numero uno rivaluterebbe da
    // solo tutti gli altri e il modello perderebbe la scala.
    const base = (p: Player) => cal.topIniziale[r] * potenza(fvm(p) / cal.fvmTop[r], cal.gamma[r])

    const budgetFascia = nFascia > 0 ? budgetResiduo * cal.quotaFascia[r] : 0
    const budgetResto = budgetResiduo - budgetFascia
    const multFascia = moltiplicatore(fascia.map(base), budgetFascia, MULT_FASCIA)
    const multResto = moltiplicatore(resto.map(base), budgetResto, MULT_RESTO)

    // Nessuno puo pagare piu di quanto ha la squadra piu ricca che cerca il
    // reparto: senza questo tetto, con una sola squadra a caccia il prezzo
    // esploderebbe oltre qualunque offerta possibile.
    const tetto = cfg.tettoFascia[r] > 0 ? cfg.tettoFascia[r] : Infinity
    const applica = (p: Player, mult: number) =>
      Math.min(tetto, Math.max(1, Math.round(base(p) * mult)))

    for (const p of fascia) prezzi.set(p.id, applica(p, multFascia))
    for (const p of resto) prezzi.set(p.id, applica(p, multResto))
    for (const p of fuori) prezzi.set(p.id, 1)

    let aUnCredito = 0
    for (const p of lista) if ((prezzi.get(p.id) ?? 1) <= 1) aUnCredito++

    reparti[r] = {
      role: r,
      gamma: cal.gamma[r],
      budgetResiduo: Math.round(budgetResiduo),
      slotResidui,
      cercati: nFascia,
      topOra: prezzi.get(lista[0].id) ?? 1,
      topIniziale: cal.topIniziale[r],
      aUnCredito,
      multFascia: multFascia,
    }
  }

  return { prezzi, reparti, temperatura: cfg.temperatura }
}
