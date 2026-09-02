export type Role = 'P' | 'D' | 'C' | 'A'

export const ROLES: Role[] = ['P', 'D', 'C', 'A']

export const ROLE_LABEL: Record<Role, string> = {
  P: 'Portieri',
  D: 'Difensori',
  C: 'Centrocampisti',
  A: 'Attaccanti',
}

/** Le sei fasce del listone, dalla piu alta alla piu bassa. */
export type Fascia = 'Top' | '1a fascia' | '2a fascia' | '3a fascia' | '4a fascia' | 'Scommessa'

export const FASCE: Fascia[] = ['Top', '1a fascia', '2a fascia', '3a fascia', '4a fascia', 'Scommessa']

/** Etichetta corta per i chip dei filtri e i badge di riga. */
export const FASCIA_SHORT: Record<Fascia, string> = {
  Top: 'Top',
  '1a fascia': '1a',
  '2a fascia': '2a',
  '3a fascia': '3a',
  '4a fascia': '4a',
  Scommessa: 'Scom',
}

export type Gerarchia = 'Titolare' | 'Ballottaggio' | 'Riserva'

/** Statistiche 2025/26, assenti per chi non era in Serie A. */
export interface Stagione25 {
  pg: number
  mv: number | null
  fm: number | null
  gol: number
  ass: number
  /** Rigori "segnati/calciati". */
  rig: string
  amm: number
  esp: number
  /** Squadra in cui giocava: '-' nel workbook diventa stringa vuota. */
  squadra: string
}

/** Le prime giornate della stagione in corso. */
export interface Stagione26 {
  pg: number
  mv: number | null
  fm: number | null
  gol: number
  ass: number
}

export interface Infortunio {
  /** Categoria dal foglio Infortunati, vuota se si conosce solo il dettaglio. */
  stato: string
  dettaglio: string
}

export interface Player {
  id: number
  /** Chiave del workbook: "Svilar (ROM)". */
  chiave: string
  r: Role
  nome: string
  squadra: string
  /** Sigla a tre lettere della squadra. */
  cod: string
  /** Ruolo Mantra per esteso, es. "Esterno basso / Esterno alto". */
  rm: string

  /** Priorita nel reparto: 1 e il primo della lista. */
  prio: number
  /** Indice di priorita 0-100 calcolato nel workbook. */
  indice: number
  /** Posizione per FVM dentro il reparto. */
  rankFvm: number

  qtI: number
  qtA: number
  fvm: number
  /** Prezzo consigliato dal workbook per la lega da 500 crediti. */
  cons: number
  /** Oltre questo prezzo stai pagando troppo, secondo il listone. */
  max: number

  fascia: Fascia
  /** Indice della fascia: 0 = Top. Serve per ordinare. */
  fasciaIdx: number
  gerarchia: Gerarchia
  /** Nota di stato: titolarita, infortunio, ballottaggio. */
  nota: string

  /** 1 = primo rigorista, 2 = seconda scelta, e cosi via. */
  rig: number | null
  /** Ordine tra i tiratori da fermo. */
  piaz: number | null
  /** Fantamedia 2025/26 ponderata sulle presenze. */
  fmPond: number
  /** Cambia squadra rispetto al 2025/26 o arriva da fuori Serie A. */
  nuovo: boolean

  /** Miglior abbinamento secondo il workbook: chiave e id, quando risolto. */
  abb: string
  abbId: number | null
  /** Trasferte in comune con l'abbinamento del workbook. */
  abbTras: number

  s25: Stagione25 | null
  s26: Stagione26
  inf?: Infortunio
}

/** Coppia di squadre dalle classifiche del workbook. */
export interface CoppiaSquadre {
  a: string
  b: string
  /** Giornate su 38 in cui giocano entrambe in trasferta. */
  t: number
  giudizio: string
}

/** Terzetto di portieri consigliato dal workbook. */
export interface TerzettoListone {
  /** Le tre chiavi giocatore. */
  p: [string, string, string]
  /** Trasferte in comune delle tre coppie: 1+2, 1+3, 2+3. */
  t: [number, number, number]
  tot: number
  costo: number
  indice: number
}

export interface Listone {
  stagione: string
  descrizione: string
  sorgente: string
  generatoIl: string
  parametri: {
    budget: number
    squadre: number
    slots: Record<Role, number>
    quotaReparto: Record<Role, number>
    compressione: number | null
  }
  guida: {
    /** Voci [etichetta, spiegazione] della legenda delle note. */
    legendaNota: [string, string][]
    metodo: [string, string][]
  }
  conteggi: Record<Role, number>
  fasce: Fascia[]
  squadre: string[]
  sigle: Record<string, string>
  /** Trasferte in comune: matrice[squadraA][squadraB], giornate su 38. */
  matrice: Record<string, Record<string, number>>
  coppieMigliori: CoppiaSquadre[]
  coppiePeggiori: CoppiaSquadre[]
  terzettiPortieri: TerzettoListone[]
  comeSiLegge: string
  giocatori: Player[]
}

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
  budget: number
  slots: Record<Role, number>
  /** Quanto e aggressiva la lega sui top: scala il listino d'asta. */
  temperatura: 'freddo' | 'normale' | 'caldo'
}
