/**
 * Lettore .xlsx minimo, senza dipendenze.
 *
 * Un .xlsx e' uno zip di XML, e il browser sa fare entrambe le cose da solo:
 * `DecompressionStream('deflate-raw')` per lo zip e `DOMParser` per l'XML. Il
 * pacchetto npm `xlsx` era stato tolto dal progetto per due CVE senza fix, e
 * riaggiungere una libreria da un mega per leggere una tabella di 27 righe
 * sarebbe stato uno scambio peggiore.
 *
 * Copre quello che serve qui: fogli con celle testo, numeri e stringhe
 * condivise. Non gestisce zip64 (oltre 65535 voci o file da 4 GB), formule
 * calcolate lato Excel senza valore memorizzato, ne' la conversione delle date
 * seriali.
 */

export type Cella = string | number | null
export type Riga = Cella[]

/** Un foglio come matrice di righe, senza celle vuote in coda. */
export interface Foglio {
  nome: string
  righe: Riga[]
}

// --- zip --------------------------------------------------------------------

const FIRMA_EOCD = 0x06054b50
const FIRMA_CENTRALE = 0x02014b50

interface Voce {
  nome: string
  metodo: number
  offsetLocale: number
  dimCompressa: number
}

/** Legge il catalogo dello zip: l'unico posto con offset e dimensioni certe. */
function leggiCatalogo(buf: ArrayBuffer): Map<string, Voce> {
  const dv = new DataView(buf)
  const utf8 = new TextDecoder('utf-8')

  // L'EOCD sta in fondo, dopo un commento di lunghezza variabile.
  let eocd = -1
  const minimo = Math.max(0, buf.byteLength - 66_000)
  for (let i = buf.byteLength - 22; i >= minimo; i--) {
    if (dv.getUint32(i, true) === FIRMA_EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Non e un file .xlsx valido (zip senza indice).')

  const voci = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)

  const out = new Map<string, Voce>()
  for (let i = 0; i < voci; i++) {
    if (dv.getUint32(p, true) !== FIRMA_CENTRALE) break
    const metodo = dv.getUint16(p + 10, true)
    const dimCompressa = dv.getUint32(p + 20, true)
    const lunNome = dv.getUint16(p + 28, true)
    const lunExtra = dv.getUint16(p + 30, true)
    const lunCommento = dv.getUint16(p + 32, true)
    const offsetLocale = dv.getUint32(p + 42, true)
    const nome = utf8.decode(new Uint8Array(buf, p + 46, lunNome))
    out.set(nome, { nome, metodo, offsetLocale, dimCompressa })
    p += 46 + lunNome + lunExtra + lunCommento
  }
  return out
}

async function estrai(buf: ArrayBuffer, voce: Voce): Promise<string> {
  const dv = new DataView(buf)
  // L'intestazione locale ripete nome ed extra, con lunghezze proprie.
  const lunNome = dv.getUint16(voce.offsetLocale + 26, true)
  const lunExtra = dv.getUint16(voce.offsetLocale + 28, true)
  const inizio = voce.offsetLocale + 30 + lunNome + lunExtra
  const dati = new Uint8Array(buf, inizio, voce.dimCompressa)

  if (voce.metodo === 0) return new TextDecoder('utf-8').decode(dati)
  if (voce.metodo !== 8) throw new Error(`Compressione zip non supportata (${voce.metodo}).`)
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Questo browser non sa decomprimere gli .xlsx. Aggiornalo o usa Chrome, Edge o Firefox.')
  }

  const flusso = new Blob([dati]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(flusso).text()
}

// --- xml --------------------------------------------------------------------

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml')

/** "AB12" -> 27 (indice colonna 0-based). */
function colonnaDa(ref: string): number {
  let n = 0
  for (const ch of ref) {
    const c = ch.charCodeAt(0)
    if (c < 65 || c > 90) break
    n = n * 26 + (c - 64)
  }
  return n - 1
}

function stringheCondivise(xml: string): string[] {
  const doc = parse(xml)
  return [...doc.getElementsByTagName('si')].map((si) =>
    [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''),
  )
}

function leggiFoglio(xml: string, condivise: string[], nome: string): Foglio {
  const doc = parse(xml)
  const righe: Riga[] = []

  for (const row of doc.getElementsByTagName('row')) {
    const riga: Riga = []
    for (const c of row.getElementsByTagName('c')) {
      const i = colonnaDa(c.getAttribute('r') ?? '')
      if (i < 0) continue
      const tipo = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? null

      let valore: Cella = null
      if (tipo === 's') {
        valore = v != null ? (condivise[Number(v)] ?? null) : null
      } else if (tipo === 'inlineStr') {
        valore = [...c.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('') || null
      } else if (tipo === 'str' || tipo === 'e') {
        valore = v
      } else if (tipo === 'b') {
        valore = v === '1' ? 'VERO' : 'FALSO'
      } else if (v != null) {
        const n = Number(v)
        valore = Number.isFinite(n) ? n : v
      }

      while (riga.length < i) riga.push(null)
      riga[i] = valore
    }
    // L'attributo r della riga e 1-based e puo saltare righe vuote.
    const posizione = Number(row.getAttribute('r') ?? righe.length + 1) - 1
    while (righe.length < posizione) righe.push([])
    righe[posizione] = riga
  }

  return { nome, righe }
}

// --- api --------------------------------------------------------------------

/**
 * Legge i fogli di un .xlsx. I nomi arrivano da `xl/workbook.xml` e i percorsi
 * dalle sue relazioni, non dall'ordine dei file: un `sheet1.xml` non e' detto
 * che sia il primo foglio.
 */
export async function leggiXlsx(buf: ArrayBuffer): Promise<Foglio[]> {
  const catalogo = leggiCatalogo(buf)

  const wb = catalogo.get('xl/workbook.xml')
  if (!wb) throw new Error('Non e un file .xlsx valido (manca xl/workbook.xml).')

  const rels = catalogo.get('xl/_rels/workbook.xml.rels')
  const perId = new Map<string, string>()
  if (rels) {
    for (const r of parse(await estrai(buf, rels)).getElementsByTagName('Relationship')) {
      const target = r.getAttribute('Target') ?? ''
      const id = r.getAttribute('Id') ?? ''
      // I target sono relativi a xl/ e possono avere un ./ davanti.
      perId.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.?\//, '')}`)
    }
  }

  const condivise = catalogo.has('xl/sharedStrings.xml')
    ? stringheCondivise(await estrai(buf, catalogo.get('xl/sharedStrings.xml')!))
    : []

  const fogli: Foglio[] = []
  const elenco = [...parse(await estrai(buf, wb)).getElementsByTagName('sheet')]

  for (let i = 0; i < elenco.length; i++) {
    const el = elenco[i]
    const nome = el.getAttribute('name') ?? `Foglio${i + 1}`
    const rid = el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    const percorso = (rid && perId.get(rid)) || `xl/worksheets/sheet${i + 1}.xml`
    const voce = catalogo.get(percorso)
    if (!voce) continue
    fogli.push(leggiFoglio(await estrai(buf, voce), condivise, nome))
  }

  if (!fogli.length) throw new Error('Il file non contiene fogli leggibili.')
  return fogli
}
