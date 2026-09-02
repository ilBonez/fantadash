import { players } from './listone'
import { leggiXlsx, type Foglio, type Riga } from './xlsxLite'
import { ROLES, type Pick, type Player, type Role, type Team } from '../types'

/**
 * Importa le rose da un export .xlsx di Fantasego.
 *
 * Il foglio mette le squadre in blocchi affiancati di tre colonne — nome,
 * "costo", una vuota — con l'intestazione sulla prima riga, i giocatori sotto
 * raggruppati per reparto e una riga "totale" a chiudere.
 *
 * Il ruolo di ogni giocatore lo prende dal listone, non dalla posizione nel
 * foglio: nel listone non ci sono omonimi, quindi il nome basta ed e' piu'
 * affidabile del contare le righe. La posizione serve solo a controllare che i
 * conti per reparto tornino con gli slot di lega.
 */

/** Nel foglio un nome seguito da " *" e' un giocatore uscito dalla Serie A. */
const MARCATORE_FUORI = /\s*\*\s*$/

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(MARCATORE_FUORI, '')
    .replace(/[.'’]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const perNome = new Map<string, Player>(players.map((p) => [norm(p.nome), p]))

export interface RigaRosa {
  squadra: string
  /** Nome come scritto nel foglio, marcatore compreso. */
  nomeFile: string
  prezzo: number
  /** Aveva il marcatore " *". */
  fuoriLista: boolean
  player?: Player
}

export interface SquadraImportata {
  nome: string
  presi: number
  spesa: number
  /** Totale dichiarato dalla riga "totale" del foglio, se c'era. */
  totaleFile: number | null
  perRuolo: Record<Role, number>
}

export interface EsitoImport {
  squadre: SquadraImportata[]
  teams: Team[]
  picks: Pick[]
  righeLette: number
  agganciati: number
  /** Marcati " *" e non nel listone: atteso, gli slot restano liberi. */
  fuoriLista: RigaRosa[]
  /** Non marcati e non trovati: questi sono un problema da guardare. */
  nonTrovati: RigaRosa[]
  /** Stesso giocatore in due rose: nel foglio non dovrebbe capitare. */
  duplicati: RigaRosa[]
  /** Reparti che sforano gli slot di lega, es. 9 difensori su 8. */
  sfori: string[]
}

const testo = (c: Riga[number]): string => (c == null ? '' : String(c).trim())

const prezzo = (c: Riga[number]): number => {
  const n = typeof c === 'number' ? c : Number(String(c ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
}

/** Trova il foglio delle rose: quello che si chiama ROSE, o il primo. */
function foglioRose(fogli: Foglio[]): Foglio {
  return fogli.find((f) => f.nome.trim().toUpperCase() === 'ROSE') ?? fogli[0]
}

export function parseRose(fogli: Foglio[], slots: Record<Role, number>): EsitoImport {
  const foglio = foglioRose(fogli)
  const intestazione = foglio.righe[0] ?? []

  // Un blocco squadra e' una cella di intestazione non vuota seguita da "costo".
  const blocchi: { nome: string; col: number }[] = []
  for (let c = 0; c < intestazione.length; c++) {
    const nome = testo(intestazione[c])
    if (!nome || nome.toLowerCase() === 'costo') continue
    if (testo(intestazione[c + 1]).toLowerCase() !== 'costo') continue
    blocchi.push({ nome, col: c })
  }
  if (!blocchi.length) {
    throw new Error(
      'Nessuna squadra trovata: la prima riga deve avere il nome squadra seguito da una colonna "costo".',
    )
  }

  const righe: RigaRosa[] = []
  const squadre: SquadraImportata[] = []
  const totaliFile = new Map<string, number>()

  for (const b of blocchi) {
    const mie: RigaRosa[] = []
    for (let r = 1; r < foglio.righe.length; r++) {
      const nomeFile = testo(foglio.righe[r]?.[b.col])
      if (!nomeFile) continue
      // La riga "totale" chiude il blocco: dopo non c'e' altro da leggere.
      if (nomeFile.toLowerCase() === 'totale') {
        totaliFile.set(b.nome, prezzo(foglio.righe[r]?.[b.col + 1]))
        break
      }
      mie.push({
        squadra: b.nome,
        nomeFile,
        prezzo: prezzo(foglio.righe[r]?.[b.col + 1]),
        fuoriLista: MARCATORE_FUORI.test(nomeFile),
        player: perNome.get(norm(nomeFile)),
      })
    }
    righe.push(...mie)

    const agganciate = mie.filter((x) => x.player)
    const perRuolo = ROLES.reduce(
      (acc, r) => {
        acc[r] = agganciate.filter((x) => x.player!.r === r).length
        return acc
      },
      {} as Record<Role, number>,
    )

    squadre.push({
      nome: b.nome,
      presi: agganciate.length,
      spesa: agganciate.reduce((n, x) => n + x.prezzo, 0),
      totaleFile: totaliFile.get(b.nome) ?? null,
      perRuolo,
    })
  }

  // Un giocatore in due rose: la prima occorrenza vince, la seconda si segnala.
  const visti = new Set<number>()
  const duplicati: RigaRosa[] = []
  const teams: Team[] = blocchi.map((b, i) => ({ id: `t${i + 1}`, nome: b.nome }))
  const idPerNome = new Map(teams.map((t) => [t.nome, t.id]))
  const picks: Pick[] = []
  // Timestamp crescenti nell'ordine del foglio: il registro movimenti resta leggibile.
  let ts = Date.now() - righe.length * 1000

  for (const r of righe) {
    if (!r.player) continue
    if (visti.has(r.player.id)) {
      duplicati.push(r)
      continue
    }
    visti.add(r.player.id)
    picks.push({
      playerId: r.player.id,
      teamId: idPerNome.get(r.squadra)!,
      price: r.prezzo,
      ts: (ts += 1000),
    })
  }

  const sfori: string[] = []
  for (const s of squadre) {
    for (const r of ROLES) {
      if (s.perRuolo[r] > slots[r]) {
        sfori.push(`${s.nome}: ${s.perRuolo[r]} ${r} su ${slots[r]} slot`)
      }
    }
  }

  return {
    squadre,
    teams,
    picks,
    righeLette: righe.length,
    agganciati: righe.filter((x) => x.player).length,
    fuoriLista: righe.filter((x) => !x.player && x.fuoriLista),
    nonTrovati: righe.filter((x) => !x.player && !x.fuoriLista),
    duplicati,
    sfori,
  }
}

export async function importaRoseDaFile(file: File, slots: Record<Role, number>): Promise<EsitoImport> {
  return parseRose(await leggiXlsx(await file.arrayBuffer()), slots)
}
