import { useRef, useState } from 'react'
import { int, signed } from '../lib/format'
import {
  costruisci,
  daIncludere,
  importaRoseDaFile,
  type EsitoImport,
  type RigaRosa,
} from '../lib/importRose'
import { ROLES, type Pick, type Role, type Team } from '../types'
import { RoleBadge, Section } from './ui'

/**
 * Importa le rose da un export .xlsx di Fantasego.
 *
 * L'import sostituisce squadre e assegnazioni, quindi non si applica al volo:
 * prima mostra cosa ha capito dal file — squadre, spesa, giocatori non
 * agganciati, sfori di reparto — e solo dopo si conferma.
 */
export default function ImportRose({
  slots,
  onConferma,
}: {
  slots: Record<Role, number>
  onConferma: (teams: Team[], picks: Pick[], myTeamId: string | null, esito: EsitoImport) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [esito, setEsito] = useState<EsitoImport | null>(null)
  const [nomeFile, setNomeFile] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [mia, setMia] = useState('')
  /** Nomi dei blocchi da importare: quelli a rosa vuota partono esclusi. */
  const [inclusi, setInclusi] = useState<string[]>([])

  const carica = async (file: File) => {
    setErrore(null)
    setEsito(null)
    try {
      const e = await importaRoseDaFile(file, slots)
      setEsito(e)
      setNomeFile(file.name)
      setInclusi(daIncludere(e))
      setMia('')
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'file non leggibile')
    }
  }

  // Ricalcolata a ogni spunta: e' anche quel che finisce nello stato.
  const selezione = esito ? costruisci(esito, inclusi) : { teams: [], picks: [] }
  const miaValida = selezione.teams.some((t) => t.id === mia) ? mia : ''
  const vuote = esito?.squadre.some((s) => s.presi === 0) ?? false

  return (
    <Section
      title="Importa rose da Excel"
      right={<span className="text-[11px] text-ink-500">export Fantasego</span>}
    >
      <div className="space-y-3 px-3 py-3 text-sm">
        <p className="text-ink-400">
          Carica il file delle rose esportato dalla tua lega: la dashboard ricrea le squadre con i nomi veri e tutte le
          assegnazioni ai prezzi pagati. Utile per riprendere un&apos;asta gia&apos; fatta altrove, o per rimettersi in
          pari se qualcosa e&apos; andato storto.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Scegli il file .xlsx
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void carica(f)
              e.target.value = ''
            }}
          />
          {nomeFile && <span className="truncate text-xs text-ink-500">{nomeFile}</span>}
        </div>

        {errore && <p className="text-xs text-rose-400">Import fallito: {errore}</p>}

        {esito && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-ink-400">
                    <th className="w-8 px-2 py-1.5 text-center font-semibold" title="Da importare">
                      Sì
                    </th>
                    <th className="px-2 py-1.5 text-left font-semibold">Squadra</th>
                    {ROLES.map((r) => (
                      <th key={r} className="px-2 py-1.5 text-center font-semibold">
                        {r}
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-right font-semibold">Presi</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Spesa</th>
                    <th
                      className="px-2 py-1.5 text-right font-semibold"
                      title="Differenza con il totale scritto nel foglio: viene dai giocatori che non sono nel listone"
                    >
                      vs file
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {esito.squadre.map((s) => {
                    const delta = s.totaleFile == null ? 0 : s.spesa - s.totaleFile
                    const on = inclusi.includes(s.nome)
                    return (
                      <tr key={s.nome} className={`border-t border-ink-800 ${on ? '' : 'text-ink-600'}`}>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                              setInclusi((v) => (e.target.checked ? [...v, s.nome] : v.filter((x) => x !== s.nome)))
                            }
                            className="size-3.5 accent-sky-500"
                          />
                        </td>
                        <td className="max-w-44 truncate px-2 py-1.5 font-medium">
                          {s.nome}
                          {s.presi === 0 && <span className="ml-1.5 text-[11px] text-ink-500">rosa vuota</span>}
                        </td>
                        {ROLES.map((r) => (
                          <td
                            key={r}
                            className={`px-2 py-1.5 text-center ${
                              s.perRuolo[r] > slots[r] ? 'font-semibold text-rose-400' : ''
                            }`}
                          >
                            {s.perRuolo[r]}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right">{s.presi}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{int(s.spesa)}</td>
                        <td
                          className={`px-2 py-1.5 text-right text-xs ${delta === 0 ? 'text-ink-600' : 'text-amber-400'}`}
                        >
                          {s.totaleFile == null ? '-' : delta === 0 ? 'torna' : signed(delta)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-ink-400">
              {esito.agganciati} giocatori su {esito.righeLette} agganciati al listone.
              {vuote && (
                <>
                  {' '}
                  I blocchi a rosa vuota partono esclusi: negli export capita di trovarne uno in coda che non e&apos;
                  una squadra vera. Se invece e&apos; una squadra che non ha ancora comprato, rimettici la spunta.
                </>
              )}
            </p>

            {esito.fuoriLista.length > 0 && (
              <Avviso
                tono="neutro"
                titolo={`${esito.fuoriLista.length} fuori dal listone, marcati * nel file`}
                righe={esito.fuoriLista}
                spiegazione="Sono usciti dalla Serie A dopo la data del workbook. Lo slot resta libero e la spesa non li conta: e' il motivo della differenza con il totale del file."
              />
            )}

            {esito.nonTrovati.length > 0 && (
              <Avviso
                tono="brutto"
                titolo={`${esito.nonTrovati.length} non trovati nel listone`}
                righe={esito.nonTrovati}
                spiegazione="Questi non hanno il marcatore, quindi il nome non combacia con il listone. Controllali: verranno saltati."
              />
            )}

            {esito.duplicati.length > 0 && (
              <Avviso
                tono="brutto"
                titolo={`${esito.duplicati.length} presenti in due rose`}
                righe={esito.duplicati}
                spiegazione="Vale la prima squadra in cui compaiono."
              />
            )}

            {esito.sfori.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
                <div className="font-semibold">Reparti oltre gli slot di lega</div>
                <ul className="mt-1 space-y-0.5">
                  {esito.sfori.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <p className="mt-1 text-amber-200/70">
                  Le assegnazioni si importano comunque, ma controlla gli slot in Regole della lega.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-ink-800 pt-3">
              <label className="flex items-center gap-1.5 text-xs text-ink-400">
                La mia squadra
                <select value={miaValida} onChange={(e) => setMia(e.target.value)} className="field py-1">
                  <option value="">— scegli dopo —</option>
                  {selezione.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="btn-primary"
                disabled={!selezione.teams.length}
                onClick={() => {
                  const q =
                    `Sostituire le squadre e le assegnazioni con ${selezione.teams.length} squadre e ` +
                    `${selezione.picks.length} giocatori dal file? Quello che c'e' adesso viene perso.`
                  if (confirm(q)) {
                    onConferma(selezione.teams, selezione.picks, miaValida || null, esito)
                    setEsito(null)
                    setNomeFile('')
                  }
                }}
              >
                Importa {selezione.teams.length} squadre e {selezione.picks.length} assegnazioni
              </button>
              <button className="btn" onClick={() => setEsito(null)}>
                Annulla
              </button>
            </div>
          </>
        )}
      </div>
    </Section>
  )
}

function Avviso({
  tono,
  titolo,
  righe,
  spiegazione,
}: {
  tono: 'neutro' | 'brutto'
  titolo: string
  righe: RigaRosa[]
  spiegazione: string
}) {
  const cls =
    tono === 'brutto' ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-ink-700 bg-ink-850 text-ink-300'

  return (
    <div className={`rounded-lg border px-2.5 py-2 text-xs ${cls}`}>
      <div className="font-semibold">{titolo}</div>
      <ul className="mt-1 space-y-0.5">
        {righe.map((r, i) => (
          <li key={`${r.squadra}-${r.nomeFile}-${i}`} className="flex items-center gap-1.5">
            {r.player && <RoleBadge role={r.player.r} />}
            <span className="font-medium">{r.nomeFile}</span>
            <span className="opacity-70">
              · {r.squadra} · {int(r.prezzo)} cr
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 opacity-70">{spiegazione}</p>
    </div>
  )
}
