import { useRef, useState } from 'react'
import { int } from '../lib/format'
import { listone, noteSquadre } from '../lib/listone'
import { TEMPERATURE, type Temperatura } from '../lib/market'
import { useAuction, type Snapshot } from '../store/useAuction'
import { ROLES, ROLE_LABEL } from '../types'
import { RoleBadge, Section } from './ui'

export default function SetupView() {
  const settings = useAuction((s) => s.settings)
  const teams = useAuction((s) => s.teams)
  const picks = useAuction((s) => s.picks)
  const myTeamId = useAuction((s) => s.myTeamId)
  const setSettings = useAuction((s) => s.setSettings)
  const setSlots = useAuction((s) => s.setSlots)
  const addTeam = useAuction((s) => s.addTeam)
  const updateTeam = useAuction((s) => s.updateTeam)
  const removeTeam = useAuction((s) => s.removeTeam)
  const setMyTeam = useAuction((s) => s.setMyTeam)
  const targetIds = useAuction((s) => s.targetIds)
  const clearTargets = useAuction((s) => s.clearTargets)
  const priceOverrides = useAuction((s) => s.priceOverrides)
  const clearPriceOverrides = useAuction((s) => s.clearPriceOverrides)
  const resetPicks = useAuction((s) => s.resetPicks)
  const resetAll = useAuction((s) => s.resetAll)
  const loadSnapshot = useAuction((s) => s.loadSnapshot)
  const snapshot = useAuction((s) => s.snapshot)

  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const slotsTotal = ROLES.reduce((n, r) => n + settings.slots[r], 0)
  const pickCount = (id: string) => picks.filter((p) => p.teamId === id).length

  const exportJson = () => {
    const data = { app: 'fantadash', version: 1, exportedAt: new Date().toISOString(), ...snapshot() }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `fantadash-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('Backup scaricato.')
  }

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Snapshot>
      if (!parsed.settings || !Array.isArray(parsed.teams)) throw new Error('formato non riconosciuto')
      loadSnapshot(parsed as Snapshot)
      setMsg(`Importato: ${parsed.teams.length} squadre, ${parsed.picks?.length ?? 0} assegnazioni.`)
    } catch (e) {
      setMsg(`Import fallito: ${e instanceof Error ? e.message : 'errore'}`)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-2">
        <Section title="Regole della lega">
          <div className="space-y-3 px-3 py-3">
            <label className="block">
              <span className="mb-1 block text-xs text-ink-400">Nome lega</span>
              <input
                value={settings.lega}
                onChange={(e) => setSettings({ lega: e.target.value })}
                className="field w-full"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-ink-400">Modalita</span>
                <select
                  value={settings.mode}
                  onChange={(e) => setSettings({ mode: e.target.value as 'classic' | 'mantra' })}
                  className="field w-full"
                >
                  <option value="classic">Classic (Qt.A, FVM)</option>
                  <option value="mantra">Mantra (Qt.A M, FVM M)</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs text-ink-400">Crediti per squadra</span>
                <input
                  type="number"
                  min={1}
                  value={settings.budget}
                  onChange={(e) => setSettings({ budget: Math.max(1, Number(e.target.value) || 1) })}
                  className="field w-full"
                />
              </label>
            </div>

            <div>
              <span className="mb-1.5 block text-xs text-ink-400">Temperatura del mercato</span>
              <div className="flex items-center rounded-lg border border-ink-700 bg-ink-850 p-0.5 text-xs">
                {(Object.keys(TEMPERATURE) as Temperatura[]).map((t) => (
                  <button
                    key={t}
                    title={TEMPERATURE[t].nota}
                    onClick={() => setSettings({ temperatura: t })}
                    className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
                      (settings.temperatura ?? 'normale') === t
                        ? 'bg-sky-600 text-white'
                        : 'text-ink-400 hover:text-ink-100'
                    }`}
                  >
                    {TEMPERATURE[t].label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-ink-500">
                {TEMPERATURE[settings.temperatura ?? 'normale'].nota}
              </p>
            </div>

            <div>
              <span className="mb-1.5 block text-xs text-ink-400">Slot per reparto ({slotsTotal} a rosa)</span>
              <div className="grid grid-cols-4 gap-2">
                {ROLES.map((r) => (
                  <label key={r} className="block" title={ROLE_LABEL[r]}>
                    <span className="mb-1 flex items-center gap-1.5">
                      <RoleBadge role={r} />
                      <span className="text-[11px] text-ink-500">
                        {listone.conteggi[r]} in lista
                      </span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={settings.slots[r]}
                      onChange={(e) => setSlots({ [r]: Math.max(0, Number(e.target.value) || 0) })}
                      className="field w-full text-center"
                    />
                  </label>
                ))}
              </div>
              {slotsTotal * teams.length > listone.giocatori.length - listone.ceduti && (
                <p className="mt-2 text-xs text-amber-400">
                  {teams.length} squadre x {slotsTotal} slot = {int(teams.length * slotsTotal)} giocatori richiesti, ma
                  la lista ne ha {int(listone.giocatori.length - listone.ceduti)}.
                </p>
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Squadre"
          right={
            <button className="btn" onClick={() => addTeam()}>
              + Aggiungi
            </button>
          }
        >
          <div className="divide-y divide-ink-800">
            {teams.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2">
                <button
                  onClick={() => setMyTeam(myTeamId === t.id ? null : t.id)}
                  title="Segna come la mia squadra"
                  className={`w-6 text-center text-lg leading-none ${
                    myTeamId === t.id ? 'text-sky-400' : 'text-ink-700 hover:text-ink-400'
                  }`}
                >
                  &#9733;
                </button>
                <span className="w-5 font-mono text-[11px] text-ink-500">{i + 1}</span>
                <input
                  value={t.nome}
                  onChange={(e) => updateTeam(t.id, { nome: e.target.value })}
                  className="field min-w-0 flex-1"
                />
                <label className="flex items-center gap-1 text-[11px] text-ink-500">
                  crediti
                  <input
                    type="number"
                    min={0}
                    value={t.budgetOverride ?? ''}
                    placeholder={String(settings.budget)}
                    onChange={(e) =>
                      updateTeam(t.id, {
                        budgetOverride: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="field w-16 text-right"
                  />
                </label>
                <button
                  onClick={() => {
                    const n = pickCount(t.id)
                    if (n === 0 || confirm(`Rimuovere "${t.nome}" e le sue ${n} assegnazioni?`)) removeTeam(t.id)
                  }}
                  title="Rimuovi squadra"
                  className="rounded px-1.5 py-0.5 text-ink-500 hover:bg-rose-500/20 hover:text-rose-300"
                >
                  &times;
                </button>
              </div>
            ))}
            {!teams.length && <div className="px-3 py-6 text-center text-sm text-ink-400">Nessuna squadra.</div>}
          </div>
        </Section>

        <Section title="Dati e backup">
          <div className="space-y-3 px-3 py-3 text-sm">
            <p className="text-ink-400">
              Tutto resta sul tuo browser (localStorage). Esporta un backup prima e durante l&apos;asta: se cambi
              computer o svuoti la cache, il JSON e l&apos;unico modo per recuperare.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={exportJson}>
                Esporta backup JSON
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                Importa backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importJson(f)
                  e.target.value = ''
                }}
              />
              <button
                className="btn"
                onClick={() => {
                  if (confirm(`Cancellare tutte le ${picks.length} assegnazioni? Le squadre restano.`)) resetPicks()
                }}
              >
                Svuota assegnazioni
              </button>
              <button className="btn" disabled={!targetIds.length} onClick={clearTargets}>
                Azzera obiettivi ({targetIds.length})
              </button>
              <button
                className="btn"
                disabled={!Object.keys(priceOverrides).length}
                onClick={clearPriceOverrides}
              >
                Azzera prezzi corretti ({Object.keys(priceOverrides).length})
              </button>
              <button
                className="btn text-rose-300 hover:border-rose-500/60"
                onClick={() => {
                  if (confirm('Reset totale: squadre, regole e assegnazioni. Confermi?')) resetAll()
                }}
              >
                Reset totale
              </button>
            </div>
            {msg && <p className="text-xs text-sky-300">{msg}</p>}
          </div>
        </Section>

        <Section title="Listone caricato">
          <div className="space-y-2 px-3 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-400">Stagione</span>
              <span className="font-medium">{listone.stagione}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-400">File sorgente</span>
              <span className="truncate font-mono text-[11px]">{listone.sorgente}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-400">Generato il</span>
              <span className="font-mono text-[11px]">
                {listone.generatoIl
                  ? new Date(listone.generatoIl).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
                  : 'n/d'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-400">Giocatori attivi</span>
              <span className="font-medium">
                {int(listone.giocatori.length - listone.ceduti)}{' '}
                <span className="text-ink-500">
                  ({ROLES.map((r) => `${r} ${listone.conteggi[r]}`).join(' · ')})
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-400">Ceduti / fuori lista</span>
              <span className="font-medium">{int(listone.ceduti)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-400">Dati curati</span>
              <span className="font-medium">
                {int(listone.giocatori.filter((p) => p.titolare).length)} titolari ·{' '}
                {int(listone.giocatori.filter((p) => p.rigorista).length)} rigoristi
              </span>
            </div>
            <p className="border-t border-ink-800 pt-2 text-xs text-ink-400">
              Per aggiornare le quotazioni copia il nuovo .xlsx ufficiale in{' '}
              <code className="text-ink-200">data/</code>: con <code className="text-ink-200">npm run dev</code> attivo
              il listone si rigenera da solo e la pagina si ricarica. A server spento serve{' '}
              <code className="text-ink-200">npm run ingest</code>. Le assegnazioni non si perdono: sono legate
              all&apos;Id ufficiale del giocatore.
            </p>
            <p className="text-xs text-ink-400">
              Titolari, rigoristi, tiratori e prezzi di mercato stanno in{' '}
              <code className="text-ink-200">data/extra.json</code>: modificalo a mano quando cambiano le gerarchie.
              L&apos;ingest stampa ogni nome che non riesce ad agganciare al listone.
            </p>
          </div>
        </Section>
        {Object.keys(noteSquadre).length > 0 && (
          <Section
            title="Ballottaggi e gerarchie incerte"
            right={<span className="text-[11px] text-ink-500">{Object.keys(noteSquadre).length} squadre</span>}
          >
            <ul className="divide-y divide-ink-800">
              {Object.entries(noteSquadre).map(([squadra, nota]) => (
                <li key={squadra} className="px-3 py-2 text-sm">
                  <span className="font-medium">{squadra}</span>
                  <p className="mt-0.5 text-xs text-ink-400">{nota}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}
