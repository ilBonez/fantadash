export type Role = 'P' | 'D' | 'C' | 'A'

export const ROLES: Role[] = ['P', 'D', 'C', 'A']

export const ROLE_LABEL: Record<Role, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}

export interface Player {
  id: number
  r: Role
  /** Ruoli Mantra (Por, Dc, E, M, C, T, W, A, Pc). */
  rm: string[]
  nome: string
  squadra: string
  /** Quotazione attuale / iniziale classic. */
  qtA: number
  qtI: number
  diff: number
  /** Quotazione attuale / iniziale Mantra. */
  qtAM: number
  qtIM: number
  diffM: number
  /** Fanta Valore di Mercato. */
  fvm: number
  fvmM: number
  /** Presente nel foglio "Ceduti": non piu in Serie A. */
  ceduto: boolean

  // --- dati curati da data/extra.json (tutti opzionali) ---
  /** Nella formazione tipo della sua squadra. */
  titolare?: boolean
  /** 1 = primo rigorista, 2 = alternativa dal dischetto. */
  rigorista?: 1 | 2
  /** Tra i tiratori di punizioni. */
  punizioni?: boolean
  /** Tra i tiratori di calci d'angolo. */
  angoli?: boolean
  /** Gol segnati finora in campionato. */
  gol?: number
  /** Prezzo di mercato atteso all'asta, quando si sa che sfonda la quotazione. */
  atteso?: number
  /** Nota libera mostrata come tooltip. */
  nota?: string
  /** Fantamedia della stagione 2025/26, dove disponibile. */
  fm2025?: number
  /** Gol segnati nella stagione 2025/26. */
  gol2025?: number
}

export interface Listone {
  stagione: string
  sorgente: string
  /** ISO 8601 UTC scritto dallo script di ingest. */
  generatoIl?: string
  conteggi: Record<Role, number>
  ceduti: number
  /** Note per squadra dall'overlay curato: ballottaggi, gerarchie incerte. */
  noteSquadre?: Record<string, string>
  giocatori: Player[]
}

export type Mode = 'classic' | 'mantra'

export interface Team {
  id: string
  nome: string
  /** Se presente, sovrascrive il budget di lega per questa squadra. */
  budgetOverride?: number
}

export interface Pick {
  playerId: number
  teamId: string
  price: number
  ts: number
}

export interface Settings {
  lega: string
  mode: Mode
  budget: number
  slots: Record<Role, number>
  /** Quanto e aggressiva la lega sui top: scala il listino d'asta. */
  temperatura: 'freddo' | 'normale' | 'caldo'
}
