import type { Fascia, Player, Role } from '../types'
import { FASCE, ROLES } from '../types'
import { players } from './listone'

/**
 * Listino d'asta dinamico.
 *
 * Il prezzo consigliato del workbook e' gia' tarato sulla lega da 500 crediti e
 * 10 squadre, quindi non serve ricostruire una curva da zero: si parte da li' e
 * si modella solo lo **scostamento** che l'asta produce mentre va avanti.
 *
 *     prezzo = cons x pressioneFascia x lambda,  dentro [1, tetto]
 *
 * Tre meccanismi, uno per fattore.
 *
 * **1. La pressione di fascia.** Comprato un attaccante Top salgono gli altri
 * Top, sale poco la 1a fascia, non si muove la 2a. La pressione dipende da
 * quanta parte della fascia e' gia' andata (`q`), con esponente < 1 perche' ogni
 * acquisto conti meno del precedente, e da un'ampiezza che dice quanto quella
 * fascia puo' scaldarsi.
 *
 * **2. L'ampiezza viene dal listone, non e' un parametro.** E' quanto la fascia
 * concentra crediti rispetto a quanti giocatori ha: gli attaccanti Top sono il
 * 10% dei giocatori e il 30% della spesa del reparto, quindi si scaldano; gli
 * attaccanti di 2a fascia sono il 33% dei giocatori e il 23% della spesa, quindi
 * non si scaldano mai. Il modello scopre da solo che per i portieri la pressione
 * sta sulla 2a-3a e per i difensori sulla 3a.
 *
 * **3. Lambda: quanto la lega sta pagando davvero.** Due segnali che presto
 * dicono cose opposte. Il portafoglio (quanti crediti restano per gli slot che
 * restano) e la temperatura osservata (quanto la lega ha strapagato finora
 * rispetto ai prezzi consigliati). A inizio asta spendere tanto significa "lega
 * calda, continuera' a strapagare"; a fine asta significa "non ci sono piu'
 * soldi". Il peso si sposta dall'uno all'altro con l'avanzamento.
 *
 * Tarato su aste simulate contro tre curve di lega (top strapagati, lega
 * disciplinata, tutti che tengono i crediti per la fine). Sui primi 60
 * giocatori chiamati — quelli su cui si decide l'asta — l'errore medio scende
 * dal 32% al 17% nella lega calda e dal 47% al 32% in quella tardiva.
 */

/** Quota di spesa per reparto, mediana delle aste concluse. */
export const QUOTA_REPARTO: Record<Role, number> = { P: 0.07, D: 0.19, C: 0.32, A: 0.42 }

/** Un giocatore e di fascia alta se costa almeno questa quota del budget squadra. */
export const SOGLIA_TOP = 0.08

/** Quanti giocatori di fascia alta cerca una squadra per reparto. */
export const CERCATI_PER_SQUADRA: Record<Role, number> = { P: 1, D: 2, C: 2, A: 1 }

// --- pressione di fascia ----------------------------------------------------

/**
 * Concavita' della pressione sulla frazione di fascia gia' venduta. Sotto 1
 * ogni acquisto alza meno del precedente, che e' il comportamento chiesto: la
 * domanda e' elastica, sopra un certo prezzo le squadre scendono di fascia
 * invece di rilanciare.
 */
const GAMMA = 0.6

/** Quanto la pressione di una fascia si trasmette a quella adiacente. */
const CONTAGIO = 0.35

/** Da quanta concentrazione di crediti nasce l'ampiezza, e dove si ferma. */
const PESO_AMPIEZZA = 0.55
const AMPIEZZA_MAX = 1.2

/**
 * Ampiezza per reparto e fascia: quanto quella fascia puo' scaldarsi.
 *
 * Si legge dal listone una volta sola, perche' dipende solo da com'e' fatto il
 * campionato: `quota di crediti / quota di giocatori`. Sopra 1 la fascia
 * concentra soldi ed e' contesa; sotto 1 e' merce comune e resta ferma.
 */
const AMPIEZZA: Record<string, number> = {}
for (const r of ROLES) {
  const reparto = players.filter((p) => p.r === r)
  const creditiReparto = reparto.reduce((n, p) => n + p.cons, 0)
  for (const f of FASCE) {
    const g = reparto.filter((p) => p.fascia === f)
    if (!g.length || creditiReparto <= 0) continue
    const quotaCrediti = g.reduce((n, p) => n + p.cons, 0) / creditiReparto
    const quotaGiocatori = g.length / reparto.length
    const concentrazione = quotaCrediti / quotaGiocatori
    AMPIEZZA[`${r}|${f}`] = Math.min(AMPIEZZA_MAX, Math.max(0, PESO_AMPIEZZA * (concentrazione - 1)))
  }
}

/** Quanti giocatori aveva ogni fascia a inizio asta. */
const INIZIALI: Record<string, number> = {}
for (const p of players) {
  const k = `${p.r}|${p.fascia}`
  INIZIALI[k] = (INIZIALI[k] ?? 0) + 1
}

// --- lambda -----------------------------------------------------------------

/**
 * Quanto in fretta ci si fida della temperatura osservata: dopo KAPPA
 * assegnazioni la si crede a meta'. Con poche vendite alle spalle uno scarto e'
 * quasi sempre rumore, e inseguirlo peggiora le stime.
 */
const KAPPA = 12

/**
 * Limiti di lambda. Il tetto serve piu' del pavimento: in una lega che tiene i
 * crediti per la fine, sul finale restano molti soldi e pochi slot, e senza
 * limite il listino esplodeva (errore medio da 24 crediti a 4 nelle prove).
 */
const LAMBDA_MIN = 0.5
const LAMBDA_MAX = 2

const clamp = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x))

export type Temperatura = 'freddo' | 'normale' | 'caldo'

/**
 * L'attesa sulla lega prima di aver visto un solo acquisto. E' il punto cieco
 * del modello: finche' nessuno ha comprato non c'e' modo di sapere se la lega
 * strapaga, e questa scelta e' l'unica leva.
 */
export const TEMPERATURE: Record<Temperatura, { label: string; prior: number; nota: string }> = {
  freddo: {
    label: 'Freddo',
    prior: 0.85,
    nota: 'Lega prudente: ci si aspetta di pagare sotto il prezzo consigliato finche i fatti non dicono altro.',
  },
  normale: {
    label: 'Normale',
    prior: 1,
    nota: 'Si parte dai prezzi consigliati del listone e si corregge appena le prime assegnazioni dicono come tira la lega.',
  },
  caldo: {
    label: 'Caldo',
    prior: 1.35,
    nota: 'Lega da guerra sui top: si mette in conto un 35% sopra il consigliato, poi il modello si taratura da solo.',
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
  /** Crediti gia spesi: con la riga sotto da' la temperatura osservata. */
  speso: number
  /** Somma dei prezzi consigliati dei giocatori gia assegnati. */
  consVenduti: number
  /** Assegnazioni gia fatte: la fiducia nella temperatura osservata cresce con questa. */
  assegnati: number
  /**
   * Offerta massima sostenibile dalla squadra piu ricca che cerca ancora quel
   * reparto: nessun prezzo puo superarla, perche nessuno puo pagarla.
   */
  tettoFascia: Record<Role, number>
}

/**
 * La temperatura da usare adesso: si parte dall'attesa impostata e ci si sposta
 * verso quella osservata man mano che le assegnazioni la rendono credibile.
 */
export function temperaturaCorrente(cfg: MarketConfig): {
  prior: number
  osservata: number | null
  usata: number
  confidenza: number
} {
  const prior = TEMPERATURE[cfg.temperatura].prior
  const osservata = cfg.consVenduti > 0 ? clamp(cfg.speso / cfg.consVenduti, 0.5, 2.5) : null
  const confidenza = cfg.assegnati / (cfg.assegnati + KAPPA)
  const usata = osservata === null ? prior : prior * Math.pow(osservata / prior, confidenza)
  return { prior, osservata, usata, confidenza }
}

export interface PressioneFascia {
  fascia: Fascia
  /** Giocatori liberi e giocatori che c'erano a inizio asta. */
  liberi: number
  iniziali: number
  /** Moltiplicatore applicato ai prezzi della fascia, contagio incluso. */
  spinta: number
}

export interface MarketReparto {
  role: Role
  /** Crediti che la lega spendera ancora nel reparto. */
  budgetResiduo: number
  /** Slot ancora da riempire nel reparto in tutta la lega. */
  slotResidui: number
  /** Prezzo del migliore ancora libero. */
  topOra: number
  /** Prezzo consigliato del migliore del reparto a inizio asta. */
  topIniziale: number
  /** Quanti finiscono a 1 credito. */
  aUnCredito: number
  /** Scostamento complessivo dai prezzi consigliati in questo reparto. */
  lambda: number
  pressioni: PressioneFascia[]
}

export interface Market {
  /** Prezzo d'asta atteso per id giocatore. */
  prezzi: Map<number, number>
  reparti: Record<Role, MarketReparto>
  temperatura: Temperatura
  /** Temperatura osservata, attesa e quella effettivamente usata. */
  clima: ReturnType<typeof temperaturaCorrente>
}

/**
 * Pressione per fascia dentro un reparto, contagio compreso.
 *
 * Il contagio arriva solo alla fascia adiacente: che comprare un attaccante Top
 * muova i prezzi della 2a fascia non e' un comportamento che si vuole, e
 * troncare e' piu' onesto che affidarsi a un esponente piccolo.
 */
function pressioni(available: Player[], r: Role): Map<Fascia, number> {
  // Solo il reparto in esame: le fasce sono relative al ruolo, e contare i
  // liberi su tutti i reparti darebbe una frazione consumata negativa.
  const delReparto = available.filter((p) => p.r === r)
  const propria = new Map<Fascia, number>()
  for (const f of FASCE) {
    const iniziali = INIZIALI[`${r}|${f}`] ?? 0
    if (!iniziali) continue
    const liberi = delReparto.filter((p) => p.fascia === f).length
    if (!liberi) continue
    const q = clamp((iniziali - liberi) / iniziali, 0, 1)
    propria.set(f, 1 + (AMPIEZZA[`${r}|${f}`] ?? 0) * Math.pow(q, GAMMA))
  }

  const out = new Map<Fascia, number>()
  for (const [f, v] of propria) {
    let spinta = v
    const i = FASCE.indexOf(f)
    for (const [g, w] of propria) {
      if (Math.abs(FASCE.indexOf(g) - i) === 1) spinta *= Math.pow(w, CONTAGIO)
    }
    out.set(f, spinta)
  }
  return out
}

/**
 * Costruisce il listino sullo stato attuale dell'asta.
 *
 * `available` sono i giocatori ancora liberi: e' la lista che si svuota, ed e'
 * quello che fa salire i prezzi di chi resta.
 */
export function buildMarket(available: Player[], cfg: MarketConfig): Market {
  const prezzi = new Map<number, number>()
  const reparti = {} as Record<Role, MarketReparto>
  const clima = temperaturaCorrente(cfg)

  // Il budget residuo si ripartisce tra i reparti in proporzione a quanto
  // costava uno slot di quel reparto a inizio asta, per gli slot che restano.
  const perSlot = {} as Record<Role, number>
  for (const r of ROLES) {
    perSlot[r] = cfg.slotIniziali[r] > 0 ? (QUOTA_REPARTO[r] * cfg.creditiIniziali) / cfg.slotIniziali[r] : 0
  }
  const pesoReparto = {} as Record<Role, number>
  for (const r of ROLES) pesoReparto[r] = perSlot[r] * Math.max(0, cfg.slotResidui[r])
  const pesoTotale = ROLES.reduce((n, r) => n + pesoReparto[r], 0)

  // Quanto e' avanzata l'asta: sposta il peso dalla temperatura al portafoglio.
  const slotIniziali = ROLES.reduce((n, r) => n + cfg.slotIniziali[r], 0)
  const slotResidui = ROLES.reduce((n, r) => n + Math.max(0, cfg.slotResidui[r]), 0)
  const avanzamento = slotIniziali > 0 ? clamp((slotIniziali - slotResidui) / slotIniziali, 0, 1) : 0

  for (const r of ROLES) {
    const lista = available.filter((p) => p.r === r).sort((a, b) => b.cons - a.cons || b.indice - a.indice)
    const slotDelReparto = Math.max(0, cfg.slotResidui[r])
    const budgetResiduo = pesoTotale > 0 ? (cfg.creditiResidui * pesoReparto[r]) / pesoTotale : 0
    const spinte = pressioni(available, r)

    const iniziale = players.filter((p) => p.r === r).reduce((n, p) => Math.max(n, p.cons), 0)

    if (!lista.length || slotDelReparto === 0 || budgetResiduo <= 0) {
      for (const p of lista) prezzi.set(p.id, 1)
      reparti[r] = {
        role: r,
        budgetResiduo: Math.round(budgetResiduo),
        slotResidui: slotDelReparto,
        topOra: lista.length ? 1 : 0,
        topIniziale: iniziale,
        aUnCredito: lista.length,
        lambda: 0,
        pressioni: [],
      }
      continue
    }

    // Prezzo grezzo: il consigliato, spinto dalla pressione della sua fascia.
    const grezzo = (p: Player) => p.cons * (spinte.get(p.fascia) ?? 1)

    // Oltre gli slot che restano nessuno rilancia: quei giocatori valgono 1.
    const comprabili = [...lista].sort((a, b) => grezzo(b) - grezzo(a)).slice(0, slotDelReparto)
    const ids = new Set(comprabili.map((p) => p.id))
    const somma = comprabili.reduce((n, p) => n + grezzo(p), 0)

    // Portafoglio: quanto il reparto puo' ancora spendere per quel che resta.
    const portafoglio = somma > 0 ? budgetResiduo / somma : 1
    // Presto pesa la temperatura, tardi il portafoglio.
    const lambda = clamp(
      Math.pow(portafoglio, avanzamento) * Math.pow(clima.usata, 1 - avanzamento),
      LAMBDA_MIN,
      LAMBDA_MAX,
    )

    const tetto = cfg.tettoFascia[r] > 0 ? cfg.tettoFascia[r] : Infinity
    let aUnCredito = 0
    for (const p of lista) {
      const v = ids.has(p.id) ? clamp(Math.round(grezzo(p) * lambda), 1, tetto) : 1
      prezzi.set(p.id, v)
      if (v <= 1) aUnCredito++
    }

    reparti[r] = {
      role: r,
      budgetResiduo: Math.round(budgetResiduo),
      slotResidui: slotDelReparto,
      topOra: prezzi.get(lista[0].id) ?? 1,
      topIniziale: iniziale,
      aUnCredito,
      lambda,
      pressioni: FASCE.filter((f) => spinte.has(f)).map((f) => ({
        fascia: f,
        liberi: available.filter((p) => p.r === r && p.fascia === f).length,
        iniziali: INIZIALI[`${r}|${f}`] ?? 0,
        spinta: spinte.get(f) ?? 1,
      })),
    }
  }

  return { prezzi, reparti, temperatura: cfg.temperatura, clima }
}
