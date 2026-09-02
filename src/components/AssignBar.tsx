import { useEffect, useMemo, useRef, useState } from 'react'
import { int, signed } from '../lib/format'
import type { Advice } from '../lib/advice'
import type { TeamStats } from '../lib/stats'
import { useNativeKeydown } from '../lib/useNativeKeydown'
import type { Player } from '../types'
import { RoleBadge } from './ui'

interface Props {
  player: Player | null
  teams: TeamStats[]
  defaultTeamId: string | null
  onAssign: (teamId: string, price: number) => void
  onCancel: () => void
  /** Consiglio calcolato per il giocatore in asta. */
  advice?: Advice
  /** Corregge il prezzo atteso: null rimuove la correzione. */
  onPriceOverride: (playerId: number, price: number | null) => void
  /** Registra il campo prezzo per potergli dare il focus dall'esterno. */
  priceRef: React.RefObject<HTMLInputElement | null>
}

export default function AssignBar({
  player,
  teams,
  defaultTeamId,
  onAssign,
  onCancel,
  advice,
  onPriceOverride,
  priceRef,
}: Props) {
  const [price, setPrice] = useState('')
  const [atteso, setAtteso] = useState('')
  const [teamId, setTeamId] = useState<string>(defaultTeamId ?? teams[0]?.team.id ?? '')
  const lastPlayer = useRef<number | null>(null)

  // Nuovo giocatore in asta: azzera il prezzo e porta il cursore sul campo,
  // cosi si digita l'offerta senza toccare il mouse.
  useEffect(() => {
    if (!player) {
      lastPlayer.current = null
      return
    }
    if (lastPlayer.current !== player.id) {
      lastPlayer.current = player.id
      setPrice('')
      setAtteso('')
      priceRef.current?.focus()
    }
  }, [player, priceRef])

  useEffect(() => {
    if (teams.length && !teams.some((t) => t.team.id === teamId)) setTeamId(teams[0].team.id)
  }, [teams, teamId])

  const q = player?.qtA ?? 0
  const f = player?.fvm ?? 0
  const n = Number(price)
  const valid = player != null && teamId !== '' && price !== '' && Number.isFinite(n) && n >= 0

  const selected = teams.find((t) => t.team.id === teamId)
  const roleLeft = player && selected ? selected.byRole[player.r].left : 0
  const overBudget = selected != null && valid && n > selected.maxBid

  const hint = useMemo(() => {
    if (!player || !selected) return null
    if (roleLeft <= 0) return `${selected.team.nome} ha gia tutti gli slot ${player.r} pieni`
    if (overBudget) return `Oltre il massimo sostenibile (${int(selected.maxBid)}) per ${selected.team.nome}`
    return null
  }, [player, selected, roleLeft, overBudget])

  const applicaAtteso = () => {
    if (!player) return
    const v = Number(atteso)
    if (atteso === '') return
    onPriceOverride(player.id, Number.isFinite(v) && v > 0 ? v : null)
  }

  const submit = () => {
    if (!valid) return
    onAssign(teamId, n)
    setPrice('')
    setAtteso('')
  }

  // Il campo prezzo esiste solo con un giocatore in asta: riaggancia al cambio.
  useNativeKeydown(
    priceRef,
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [player?.id ?? null],
  )

  if (!player) {
    return (
      <div className="flex items-center gap-3 border-t border-ink-700/70 bg-ink-900 px-3 py-2.5 text-sm text-ink-400">
        <span className="kbd">/</span> cerca &nbsp;·&nbsp; <span className="kbd">&darr;</span>
        <span className="kbd">&uarr;</span> scorri &nbsp;·&nbsp; <span className="kbd">Enter</span> metti all&apos;asta
        &nbsp;·&nbsp; <span className="kbd">Ctrl</span>+<span className="kbd">Z</span> annulla
      </div>
    )
  }

  const delta = valid ? n - q : 0

  return (
    <div className="border-t border-sky-500/30 bg-ink-850 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Il dettaglio del giocatore sta nella scheda qui sopra: nella barra
            resta solo quel che serve a battere il prezzo senza staccare gli occhi. */}
        <div className="flex min-w-0 items-center gap-2">
          <RoleBadge role={player.r} />
          <div className="min-w-0">
            <div className="truncate font-semibold leading-tight">{player.nome}</div>
            <div className="text-[11px] text-ink-400">
              Qt.A <span className="text-ink-200">{int(q)}</span> · consigliato{' '}
              <span className="text-ink-200">{int(player.cons)}</span> · max{' '}
              <span className="text-ink-200">{int(player.max)}</span>
              {advice && (
                <>
                  {' · asta '}
                  <span
                    className={
                      advice.fontePrezzo === 'override'
                        ? 'font-semibold text-sky-300'
                        : advice.sopraMax
                          ? 'font-semibold text-amber-300'
                          : 'text-ink-200'
                    }
                  >
                    {int(advice.expPrice)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-ink-400">
          Prezzo
          <input
            ref={priceRef}
            type="number"
            min={0}
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={String(q)}
            className="field w-20 text-right text-base font-semibold"
          />
        </label>

        <label
          className="flex items-center gap-1.5 text-xs text-ink-400"
          title="Prezzo a cui pensi che finira: entra nei consigli e nei piani rosa"
        >
          Atteso
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={atteso}
            onChange={(e) => setAtteso(e.target.value)}
            onBlur={applicaAtteso}
            placeholder={advice ? String(advice.expPrice) : ''}
            className="field w-16 text-right"
          />
        </label>

        {valid && (
          <span
            className={`text-xs font-medium ${
              delta > 0 ? 'text-rose-400' : delta < 0 ? 'text-emerald-400' : 'text-ink-400'
            }`}
          >
            {signed(delta)} vs Qt.A · {signed(n - player.max)} vs max · {n > 0 ? (f / n).toFixed(1) : '-'} FVM/cr
          </span>
        )}

        <div className="flex flex-1 flex-wrap items-center gap-1">
          {teams.map((t, i) => {
            const active = t.team.id === teamId
            const full = player ? t.byRole[player.r].left <= 0 : false
            return (
              <button
                key={t.team.id}
                onClick={() => setTeamId(t.team.id)}
                title={`${t.team.nome} · residui ${int(t.remaining)} · max ${int(t.maxBid)}${
                  full ? ` · slot ${player.r} pieni` : ''
                }`}
                className={`rounded-lg border px-2 py-1 text-xs transition-colors ${
                  active
                    ? 'border-sky-500 bg-sky-500/20 text-sky-100'
                    : full
                      ? 'border-ink-700 bg-ink-900 text-ink-600'
                      : 'border-ink-700 bg-ink-800 text-ink-200 hover:border-ink-600'
                }`}
              >
                {i < 9 && <span className="mr-1 font-mono text-[10px] text-ink-400">{i + 1}</span>}
                {t.team.nome}
                <span className="ml-1.5 font-semibold text-ink-300">{int(t.maxBid)}</span>
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hint && <span className="text-xs text-amber-400">{hint}</span>}
          <button className="btn" onClick={onCancel}>
            Esc
          </button>
          <button className="btn-primary" disabled={!valid} onClick={submit}>
            Assegna
          </button>
        </div>
      </div>
    </div>
  )
}
