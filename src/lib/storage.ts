/**
 * Verifica che il browser conceda davvero localStorage.
 *
 * Aprendo la dashboard da file:// o in finestra anonima la scrittura puo'
 * essere bloccata: senza questo controllo l'asta sembrerebbe salvata e alla
 * prima ricarica sparirebbe tutto.
 */
export function storageDisponibile(): boolean {
  try {
    const chiave = '__fantadash_probe__'
    localStorage.setItem(chiave, '1')
    const ok = localStorage.getItem(chiave) === '1'
    localStorage.removeItem(chiave)
    return ok
  } catch {
    return false
  }
}
