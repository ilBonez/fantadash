import { useMemo, useState } from 'react'
import {
  giudizio,
  miglioriCoppie,
  miglioriTerzetti,
  type GrigliaCoppia,
  type GrigliaTerzetto,
} from '../lib/abbinamenti'
import { dec, int } from '../lib/format'
import { listone, sigle, trasferteComuni } from '../lib/listone'
import { useLeague } from '../lib/useLeague'
import { ROLES, ROLE_LABEL, type Player, type Role } from '../types'
import { FasciaBadge } from './PlayerTags'
import { Empty, ROLE_COLOR, Section, TONO_TRASFERTE } from './ui'

/**
 * Griglie di calendario.
 *
 * La matrice dice quante volte due squadre giocano ENTRAMBE in trasferta nelle
 * 38 giornate. Le coppie e i terzetti la applicano ai giocatori ancora liberi:
 * chi si alterna bene in formazione fa punti anche quando uno dei due e fuori
 * casa, ed e' l'unica cosa che all'asta si puo pianificare in anticipo.
 */
export default function GriglieView() {
  const league = useLeague()
  const [role, setRole] = useState<Role>('P')
  const [soloLiberi, setSoloLiberi] = useState(true)

  const pool = soloLiberi ? league.available : listone.giocatori

  const coppie = useMemo(() => miglioriCoppie(pool, role, 15), [pool, role])
  const terzetti = useMemo(() => miglioriTerzetti(pool, role, 15), [pool, role])

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Matrice />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <CoppieSquadre
            titolo="Migliori coppie di squadre"
            righe={listone.coppieMigliori}
            nota="meno trasferte in comune"
          />
          <CoppieSquadre
            titolo="Da non accoppiare"
            righe={listone.coppiePeggiori}
            nota="quasi sempre fuori insieme"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                role === r ? ROLE_COLOR[r] : 'border-ink-700 bg-ink-850 text-ink-400 hover:text-ink-100'
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-300">
          <input
            type="checkbox"
            checked={soloLiberi}
            onChange={(e) => setSoloLiberi(e.target.checked)}
            className="size-3.5 accent-sky-500"
          />
          solo giocatori ancora liberi
        </label>
        <span className="text-[11px] text-ink-500">
          Punteggio: 60% qualita dal listone, 40% copertura di calendario.
        </span>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <GrigliaCoppie righe={coppie} />
        <GrigliaTerzetti righe={terzetti} />
      </div>

      {role === 'P' && listone.terzettiPortieri.length > 0 && (
        <Section
          title="Terzetti di portieri del listone"
          right={<span className="text-[11px] text-ink-500">classifica fissa dal workbook</span>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-ink-800 text-[11px] uppercase tracking-wide text-ink-400">
                  <th className="px-3 py-1.5 text-left font-semibold">Terzetto</th>
                  <th className="px-3 py-1.5 text-right font-semibold" title="1+2, 1+3, 2+3">
                    Coppie
                  </th>
                  <th className="px-3 py-1.5 text-right font-semibold">Totale</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Costo</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Indice</th>
                </tr>
              </thead>
              <tbody>
                {listone.terzettiPortieri.map((t) => (
                  <tr key={t.p.join('|')} className="border-b border-ink-800/60">
                    <td className="px-3 py-1.5">{t.p.join('  +  ')}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-[11px] text-ink-400">
                      {t.t.join(' · ')}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-semibold ${TONO_TRASFERTE[t.tot <= 19 ? 'ottimo' : 'buono']}`}>
                      {t.tot}
                    </td>
                    <td className="px-3 py-1.5 text-right text-ink-300">{int(t.costo)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-400">{dec(t.indice, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <p className="px-1 pb-2 text-xs leading-relaxed text-ink-400">{listone.comeSiLegge}</p>
    </div>
  )
}

/** Colore della cella: verde quando le due squadre si coprono, rosso quando no. */
function cellaColore(t: number): string {
  if (t <= 3) return 'bg-emerald-500/30 text-emerald-100'
  if (t <= 6) return 'bg-emerald-500/15 text-emerald-200/90'
  if (t <= 8) return 'bg-ink-800 text-ink-300'
  if (t <= 10) return 'bg-amber-500/15 text-amber-200/90'
  if (t <= 12) return 'bg-rose-500/20 text-rose-200'
  return 'bg-rose-500/35 text-rose-100'
}

function Matrice() {
  const squadre = listone.squadre

  return (
    <Section
      title="Trasferte in comune"
      right={<span className="text-[11px] text-ink-500">giornate su 38 · verde = si coprono</span>}
    >
      <div className="overflow-x-auto p-2">
        <table className="border-separate border-spacing-0 text-[10px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-ink-900 px-1 py-1" />
              {squadre.map((s) => (
                <th
                  key={s}
                  title={s}
                  className="px-1 py-1 text-center font-mono font-semibold text-ink-400"
                >
                  {sigle[s] ?? s.slice(0, 3).toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {squadre.map((a) => (
              <tr key={a}>
                <th
                  title={a}
                  className="sticky left-0 z-10 bg-ink-900 px-1 py-0.5 text-right font-mono text-[10px] font-semibold text-ink-400"
                >
                  {sigle[a] ?? a.slice(0, 3).toUpperCase()}
                </th>
                {squadre.map((b) => {
                  if (a === b) return <td key={b} className="bg-ink-850/60 px-1 py-0.5" />
                  const t = trasferteComuni(a, b)
                  return (
                    <td
                      key={b}
                      title={`${a} e ${b}: entrambe in trasferta ${t} volte su 38 · ${giudizio(t).label}`}
                      className={`px-1 py-0.5 text-center font-medium tabular-nums ${cellaColore(t)}`}
                    >
                      {t}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function CoppieSquadre({
  titolo,
  righe,
  nota,
}: {
  titolo: string
  righe: { a: string; b: string; t: number; giudizio: string }[]
  nota: string
}) {
  return (
    <Section title={titolo} right={<span className="text-[11px] text-ink-500">{nota}</span>}>
      <ul className="max-h-72 divide-y divide-ink-800 overflow-auto">
        {righe.map((c, i) => (
          <li key={`${c.a}-${c.b}`} className="flex items-center gap-2 px-3 py-1 text-[13px]">
            <span className="w-4 shrink-0 text-right text-[11px] text-ink-600">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              {c.a} <span className="text-ink-500">+</span> {c.b}
            </span>
            <span className={`w-6 shrink-0 text-right font-semibold ${TONO_TRASFERTE[giudizio(c.t).tono]}`}>
              {c.t}
            </span>
            <span className="w-16 shrink-0 text-right text-[11px] text-ink-500">{c.giudizio}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Nome({ p }: { p: Player }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="truncate">{p.nome}</span>
      <span className="shrink-0 font-mono text-[10px] text-ink-500">{p.cod}</span>
    </span>
  )
}

function GrigliaCoppie({ righe }: { righe: GrigliaCoppia[] }) {
  return (
    <Section
      title="Coppie consigliate"
      right={<span className="text-[11px] text-ink-500">due che si alternano</span>}
    >
      {righe.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-ink-800 text-[11px] uppercase tracking-wide text-ink-400">
                <th className="px-3 py-1.5 text-left font-semibold">Coppia</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Trasferte in comune su 38">
                  Tras.
                </th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Somma dei prezzi consigliati">
                  Costo
                </th>
                <th className="px-3 py-1.5 text-right font-semibold">Indice</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((c) => (
                <tr key={c.giocatori.map((p) => p.id).join('-')} className="border-b border-ink-800/60">
                  <td className="px-3 py-1.5">
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <Nome p={c.giocatori[0]} />
                      <FasciaBadge fascia={c.giocatori[0].fascia} />
                      <span className="text-ink-600">+</span>
                      <Nome p={c.giocatori[1]} />
                      <FasciaBadge fascia={c.giocatori[1].fascia} />
                    </span>
                  </td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${TONO_TRASFERTE[giudizio(c.t).tono]}`}>
                    {c.t}
                  </td>
                  <td className="px-2 py-1.5 text-right text-ink-300">{int(c.costo)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-400">{dec(c.indiceMedio, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Non restano abbastanza giocatori liberi in questo reparto.</Empty>
      )}
    </Section>
  )
}

function GrigliaTerzetti({ righe }: { righe: GrigliaTerzetto[] }) {
  return (
    <Section
      title="Terzetti consigliati"
      right={<span className="text-[11px] text-ink-500">19 e il totale minimo possibile</span>}
    >
      {righe.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-ink-800 text-[11px] uppercase tracking-wide text-ink-400">
                <th className="px-3 py-1.5 text-left font-semibold">Terzetto</th>
                <th className="px-2 py-1.5 text-right font-semibold" title="Somma delle tre coppie">
                  Tot
                </th>
                <th className="px-2 py-1.5 text-right font-semibold">Costo</th>
                <th className="px-3 py-1.5 text-right font-semibold">Indice</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((t) => (
                <tr key={t.giocatori.map((p) => p.id).join('-')} className="border-b border-ink-800/60">
                  <td className="px-3 py-1.5" title={`Coppie: ${t.t.join(' + ')} = ${t.tot}`}>
                    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <Nome p={t.giocatori[0]} />
                      <span className="text-ink-600">+</span>
                      <Nome p={t.giocatori[1]} />
                      <span className="text-ink-600">+</span>
                      <Nome p={t.giocatori[2]} />
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right font-semibold ${
                      TONO_TRASFERTE[t.tot <= 19 ? 'ottimo' : t.tot <= 26 ? 'buono' : 'medio']
                    }`}
                  >
                    {t.tot}
                  </td>
                  <td className="px-2 py-1.5 text-right text-ink-300">{int(t.costo)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-400">{dec(t.indiceMedio, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Non restano abbastanza giocatori liberi in questo reparto.</Empty>
      )}
    </Section>
  )
}
