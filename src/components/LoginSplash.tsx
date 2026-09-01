import { useState } from 'react'
import { listone } from '../lib/listone'
import { formatoValido, salvaUtente, type Utente } from '../lib/utente'

/**
 * Schermata di accesso. Qualunque password va bene: vedi il commento in cima a
 * lib/utente.ts sul perche' non e' e non vuole essere una protezione.
 */
export default function LoginSplash({ onEntra }: { onEntra: (u: Utente) => void }) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formatoValido(id)) {
      setErrore('Serve il formato nome.cognome, per esempio lorenzo.bonetti')
      return
    }
    if (!password.trim()) {
      setErrore('Metti una password qualsiasi')
      return
    }
    onEntra(salvaUtente(id))
  }

  const attivi = listone.giocatori.length - listone.ceduti

  return (
    <div className="flex min-h-full items-center justify-center bg-ink-950 p-6">
      {/* Alone di sfondo: fa respirare la schermata senza aggiungere immagini. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(60rem 40rem at 50% -10%, rgba(56,189,248,0.10), transparent 70%), radial-gradient(40rem 30rem at 90% 110%, rgba(167,139,250,0.10), transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold tracking-tight">
            Fanta<span className="text-sky-400">Dash</span>
          </div>
          <p className="mt-1 text-sm text-ink-400">Asta del fantacalcio, Serie A</p>
        </div>

        <form onSubmit={submit} className="card space-y-3 p-5">
          <label className="block">
            <span className="mb-1 block text-xs text-ink-400">Nome</span>
            <input
              autoFocus
              value={id}
              onChange={(e) => {
                setId(e.target.value)
                setErrore(null)
              }}
              placeholder="nome.cognome"
              autoComplete="username"
              spellCheck={false}
              className="field w-full lowercase"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-ink-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setErrore(null)
              }}
              placeholder="quella che vuoi"
              autoComplete="current-password"
              className="field w-full"
            />
          </label>

          {errore && <p className="text-xs text-amber-400">{errore}</p>}

          <button type="submit" className="btn-primary w-full py-2">
            Entra
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-500">
          Stagione {listone.stagione.replace('Quotazioni Fantacalcio Stagione ', '')} · {attivi} giocatori
          <br />
          L&apos;asta resta su questo dispositivo. Nessun dato viene inviato da nessuna parte.
        </p>
      </div>
    </div>
  )
}
