import { useEffect, useMemo, useRef, useState } from 'react'
import { mantraRoles, searchPlayers, teamsSerieA, type SearchFilters } from '../lib/listone'
import { int } from '../lib/format'
import { useLeague } from '../lib/useLeague'
import { useNativeKeydown } from '../lib/useNativeKeydown'
import { useAuction } from '../store/useAuction'
import type { Player, Role } from '../types'
import { ROLES } from '../types'
import AssignBar from './AssignBar'
import MovesLog from './MovesLog'
import PlayerTable, { type SortKey } from './PlayerTable'
import { TagsLegend } from './PlayerTags'
import TeamsRail from './TeamsRail'
import { ROLE_COLOR } from './ui'

const EMPTY_FILTERS: SearchFilters = {
  q: '',
  role: 'ALL',
  squadra: 'ALL',
  mantraRole: 'ALL',
  soloDisponibili: true,
  soloObiettivi: false,
  soloUtili: false,
}

export default function AstaView() {
  const settings = useAuction((s) => s.settings)
  const myTeamId = useAuction((s) => s.myTeamId)
  const setMyTeam = useAuction((s) => s.setMyTeam)
  const assign = useAuction((s) => s.assign)
  const unassign = useAuction((s) => s.unassign)
  const toggleTarget = useAuction((s) => s.toggleTarget)
  const setPriceOverride = useAuction((s) => s.setPriceOverride)

  const league = useLeague()

  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS)
  // Di default la lista mette in cima le scelte migliori per la propria squadra.
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'consiglio', desc: true })
  const [selected, setSelected] = useState<Player | null>(null)
  const [hi, setHi] = useState(-1)

  const searchRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)
  const tableWrapRef = useRef<HTMLDivElement>(null)

  const neededRoles = useMemo(
    () => new Set(ROLES.filter((r) => (league.myTeam ? league.myTeam.byRole[r].left > 0 : true))),
    [league.myTeam],
  )

  const rows = useMemo(
    () => searchPlayers(filters, { takenIds: league.takenIds, targetIds: league.targetIds, neededRoles }),
    [filters, league.takenIds, league.targetIds, neededRoles],
  )
  const searching = filters.q.trim().length > 0

  // La riga evidenziata deve restare valida quando cambiano i filtri.
  useEffect(() => {
    setHi(rows.length ? 0 : -1)
  }, [filters, rows.length])

  // Tiene la riga evidenziata dentro l'area visibile, ma solo mentre si cerca:
  // altrimenti al primo render sposterebbe la lista sotto l'intestazione sticky.
  useEffect(() => {
    if (hi < 0 || !searching) return
    tableWrapRef.current?.querySelector(`[data-row="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi, searching])

  // Il focus sul campo prezzo lo mette AssignBar quando cambia giocatore.
  const pick = (p: Player) => setSelected(p)

  useNativeKeydown(searchRef, (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHi((i) => Math.min(rows.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHi((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const p = rows[hi] ?? rows[0]
      if (p) pick(p)
    } else if (e.key === 'Escape') {
      setFilters((f) => ({ ...f, q: '' }))
    }
  })

  // Scorciatoie della vista asta.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = e.target instanceof HTMLElement && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
      const focusSearch = () => {
        searchRef.current?.focus()
        searchRef.current?.select()
      }
      if (e.key === '/' && !inField) {
        e.preventDefault()
        focusSearch()
        return
      }
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        focusSearch()
        return
      }
      if (e.key === 'Escape' && selected) {
        setSelected(null)
        searchRef.current?.focus()
        return
      }
      // Alt+1..9 sceglie rapidamente la squadra attiva.
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        const t = league.teams[Number(e.key) - 1]
        if (t) {
          e.preventDefault()
          setMyTeam(t.team.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, league.teams, setMyTeam])

  const onAssign = (teamId: string, price: number) => {
    if (!selected) return
    assign(selected.id, teamId, price)
    setSelected(null)
    setFilters((f) => ({ ...f, q: '' }))
    // Il campo ricerca e sempre montato: si torna subito a digitare.
    searchRef.current?.focus()
  }

  const disponibili = rows.filter((p) => !league.takenIds.has(p.id)).length

  return (
    <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="card flex min-h-0 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-700/70 px-3 py-2">
          <input
            ref={searchRef}
            autoFocus
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Cerca giocatore o squadra..."
            className="field min-w-52 flex-1"
          />

          <div className="flex items-center gap-1">
            {(['ALL', ...ROLES] as (Role | 'ALL')[]).map((r) => (
              <button
                key={r}
                onClick={() => setFilters((f) => ({ ...f, role: r }))}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold transition-colors ${
                  filters.role === r
                    ? r === 'ALL'
                      ? 'border-sky-500 bg-sky-500/20 text-sky-100'
                      : ROLE_COLOR[r]
                    : 'border-ink-700 bg-ink-850 text-ink-400 hover:text-ink-100'
                }`}
              >
                {r === 'ALL' ? 'Tutti' : r}
              </button>
            ))}
          </div>

          <select
            value={filters.squadra}
            onChange={(e) => setFilters((f) => ({ ...f, squadra: e.target.value }))}
            className="field"
          >
            <option value="ALL">Tutte le squadre</option>
            {teamsSerieA.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {settings.mode === 'mantra' && (
            <select
              value={filters.mantraRole}
              onChange={(e) => setFilters((f) => ({ ...f, mantraRole: e.target.value }))}
              className="field"
            >
              <option value="ALL">Ruolo Mantra</option>
              {mantraRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2.5">
            <Toggle
              checked={filters.soloDisponibili}
              onChange={(v) => setFilters((f) => ({ ...f, soloDisponibili: v }))}
              label="liberi"
              title="Nascondi i giocatori gia assegnati"
            />
            <Toggle
              checked={filters.soloUtili}
              onChange={(v) => setFilters((f) => ({ ...f, soloUtili: v }))}
              label="mi serve"
              title="Solo i reparti in cui hai ancora slot liberi"
            />
            <Toggle
              checked={filters.soloObiettivi}
              onChange={(v) => setFilters((f) => ({ ...f, soloObiettivi: v }))}
              label={`obiettivi${league.targetIds.size ? ` (${league.targetIds.size})` : ''}`}
              title="Solo i giocatori marcati con la stella o presi da un piano rosa"
            />
          </div>

          <TagsLegend className="ml-auto" />
          <span className="text-[11px] text-ink-400">
            {int(rows.length)} righe · {int(disponibili)} liberi
          </span>
        </div>

        <div ref={tableWrapRef} className="flex min-h-0 flex-1 flex-col">
          <PlayerTable
            rows={rows}
            mode={settings.mode}
            pickByPlayer={league.pickByPlayer}
            advice={league.advice}
            targetIds={league.targetIds}
            selectedId={selected?.id ?? null}
            highlightIndex={searching ? hi : -1}
            sort={sort}
            searching={searching}
            onSort={(key) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }))}
            onSelect={pick}
            onUnassign={unassign}
            onToggleTarget={toggleTarget}
          />
        </div>

        <AssignBar
          player={selected}
          mode={settings.mode}
          teams={league.teams}
          defaultTeamId={myTeamId}
          advice={selected ? league.advice.get(selected.id) : undefined}
          onPriceOverride={setPriceOverride}
          onAssign={onAssign}
          onCancel={() => {
            setSelected(null)
            searchRef.current?.focus()
          }}
          priceRef={priceRef}
        />
      </div>

      <div className="grid min-h-0 grid-rows-[minmax(0,1.2fr)_minmax(0,1fr)] gap-3">
        <TeamsRail teams={league.teams} myTeamId={myTeamId} onPickTeam={setMyTeam} />
        <MovesLog picks={league.enriched} onUnassign={unassign} />
      </div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  title,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  title: string
}) {
  return (
    <label title={title} className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 accent-sky-500"
      />
      {label}
    </label>
  )
}
