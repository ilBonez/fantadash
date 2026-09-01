/**
 * Splash di accesso alla dashboard.
 *
 * NON e' un meccanismo di sicurezza e non prova a esserlo: il controllo gira
 * nel browser, quindi la password si legge nel bundle e il controllo si salta.
 * Serve solo a mettere un nome a chi apre la dashboard e a non entrarci per
 * sbaglio. Del resto non c'e' nulla da proteggere: i dati dell'asta stanno nel
 * browser di chi la usa e non passano da nessun server.
 *
 * Se un giorno servisse accesso vero, la strada e' un controllo lato server
 * davanti al sito (es. Cloudflare Access), non del codice qui dentro.
 */

const CHIAVE = 'fantadash.utente'

export interface Utente {
  /** Come e' stato digitato, es. "lorenzo.bonetti". */
  id: string
  /** Ricavato dall'id per i saluti, es. "Lorenzo Bonetti". */
  nome: string
  /** ISO 8601 del primo accesso. */
  dal: string
}

/** Formato richiesto: nome.cognome, accenti e apostrofi ammessi. */
const FORMATO = /^[\p{L}][\p{L}'-]*\.[\p{L}][\p{L}'-]*$/u

export const formatoValido = (id: string) => FORMATO.test(id.trim())

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "lorenzo.bonetti" -> "Lorenzo Bonetti" */
export function nomeLeggibile(id: string): string {
  return id
    .trim()
    .split('.')
    .map((parte) => parte.split('-').map(maiuscola).join('-'))
    .join(' ')
}

export function leggiUtente(): Utente | null {
  try {
    const raw = localStorage.getItem(CHIAVE)
    if (!raw) return null
    const u = JSON.parse(raw) as Partial<Utente>
    if (!u.id || !formatoValido(u.id)) return null
    return { id: u.id, nome: u.nome ?? nomeLeggibile(u.id), dal: u.dal ?? new Date().toISOString() }
  } catch {
    return null
  }
}

export function salvaUtente(id: string): Utente {
  const pulito = id.trim().toLowerCase()
  const utente: Utente = { id: pulito, nome: nomeLeggibile(pulito), dal: new Date().toISOString() }
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(utente))
  } catch {
    // Senza localStorage l'accesso non si ricorda: la fascia di avviso in cima
    // alla dashboard lo spiega gia' all'utente.
  }
  return utente
}

export function esciUtente(): void {
  try {
    localStorage.removeItem(CHIAVE)
  } catch {
    // niente da fare
  }
}
