import type { Player, Role } from '../types'
import { ROLES } from '../types'
import type { PrezzoAtteso } from './advice'
import { fvm, trasferteComuni } from './listone'
import { CERCATI_PER_SQUADRA } from './market'
import type { TeamStats } from './stats'

export interface Strategy {
  id: string
  nome: string
  descrizione: string
  /** Quota di budget per reparto. null = allocazione libera, guidata dal valore. */
  quote: Record<Role, number> | null
  /** Restringe i candidati a chi ha questa caratteristica. */
  filtro?: 'titolari' | 'bonus' | 'rigoristi'
  /** Prende prima N top per FVM, ignorando le quote, poi completa al minimo. */
  ancore?: number
  /** Tetto di spesa per singolo giocatore, in quota del budget. */
  tetto?: number
  /** Spesa minima per slot: evita le rose con i titolari da 1 credito. */
  minimo?: number
  /** Quota del budget residuo da spendere davvero: il resto si tiene da parte. */
  uso?: number
  /** Quanti giocatori di fascia alta per reparto. Sovrascrive MAX_TOP. */
  maxTop?: Partial<Record<Role, number>>
}

/**
 * Quanti giocatori di fascia alta stanno realisticamente in una rosa.
 *
 * Il budget da solo non basta a impedirlo: sulla carta due attaccanti da 85
 * ci stanno in 500 crediti, ma all'asta non li prendi mai entrambi perche' sette
 * avversari rilanciano su ognuno. La media reale e' due centrocampisti top e un
 * attaccante top, e il resto del budget va sui completamenti.
 */
export const MAX_TOP: Record<Role, number> = CERCATI_PER_SQUADRA

export const STRATEGIES: Strategy[] = [
  {
    id: 'equilibrata',
    nome: 'Equilibrata',
    descrizione: 'La ripartizione mediana delle aste concluse: 7% portieri, 19% difesa, 32% centrocampo, 42% attacco.',
    quote: { P: 0.07, D: 0.19, C: 0.32, A: 0.42 },
  },
  {
    id: 'bomber',
    nome: 'Due bomber',
    descrizione: 'Meta budget in attacco: due attaccanti di fascia alta, resto a caccia di occasioni.',
    quote: { P: 0.06, D: 0.15, C: 0.27, A: 0.52 },
    maxTop: { A: 2, C: 1 },
  },
  {
    id: 'ancore',
    nome: 'Tre intoccabili',
    descrizione: 'Tre big presi a qualunque prezzo, gli altri slot al minimo indispensabile.',
    quote: null,
    ancore: 3,
    maxTop: { P: 1, D: 3, C: 3, A: 3 },
  },
  {
    id: 'cinque',
    nome: 'Cinque big',
    descrizione: 'Cinque titolari da fascia alta e venti completamenti: via di mezzo tra spalmare e concentrare.',
    quote: null,
    ancore: 5,
    maxTop: { P: 1, D: 3, C: 3, A: 3 },
  },
  {
    id: 'mediana',
    nome: 'Centrocampo top',
    descrizione: 'Punta sui centrocampisti da bonus, che costano meno degli attaccanti pari resa.',
    quote: { P: 0.06, D: 0.16, C: 0.48, A: 0.3 },
    maxTop: { C: 3, A: 1 },
  },
  {
    id: 'difesa',
    nome: 'Difesa e modificatore',
    descrizione: 'Reparto arretrato di qualita: utile con il modificatore difesa attivo.',
    quote: { P: 0.09, D: 0.34, C: 0.31, A: 0.26 },
  },
  {
    id: 'valore',
    nome: 'Massimo valore',
    descrizione: 'Nessuna quota fissa: prende sempre il miglior FVM per credito ancora libero.',
    quote: null,
  },
  {
    id: 'titolari',
    nome: 'Solo titolari',
    descrizione: 'Prima le maglie della formazione tipo: meno panchinari, piu voti ogni giornata.',
    quote: { P: 0.07, D: 0.19, C: 0.32, A: 0.42 },
    filtro: 'titolari',
  },
  {
    id: 'bonus',
    nome: 'Rigori e piazzati',
    descrizione: 'Rigoristi e tiratori di punizioni e angoli: si compra il bonus, non il voto.',
    quote: { P: 0.06, D: 0.2, C: 0.36, A: 0.38 },
    filtro: 'bonus',
  },
  {
    id: 'rigoristi',
    nome: 'Caccia ai rigoristi',
    descrizione: 'Un rigorista designato in ogni slot possibile: la via piu diretta al bonus.',
    quote: null,
    filtro: 'rigoristi',
  },
  {
    id: 'nessunbuco',
    nome: 'Nessun buco',
    descrizione: 'Almeno 6 crediti per slot e tetto del 15%: rosa piatta, nessun titolare da 1 credito.',
    quote: { P: 0.08, D: 0.25, C: 0.34, A: 0.33 },
    tetto: 0.15,
    minimo: 6,
  },
  {
    id: 'tienicrediti',
    nome: 'Tieni crediti',
    descrizione: 'Spende il 75% e conserva il resto per riparazione e svincolati.',
    quote: { P: 0.07, D: 0.19, C: 0.32, A: 0.42 },
    uso: 0.75,
  },
]

export interface PlanPick {
  player: Player
  expPrice: number
  fvm: number
}

export interface RolePlan {
  role: Role
  need: number
  budget: number
  picks: PlanPick[]
  cost: number
  /** Avviso sul reparto, es. coppia portieri fuori quota. */
  nota?: string
}

export interface Plan {
  strategy: Strategy
  roles: RolePlan[]
  picks: PlanPick[]
  /** Crediti residui della squadra. */
  budget: number
  cost: number
  residuo: number
  totalFvm: number
  /** Slot coperti dal piano su quelli mancanti. */
  copertura: number
  /** FVM della rosa completa: quello gia acquistato piu il piano. */
  totalFvmRosa: number
  rigoristi: number
  titolari: number
  /** Giocatori di fascia alta per reparto e soglia usata per contarli. */
  top: Record<Role, number>
  sogliaTop: number
  /** Quanti slot vanno a 1-2 crediti: sono quelli che liberano budget. */
  aPocoPrezzo: number
    /** Sigle del blocco portieri e trasferte in comune, quando applicato. */
  abbinamentoPortieri?: string
}

/** Quanti giocatori di fascia alta ci sono in una lista. */
const contaTop = (picks: PlanPick[], soglia: number) => picks.filter((c) => c.expPrice >= soglia).length

const FILTRI = {
  titolari: (p: Player) => p.gerarchia === 'Titolare',
  bonus: (p: Player) => p.rig != null || p.piaz != null,
  rigoristi: (p: Player) => p.rig != null,
}

/**
 * Riparte il budget tra i reparti che hanno ancora slot da riempire,
 * ridistribuendo le quote dei reparti gia completi.
 */
function splitBudget(
  budget: number,
  quote: Record<Role, number>,
  need: Record<Role, number>,
): Record<Role, number> {
  const attivi = ROLES.filter((r) => need[r] > 0)
  const somma = attivi.reduce((n, r) => n + quote[r], 0)
  const out = {} as Record<Role, number>
  for (const r of ROLES) out[r] = attivi.includes(r) && somma > 0 ? (budget * quote[r]) / somma : 0
  return out
}

/**
 * Riempie gli slot di un reparto partendo dai giocatori migliori e tenendo
 * 1 credito per ogni slot ancora da coprire: cosi il piano contiene qualche
 * titolare vero piu i completamenti, come in un'asta reale.
 */
function fillRole(
  candidates: PlanPick[],
  need: number,
  budget: number,
  soglia = Infinity,
  maxTop = Infinity,
): PlanPick[] {
  const taken: PlanPick[] = []
  let cost = 0
  let top = 0
  // Il tappabuco piu economico non costa sempre 1: la riserva per gli slot
  // ancora vuoti va calcolata sul prezzo reale, o il piano sfonda il budget.
  const minimo = candidates.length ? Math.min(...candidates.map((c) => c.expPrice)) : 1

  for (const c of candidates) {
    if (taken.length === need) break
    const isTop = c.expPrice >= soglia
    if (isTop && top >= maxTop) continue
    const slotsLeft = need - taken.length
    if (cost + c.expPrice <= budget - (slotsLeft - 1) * minimo) {
      taken.push(c)
      cost += c.expPrice
      if (isTop) top++
    }
  }

  // Se il budget non basta per i titolari, completa con i piu economici.
  if (taken.length < need) {
    const presi = new Set(taken.map((t) => t.player.id))
    const economici = candidates.filter((c) => !presi.has(c.player.id)).sort((a, b) => a.expPrice - b.expPrice)
    for (const c of economici) {
      if (taken.length === need) break
      taken.push(c)
      cost += c.expPrice
    }
  }

  return taken
}

/**
 * Portieri: il blocco che si copre meglio sul calendario.
 *
 * Regola d'asta, non ottimizzazione. Due squadre che non giocano quasi mai in
 * trasferta nella stessa giornata si alternano bene: quando uno e' fuori casa
 * l'altro e' in casa, e in formazione ci va sempre quello favorito. Il caso
 * limite sono i derby di citta (Inter-Milan, Roma-Lazio, Juventus-Torino), che
 * non vanno MAI fuori insieme.
 *
 * Si cerca quindi la combinazione di `need` portieri liberi che massimizza
 * qualita e copertura insieme, dentro il budget del reparto.
 */
function fillPortieri(
  pool: PlanPick[],
  need: number,
  budget: number,
): { picks: PlanPick[]; abbinamento?: string; nota?: string } {
  if (need <= 0) return { picks: [] }
  if (need === 1) {
    return {
      picks: fillRole(pool, 1, budget),
      nota: 'Un solo slot libero: l abbinamento di calendario non si puo applicare.',
    }
  }

  // Solo i migliori liberi: oltre non c'e un portiere che valga la maglia, e
  // la ricerca resta di poche centinaia di combinazioni.
  const bacino = [...pool].sort((a, b) => b.fvm - a.fvm).slice(0, 16)
  if (bacino.length < 2) return { picks: fillRole(pool, need, budget) }

  const quanti = Math.min(need, 3, bacino.length)
  const fvmMax = Math.max(1, ...bacino.map((c) => c.fvm))

  /** Trasferte in comune di tutte le coppie del blocco: piu basso, meglio ruota. */
  const totTrasferte = (blocco: PlanPick[]) => {
    let tot = 0
    for (let i = 0; i < blocco.length; i++) {
      for (let j = i + 1; j < blocco.length; j++) {
        tot += trasferteComuni(blocco[i].player.squadra, blocco[j].player.squadra)
      }
    }
    return tot
  }

  // Il massimo teorico e' 19 per ogni coppia del blocco: normalizza la copertura.
  const coppieNel = (quanti * (quanti - 1)) / 2
  const punteggio = (blocco: PlanPick[]) => {
    const qualita = blocco.reduce((n, c) => n + c.fvm / fvmMax, 0) / blocco.length
    const copertura = 1 - totTrasferte(blocco) / (19 * coppieNel)
    return 0.6 * qualita + 0.4 * copertura
  }

  // Il resto degli slot va ai piu economici: va lasciato il minimo per coprirli.
  const minimo = pool.length ? Math.min(...pool.map((c) => c.expPrice)) : 1
  const tetto = budget - (need - quanti) * minimo

  // C(16,3) = 560 combinazioni al massimo: si enumerano tutte.
  const blocchi: { blocco: PlanPick[]; costo: number; punteggio: number }[] = []
  const combina = (da: number, blocco: PlanPick[]) => {
    if (blocco.length === quanti) {
      blocchi.push({
        blocco,
        costo: blocco.reduce((n, c) => n + c.expPrice, 0),
        punteggio: punteggio(blocco),
      })
      return
    }
    for (let i = da; i < bacino.length; i++) combina(i + 1, [...blocco, bacino[i]])
  }
  combina(0, [])

  const dentroTetto = blocchi.filter((b) => b.costo <= tetto).sort((a, b) => b.punteggio - a.punteggio)
  const piuEconomico = [...blocchi].sort((a, b) => a.costo - b.costo)[0]
  const migliore = dentroTetto[0] ?? piuEconomico
  if (!migliore) return { picks: fillRole(pool, need, budget) }
  const scelto = migliore.blocco

  const presi = new Set(scelto.map((c) => c.player.id))
  const picks = [
    ...scelto,
    ...pool
      .filter((c) => !presi.has(c.player.id))
      .sort((a, b) => a.expPrice - b.expPrice)
      .slice(0, need - scelto.length),
  ]

  return {
    picks,
    abbinamento: `${scelto.map((c) => c.player.cod).join(' + ')} · ${totTrasferte(scelto)} tras. in comune`,
    nota: dentroTetto.length
      ? undefined
      : `Nessun blocco di portieri entra nella quota: preso il piu economico (${migliore.costo} cr).`,
  }
}

/** Allocazione libera: prende sempre il miglior FVM per credito tra i reparti che servono. */
function fillByValue(
  pools: Record<Role, PlanPick[]>,
  need: Record<Role, number>,
  budget: number,
  soglia: number,
  maxTop: Record<Role, number>,
): Record<Role, PlanPick[]> {
  const out = {} as Record<Role, PlanPick[]>
  for (const r of ROLES) out[r] = []

  const all = ROLES.flatMap((r) => pools[r].map((c) => ({ c, r }))).sort(
    (a, b) => b.c.fvm / b.c.expPrice - a.c.fvm / a.c.expPrice,
  )

  let slotsLeft = ROLES.reduce((n, r) => n + need[r], 0)
  let cost = 0
  const minimo = {} as Record<Role, number>
  for (const r of ROLES) minimo[r] = pools[r].length ? Math.min(...pools[r].map((c) => c.expPrice)) : 1
  // Riserva: il minimo necessario per coprire tutti gli slot ancora vuoti.
  const riserva = (escluso: Role) =>
    ROLES.reduce((n, r) => n + Math.max(0, need[r] - out[r].length - (r === escluso ? 1 : 0)) * minimo[r], 0)

  for (const { c, r } of all) {
    if (slotsLeft === 0) break
    if (out[r].length >= need[r]) continue
    if (c.expPrice >= soglia && contaTop(out[r], soglia) >= maxTop[r]) continue
    if (cost + c.expPrice > budget - riserva(r)) continue
    out[r].push(c)
    cost += c.expPrice
    slotsLeft--
  }

  for (const r of ROLES) {
    if (out[r].length >= need[r]) continue
    const presi = new Set(out[r].map((t) => t.player.id))
    for (const c of [...pools[r]].sort((a, b) => a.expPrice - b.expPrice)) {
      if (out[r].length >= need[r]) break
      if (presi.has(c.player.id)) continue
      out[r].push(c)
    }
  }

  return out
}

/**
 * Prende le N ancore (i migliori per FVM tra i reparti che servono) e completa
 * il resto al minimo: la strategia "tre intoccabili e tutti gli altri a 1".
 */
function fillByAncore(
  pools: Record<Role, PlanPick[]>,
  need: Record<Role, number>,
  budget: number,
  quante: number,
  soglia: number,
  maxTop: Record<Role, number>,
): Record<Role, PlanPick[]> {
  const out = {} as Record<Role, PlanPick[]>
  for (const r of ROLES) out[r] = []

  const candidati = ROLES.flatMap((r) => pools[r].map((c) => ({ c, r }))).sort((a, b) => b.c.fvm - a.c.fvm)

  let cost = 0
  let prese = 0
  const minimo = {} as Record<Role, number>
  for (const r of ROLES) minimo[r] = pools[r].length ? Math.min(...pools[r].map((c) => c.expPrice)) : 1
  const riserva = (escluso: Role) =>
    ROLES.reduce((n, r) => n + Math.max(0, need[r] - out[r].length - (r === escluso ? 1 : 0)) * minimo[r], 0)

  for (const { c, r } of candidati) {
    if (prese === quante) break
    if (out[r].length >= need[r]) continue
    if (c.expPrice >= soglia && contaTop(out[r], soglia) >= maxTop[r]) continue
    if (cost + c.expPrice > budget - riserva(r)) continue
    out[r].push(c)
    cost += c.expPrice
    prese++
  }

  // Tutto il resto al prezzo minimo.
  for (const r of ROLES) {
    const presi = new Set(out[r].map((t) => t.player.id))
    for (const c of [...pools[r]].sort((a, b) => a.expPrice - b.expPrice)) {
      if (out[r].length >= need[r]) break
      if (presi.has(c.player.id)) continue
      out[r].push(c)
    }
  }

  return out
}

/** Quanti candidati per reparto vale la pena considerare negli upgrade. */
const UPGRADE_POOL = 40
const UPGRADE_STEPS = 40

/**
 * Investe i crediti avanzati migliorando i giocatori gia scelti: a ogni passo
 * fa lo scambio con il miglior guadagno di FVM per credito aggiuntivo.
 *
 * Serve perche un piano che lascia crediti sul tavolo non e un piano: dopo la
 * prima passata per reparto restano quasi sempre crediti inutilizzati.
 */
function upgrade(
  perRole: Record<Role, PlanPick[]>,
  pools: Record<Role, PlanPick[]>,
  roles: Role[],
  budget: number,
  tetto = Infinity,
  /** Se presente, non sostituisce mai un giocatore che lo soddisfa con uno che no. */
  proteggi?: (p: Player) => boolean,
  /** Spesa massima per reparto: tiene in piedi le quote della strategia. */
  soffitto?: Partial<Record<Role, number>>,
  /** Tetto ai giocatori di fascia alta per reparto. */
  limiteTop?: { soglia: number; max: Record<Role, number> },
): number {
  let residuo = budget
  const costoRuolo = (r: Role) => perRole[r].reduce((n, c) => n + c.expPrice, 0)

  for (let step = 0; step < UPGRADE_STEPS && residuo > 0; step++) {
    let best: { role: Role; esce: PlanPick; entra: PlanPick; costo: number; guadagno: number } | null = null

    for (const r of roles) {
      const scelti = perRole[r]
      if (!scelti.length) continue
      const presi = new Set(scelti.map((c) => c.player.id))

      for (const cand of pools[r].slice(0, UPGRADE_POOL)) {
        if (presi.has(cand.player.id)) continue
        if (cand.expPrice > tetto) continue
        for (const cur of scelti) {
          if (proteggi && proteggi(cur.player) && !proteggi(cand.player)) continue
          const costo = cand.expPrice - cur.expPrice
          const guadagno = cand.fvm - cur.fvm
          if (costo <= 0 || guadagno <= 0 || costo > residuo) continue
          const max = soffitto?.[r]
          if (max != null && costoRuolo(r) + costo > max) continue
          if (limiteTop) {
            const dopo =
              contaTop(perRole[r], limiteTop.soglia) -
              (cur.expPrice >= limiteTop.soglia ? 1 : 0) +
              (cand.expPrice >= limiteTop.soglia ? 1 : 0)
            if (dopo > limiteTop.max[r]) continue
          }
          if (!best || guadagno / costo > best.guadagno / best.costo) {
            best = { role: r, esce: cur, entra: cand, costo, guadagno }
          }
        }
      }
    }

    if (!best) break
    const scelto = best
    perRole[scelto.role] = perRole[scelto.role].map((c) =>
      c.player.id === scelto.esce.player.id ? scelto.entra : c,
    )
    residuo -= scelto.costo
  }

  return residuo
}

export interface PlanInput {
  /** Giocatori ancora liberi. */
  available: Player[]
  team: TeamStats
  prezzo: PrezzoAtteso
  /** Prezzo oltre il quale un giocatore e di fascia alta, calcolato sul budget di lega. */
  sogliaTop: number
}

/**
 * Costruisce il pool di un reparto. Con un filtro attivo tiene i giocatori che
 * lo soddisfano piu i piu economici tra gli altri: garantisce che gli slot si
 * riempiano comunque, anche quando i rigoristi liberi sono finiti.
 */
function buildPool(
  available: Player[],
  role: Role,
  prezzo: PrezzoAtteso,
  need: number,
  strategy: Strategy,
  /** Tetto in crediti, gia calcolato sul budget del piano. */
  tetto?: number,
): PlanPick[] {
  let base = available
    .filter((p) => p.r === role)
    .map((p) => ({ player: p, expPrice: prezzo(p), fvm: fvm(p) }))

  // I portieri hanno la regola della coppia: nessun vincolo di prezzo ne filtro,
  // altrimenti la riserva da 1 credito verrebbe esclusa.
  if (role === 'P') {
    base.sort((a, b) => b.fvm - a.fvm)
    return base
  }

  // Vincoli di prezzo: si allentano se non lasciano abbastanza candidati.
  for (const limite of [
    tetto != null ? (c: PlanPick) => c.expPrice <= tetto : null,
    strategy.minimo != null ? (c: PlanPick) => c.expPrice >= strategy.minimo! : null,
  ]) {
    if (!limite) continue
    const dentro = base.filter(limite)
    if (dentro.length >= need) base = dentro
  }

  base.sort((a, b) => b.fvm - a.fvm)
  if (!strategy.filtro) return base

  // Con un filtro attivo l'ordine mette davanti chi lo soddisfa, ma il pool
  // resta completo: i rigoristi liberi non bastano per 25 slot, e un piano
  // deve comunque riempirli tutti.
  const test = FILTRI[strategy.filtro]
  return [...base.filter((c) => test(c.player)), ...base.filter((c) => !test(c.player))]
}

export function buildPlan(strategy: Strategy, { available, team, prezzo, sogliaTop }: PlanInput): Plan {
  const need = {} as Record<Role, number>
  for (const r of ROLES) need[r] = team.byRole[r].left

  // Il piano copre solo gli slot mancanti, quindi il budget e quello residuo.
  const budgetPieno = Math.max(0, team.remaining)
  const budget = strategy.uso ? Math.round(budgetPieno * strategy.uso) : budgetPieno
  const tettoGiocatore = strategy.tetto ? Math.max(1, Math.round(budget * strategy.tetto)) : undefined

  const pools = {} as Record<Role, PlanPick[]>
  for (const r of ROLES) {
    pools[r] = buildPool(available, r, prezzo, need[r], strategy, tettoGiocatore)
  }
  const proteggi = strategy.filtro ? FILTRI[strategy.filtro] : undefined

  // Tetto ai giocatori di fascia alta: due centrocampisti e un attaccante top
  // sono la media reale di una rosa, il budget da solo non lo impedisce.
  const soglia = sogliaTop
  const maxTop = { ...MAX_TOP, ...strategy.maxTop } as Record<Role, number>
  const limiteTop = { soglia, max: maxTop }

  let perRole: Record<Role, PlanPick[]>
  let budgets: Record<Role, number>

  if (strategy.ancore) {
    perRole = fillByAncore(pools, need, budget, strategy.ancore, soglia, maxTop)
    budgets = {} as Record<Role, number>
  } else if (strategy.quote) {
    budgets = splitBudget(budget, strategy.quote, need)
    perRole = {} as Record<Role, PlanPick[]>
    for (const r of ROLES) {
      perRole[r] = need[r] > 0 ? fillRole(pools[r], need[r], budgets[r], soglia, maxTop[r]) : []
    }
  } else {
    perRole = fillByValue(pools, need, budget, soglia, maxTop)
    budgets = {} as Record<Role, number>
  }

  // La regola della coppia portieri vale per tutte le strategie.
  const budgetP = budgets.P ?? perRole.P.reduce((n, c) => n + c.expPrice, 0)
  const portieri = fillPortieri(pools.P, need.P, Math.max(budgetP, need.P))
  perRole.P = portieri.picks

  const attivi = ROLES.filter((r) => need[r] > 0)
  const costoDi = (r: Role) => perRole[r].reduce((n, c) => n + c.expPrice, 0)
  const spesoTot = () => ROLES.reduce((n, r) => n + costoDi(r), 0)

  /**
   * Gli arrotondamenti della riserva possono far sfondare il budget di qualche
   * credito. Si scende sul giocatore che costa la sostituzione piu' indolore:
   * risparmio appena sufficiente, minima perdita di FVM. Va fatto PRIMA degli
   * upgrade, cosi' l'avanzo torna positivo e i crediti si reinvestono.
   */
  const rientraNelBudget = () => {
    for (let giro = 0; giro < 20; giro++) {
      const sfora = spesoTot() - budget
      if (sfora <= 0) return
      let scelta: { role: Role; esce: PlanPick; entra: PlanPick; perdita: number; risparmio: number } | null = null

      for (const r of attivi) {
        const presi = new Set(perRole[r].map((c) => c.player.id))
        for (const cur of perRole[r]) {
          for (const cand of pools[r]) {
            if (presi.has(cand.player.id)) continue
            const risparmio = cur.expPrice - cand.expPrice
            if (risparmio < sfora) continue
            const perdita = cur.fvm - cand.fvm
            if (
              scelta &&
              (perdita > scelta.perdita || (perdita === scelta.perdita && risparmio >= scelta.risparmio))
            ) {
              continue
            }
            scelta = { role: r, esce: cur, entra: cand, perdita, risparmio }
          }
        }
      }

      if (!scelta) return
      const s = scelta
      perRole[s.role] = perRole[s.role].map((c) => (c.player.id === s.esce.player.id ? s.entra : c))
    }
  }

  rientraNelBudget()

  // Reinveste l'avanzo, ma non sui portieri: la coppia non si tocca.
  const upgradabili = attivi.filter((r) => r !== 'P')
  if (upgradabili.length) {
    const avanzo = budget - spesoTot()
    if (avanzo > 0) {
      const extra = strategy.quote
        ? splitBudget(avanzo, strategy.quote, need)
        : upgradabili.reduce(
            (acc, r) => {
              acc[r] = avanzo / upgradabili.length
              return acc
            },
            {} as Record<Role, number>,
          )

      // Con le quote il soffitto per reparto sopravvive agli upgrade, altrimenti
      // ogni strategia finirebbe sulla stessa rosa: quella a FVM massimo.
      const soffitto = strategy.quote
        ? upgradabili.reduce(
            (acc, r) => {
              acc[r] = ((budgets[r] ?? 0) + (extra[r] ?? 0)) * 1.5
              return acc
            },
            {} as Partial<Record<Role, number>>,
          )
        : undefined

      for (const r of upgradabili) {
        upgrade(
          perRole,
          pools,
          [r],
          Math.floor(extra[r] ?? 0),
          tettoGiocatore ?? Infinity,
          proteggi,
          soffitto,
          limiteTop,
        )
      }
      const resto = budget - spesoTot()
      if (resto > 0) {
        upgrade(perRole, pools, upgradabili, resto, tettoGiocatore ?? Infinity, proteggi, soffitto, limiteTop)
      }
    }
  }

  rientraNelBudget()

  const roles: RolePlan[] = ROLES.map((r) => ({
    role: r,
    need: need[r],
    budget: Math.round(budgets[r] ?? costoDi(r)),
    picks: perRole[r],
    cost: costoDi(r),
    nota: r === 'P' ? portieri.nota : undefined,
  }))

  const picks = roles.flatMap((r) => r.picks)
  const cost = picks.reduce((n, c) => n + c.expPrice, 0)
  const slotsMancanti = ROLES.reduce((n, r) => n + need[r], 0)
  const totalFvm = picks.reduce((n, c) => n + c.fvm, 0)

  return {
    strategy,
    roles,
    picks,
    budget: budgetPieno,
    cost,
    residuo: budgetPieno - cost,
    totalFvm,
    copertura: slotsMancanti > 0 ? picks.length / slotsMancanti : 1,
    totalFvmRosa: totalFvm + team.totalFvm,
    rigoristi: picks.filter((c) => c.player.rig != null).length,
    titolari: picks.filter((c) => c.player.gerarchia === 'Titolare').length,
    top: ROLES.reduce(
      (acc, r) => {
        acc[r] = contaTop(perRole[r], soglia)
        return acc
      },
      {} as Record<Role, number>,
    ),
    sogliaTop: soglia,
    aPocoPrezzo: picks.filter((c) => c.expPrice <= 2).length,
    abbinamentoPortieri: portieri.abbinamento,
  }
}

export function buildPlans(input: PlanInput): Plan[] {
  return STRATEGIES.map((s) => buildPlan(s, input))
}
