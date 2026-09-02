import { indiceMax, trasferteComuni } from './listone'
import type { Player, Role } from '../types'
import { ROLES } from '../types'

/**
 * Abbinamenti di calendario: chi mettere in rosa insieme a chi.
 *
 * Il numero che conta e' quante volte, nelle 38 giornate, due squadre giocano
 * ENTRAMBE in trasferta. Piu e' basso, piu i due giocatori si coprono a
 * vicenda: quando uno e' fuori casa l'altro quasi sempre e' in casa, quindi
 * ruotandoli in formazione si gioca quasi sempre quello favorito.
 *
 * Il workbook porta gia un abbinamento fisso per ogni giocatore (`p.abb`) e la
 * classifica dei terzetti di portieri. Qui si ricalcola la stessa idea sui
 * giocatori ANCORA LIBERI: durante l'asta il partner ideale sparisce appena
 * qualcun altro lo compra, e serve sapere subito chi resta.
 *
 * Le due grandezze in gioco sono su scale diverse, quindi si normalizzano
 * entrambe in 0-1 e si pesano:
 *
 * - qualita = indice di priorita / indice massimo del reparto;
 * - copertura = quanto sono lontane le trasferte in comune dal caso peggiore.
 *
 * Sul totale di un terzetto vale un'identita del calendario: se due squadre non
 * vanno MAI in trasferta insieme (i derby di citta: Inter-Milan, Roma-Lazio,
 * Juventus-Torino) allora una terza squadra qualsiasi divide le sue 19
 * trasferte fra le due, e la somma delle tre coppie fa esattamente 19. E' il
 * minimo possibile: per questo i terzetti migliori contengono sempre un derby.
 */

/** Peso della qualita del giocatore rispetto alla copertura di calendario. */
const PESO_QUALITA = 0.6

/** Somma minima e massima delle trasferte in comune di un terzetto. */
const TOT_MIN = 19
const TOT_MAX = 57

/**
 * Quanti candidati per reparto entrano nel calcolo, ordinati per indice.
 * Il partner ideale non e' mai il 150esimo difensore libero, e limitare il
 * bacino tiene la ricerca del terzetto (quadratica) nell'ordine dei millisecondi.
 */
const BACINO = 40

const copertura2 = (t: number) => Math.max(0, (19 - t) / 19)
const copertura3 = (tot: number) => Math.max(0, (TOT_MAX - tot) / (TOT_MAX - TOT_MIN))

const qualita = (p: Player) => Math.min(1, p.indice / indiceMax[p.r])

export interface Coppia {
  partner: Player
  /** Trasferte in comune fra le due squadre, su 38. */
  t: number
  punteggio: number
}

export interface Terzetto {
  /** I due compagni, oltre al giocatore di partenza. */
  altri: [Player, Player]
  /** Trasferte in comune delle tre coppie, nell'ordine 1+2, 1+3, 2+3. */
  t: [number, number, number]
  tot: number
  punteggio: number
}

export interface Abbinamento {
  coppia: Coppia | null
  terzetto: Terzetto | null
}

/** Giudizio testuale su una coppia, con le stesse soglie del workbook. */
export function giudizio(t: number): { label: string; tono: 'ottimo' | 'buono' | 'medio' | 'male' } {
  if (t <= 3) return { label: 'Perfetto', tono: 'ottimo' }
  if (t <= 6) return { label: 'Ottimo', tono: 'buono' }
  if (t <= 10) return { label: 'Nella media', tono: 'medio' }
  return { label: 'Da evitare', tono: 'male' }
}

/**
 * Calcola coppia e terzetto migliori per ogni giocatore disponibile.
 *
 * `disponibili` sono i giocatori ancora liberi: e' l'unico ingresso che cambia
 * durante l'asta, quindi la mappa si rigenera a ogni assegnazione.
 */
export function abbinamentiPerRuolo(disponibili: Player[]): Map<number, Abbinamento> {
  const out = new Map<number, Abbinamento>()

  for (const r of ROLES) {
    const bacino = disponibili
      .filter((p) => p.r === r)
      .sort((a, b) => b.indice - a.indice)
      .slice(0, BACINO)

    if (bacino.length < 2) continue

    // Le trasferte in comune dipendono solo dalle squadre: le si calcola una
    // volta per il bacino invece di rifarle dentro il doppio ciclo.
    const t = bacino.map((a) => bacino.map((b) => trasferteComuni(a.squadra, b.squadra)))
    const q = bacino.map(qualita)

    for (const p of disponibili.filter((x) => x.r === r)) {
      // Un giocatore fuori dal bacino si abbina comunque ai migliori liberi.
      const suoT = bacino.map((b) => trasferteComuni(p.squadra, b.squadra))
      const escludi = bacino.findIndex((b) => b.id === p.id)

      let coppia: Coppia | null = null
      for (let i = 0; i < bacino.length; i++) {
        if (i === escludi) continue
        const punteggio = PESO_QUALITA * q[i] + (1 - PESO_QUALITA) * copertura2(suoT[i])
        if (!coppia || punteggio > coppia.punteggio) {
          coppia = { partner: bacino[i], t: suoT[i], punteggio }
        }
      }

      let terzetto: Terzetto | null = null
      for (let i = 0; i < bacino.length; i++) {
        if (i === escludi) continue
        for (let j = i + 1; j < bacino.length; j++) {
          if (j === escludi) continue
          const tot = suoT[i] + suoT[j] + t[i][j]
          const media = (q[i] + q[j]) / 2
          const punteggio = PESO_QUALITA * media + (1 - PESO_QUALITA) * copertura3(tot)
          if (!terzetto || punteggio > terzetto.punteggio) {
            terzetto = {
              altri: [bacino[i], bacino[j]],
              t: [suoT[i], suoT[j], t[i][j]],
              tot,
              punteggio,
            }
          }
        }
      }

      out.set(p.id, { coppia, terzetto })
    }
  }

  return out
}

export interface GrigliaCoppia {
  giocatori: [Player, Player]
  t: number
  costo: number
  indiceMedio: number
}

/**
 * Quante volte lo stesso giocatore puo comparire nelle griglie.
 *
 * Senza questo limite il miglior giocatore del reparto si prende quasi tutte le
 * righe, perche la qualita pesa piu della copertura: la classifica sarebbe
 * corretta e inutile da leggere.
 */
const MAX_RIPETIZIONI = 3

/** Tiene le combinazioni migliori evitando che un solo nome occupi la lista. */
function selezionaVarie<T extends { giocatori: readonly Player[] }>(
  ordinate: T[],
  quanti: number,
): T[] {
  const usi = new Map<number, number>()
  const out: T[] = []
  for (const riga of ordinate) {
    if (out.length >= quanti) break
    if (riga.giocatori.some((p) => (usi.get(p.id) ?? 0) >= MAX_RIPETIZIONI)) continue
    for (const p of riga.giocatori) usi.set(p.id, (usi.get(p.id) ?? 0) + 1)
    out.push(riga)
  }
  return out
}

/** Le migliori coppie del reparto fra i giocatori liberi, per la vista Griglie. */
export function miglioriCoppie(disponibili: Player[], r: Role, quanti = 20): GrigliaCoppia[] {
  const bacino = disponibili
    .filter((p) => p.r === r)
    .sort((a, b) => b.indice - a.indice)
    .slice(0, 24)

  const out: (GrigliaCoppia & { punteggio: number })[] = []
  for (let i = 0; i < bacino.length; i++) {
    for (let j = i + 1; j < bacino.length; j++) {
      const a = bacino[i]
      const b = bacino[j]
      const t = trasferteComuni(a.squadra, b.squadra)
      out.push({
        giocatori: [a, b],
        t,
        costo: a.cons + b.cons,
        indiceMedio: (a.indice + b.indice) / 2,
        punteggio: PESO_QUALITA * ((qualita(a) + qualita(b)) / 2) + (1 - PESO_QUALITA) * copertura2(t),
      })
    }
  }

  return selezionaVarie(out.sort((x, y) => y.punteggio - x.punteggio), quanti)
}

export interface GrigliaTerzetto {
  giocatori: [Player, Player, Player]
  t: [number, number, number]
  tot: number
  costo: number
  indiceMedio: number
}

/**
 * I migliori terzetti del reparto fra i giocatori liberi, per la vista Griglie.
 * Ordinati per punteggio, con il costo consigliato del blocco.
 */
export function miglioriTerzetti(disponibili: Player[], r: Role, quanti = 20): GrigliaTerzetto[] {
  const bacino = disponibili
    .filter((p) => p.r === r)
    .sort((a, b) => b.indice - a.indice)
    .slice(0, 24)

  const out: (GrigliaTerzetto & { punteggio: number })[] = []
  for (let i = 0; i < bacino.length; i++) {
    for (let j = i + 1; j < bacino.length; j++) {
      for (let k = j + 1; k < bacino.length; k++) {
        const a = bacino[i]
        const b = bacino[j]
        const c = bacino[k]
        const t: [number, number, number] = [
          trasferteComuni(a.squadra, b.squadra),
          trasferteComuni(a.squadra, c.squadra),
          trasferteComuni(b.squadra, c.squadra),
        ]
        const tot = t[0] + t[1] + t[2]
        const media = (qualita(a) + qualita(b) + qualita(c)) / 3
        out.push({
          giocatori: [a, b, c],
          t,
          tot,
          costo: a.cons + b.cons + c.cons,
          indiceMedio: (a.indice + b.indice + c.indice) / 3,
          punteggio: PESO_QUALITA * media + (1 - PESO_QUALITA) * copertura3(tot),
        })
      }
    }
  }

  return selezionaVarie(out.sort((x, y) => y.punteggio - x.punteggio), quanti)
}

/** Le coppie di squadre migliori e peggiori, ricavate dalla matrice. */
export function coppieSquadre(squadre: string[]): { a: string; b: string; t: number }[] {
  const out: { a: string; b: string; t: number }[] = []
  for (let i = 0; i < squadre.length; i++) {
    for (let j = i + 1; j < squadre.length; j++) {
      out.push({ a: squadre[i], b: squadre[j], t: trasferteComuni(squadre[i], squadre[j]) })
    }
  }
  return out.sort((x, y) => x.t - y.t)
}
