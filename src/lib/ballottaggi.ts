import { players } from './listone'
import type { Player } from '../types'

/**
 * Chi si gioca il posto con chi.
 *
 * Il workbook stima la gerarchia dalla quotazione dentro la stessa squadra e
 * ruolo. Funziona sui portieri, dove il titolare costa sempre piu' della
 * riserva, ma sbaglia spesso in mezzo al campo: un titolare che il mercato non
 * valuta sembra una riserva. Per questo il conteggio `fonti` — quante delle
 * probabili formazioni raccolte in data/formazioni-tipo.json lo mettono
 * nell'undici — viene prima della quotazione nell'ordinamento.
 *
 * Il gruppo di confronto e' **squadra + ruolo Mantra**: due giocatori con lo
 * stesso ruolo esteso ("Difensore centrale", "Terzino sinistro / Esterno
 * basso") nella stessa squadra si contendono lo stesso posto. Il ruolo Classic
 * sarebbe troppo grosso — otto difensori in una squadra non sono tutti
 * alternative l'uno dell'altro.
 */

/** Quante fonti bastano per considerare un giocatore titolare. */
const FONTI_TITOLARE = 2

const RANK_GERARCHIA: Record<string, number> = { Titolare: 0, Ballottaggio: 1, Riserva: 2 }

export interface Ballottaggio {
  /** Il gruppo che si contende il posto, dal titolare all'ultima riserva. */
  gruppo: Player[]
  /** Chi, dentro il gruppo, parte titolare. */
  titolari: Player[]
  /** true se il giocatore in esame e' fra i titolari. */
  parte: boolean
  /** La riserva diretta, se il giocatore parte titolare. */
  riserva: Player | null
  /** Il titolare davanti a lui, se il giocatore non parte. */
  titolare: Player | null
}

/** L'ordine dentro un gruppo: prima il consenso delle fonti, poi il workbook. */
function ordina(a: Player, b: Player): number {
  return (
    b.fonti - a.fonti ||
    (RANK_GERARCHIA[a.gerarchia] ?? 3) - (RANK_GERARCHIA[b.gerarchia] ?? 3) ||
    b.qtA - a.qtA ||
    b.indice - a.indice
  )
}

/**
 * I gruppi si calcolano una volta sul listone intero, non sui giocatori ancora
 * liberi: un ballottaggio resta tale anche quando uno dei due e' gia' stato
 * comprato — anzi, e' proprio allora che serve saperlo.
 */
const gruppi = new Map<string, Player[]>()
for (const p of players) {
  const chiave = `${p.squadra}|${p.rm}`
  const lista = gruppi.get(chiave)
  if (lista) lista.push(p)
  else gruppi.set(chiave, [p])
}
for (const lista of gruppi.values()) lista.sort(ordina)

/**
 * Chi parte titolare nel gruppo, in ordine di attendibilita' della prova:
 *
 * 1. chi e' nell'undici di entrambe le fonti;
 * 2. se nessuno ha il pieno consenso, chi ne ha di piu' — una fonte su due
 *    resta una formazione vera, e vale piu' di una gerarchia dedotta dai
 *    prezzi (e' il caso di Yildiz, che una fonte schiera e il workbook, che
 *    guarda solo la quotazione, mette dietro a Woltemade);
 * 3. senza nessuna fonte, la gerarchia del workbook;
 * 4. e in ultimo il primo della lista: un posto lo occupa qualcuno.
 */
function titolariDi(gruppo: Player[]): Player[] {
  const daFonti = gruppo.filter((p) => p.fonti >= FONTI_TITOLARE)
  if (daFonti.length) return daFonti

  const massimo = Math.max(...gruppo.map((p) => p.fonti))
  if (massimo > 0) return gruppo.filter((p) => p.fonti === massimo)

  const daWorkbook = gruppo.filter((p) => p.gerarchia === 'Titolare')
  if (daWorkbook.length) return daWorkbook

  return gruppo.slice(0, 1)
}

const cache = new Map<number, Ballottaggio | null>()

/**
 * Il ballottaggio di un giocatore, o null se nella sua squadra non ha nessuno
 * con lo stesso ruolo: in quel caso non c'e' alternanza da leggere.
 */
export function ballottaggioDi(p: Player): Ballottaggio | null {
  const memo = cache.get(p.id)
  if (memo !== undefined) return memo

  const gruppo = gruppi.get(`${p.squadra}|${p.rm}`) ?? []
  if (gruppo.length < 2) {
    cache.set(p.id, null)
    return null
  }

  const titolari = titolariDi(gruppo)
  const parte = titolari.some((x) => x.id === p.id)

  // Chi parte guarda al primo che non parte: e' lui che entra se salta.
  // Chi non parte guarda all'ultimo dei titolari: e' il posto piu' vicino.
  const riserva = parte ? (gruppo.find((x) => !titolari.some((t) => t.id === x.id)) ?? null) : null
  const titolare = parte ? null : (titolari[titolari.length - 1] ?? null)

  const out: Ballottaggio = { gruppo, titolari, parte, riserva, titolare }
  cache.set(p.id, out)
  return out
}

/** Etichetta del consenso delle fonti, per spiegare da dove viene la gerarchia. */
export function etichettaFonti(p: Player): string {
  if (p.fonti >= 2) return 'nell undici di entrambe le fonti'
  if (p.fonti === 1) return 'nell undici di una fonte su due'
  return 'in nessuna delle due formazioni tipo'
}
