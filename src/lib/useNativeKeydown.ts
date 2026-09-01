import { useEffect, useRef, type RefObject } from 'react'

/**
 * Aggancia un listener keydown nativo a un elemento.
 *
 * Usiamo il DOM diretto invece di onKeyDown di React per i campi critici
 * dell'asta (ricerca e prezzo): l'handler e sempre l'ultimo renderizzato e
 * non dipende dalla delega degli eventi sintetici.
 */
export function useNativeKeydown<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: (e: KeyboardEvent) => void,
  /** Valori che fanno riagganciare il listener, es. quando l'elemento viene montato. */
  deps: unknown[] = [],
) {
  const latest = useRef(handler)
  latest.current = handler

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => latest.current(e)
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps])
}
