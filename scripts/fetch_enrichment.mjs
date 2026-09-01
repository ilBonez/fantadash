#!/usr/bin/env node
/**
 * Scarica dati Serie A da football-data.org e li salva in src/data/enrichment.json.
 *
 * Il token NON entra nel bundle: questo script gira in Node, non nel browser.
 *
 *   1. Registrati (gratis) su https://www.football-data.org/client/register
 *   2. Metti il token in .env come FOOTBALL_DATA_TOKEN=xxxxx
 *   3. node --env-file=.env scripts/fetch_enrichment.mjs
 *
 * Piano free: 10 richieste/minuto, competizioni top incluse (Serie A = "SA").
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'data', 'enrichment.json')
const BASE = 'https://api.football-data.org/v4'
const COMP = 'SA'

const token = process.env.FOOTBALL_DATA_TOKEN
if (!token) {
  console.error('FOOTBALL_DATA_TOKEN mancante. Vedi il commento in cima a questo file.')
  process.exit(1)
}

/** Il piano free limita a 10 chiamate/minuto: intervalliamo le richieste. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Auth-Token': token } })
  if (res.status === 429) throw new Error(`rate limit su ${path}: riprova tra un minuto`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} su ${path}`)
  return res.json()
}

async function main() {
  const season = process.argv[2] ?? String(new Date().getFullYear())

  console.log(`Scarico Serie A ${season}...`)
  const competition = await get(`/competitions/${COMP}`)
  await sleep(7000)
  const teams = await get(`/competitions/${COMP}/teams?season=${season}`)
  await sleep(7000)
  const scorers = await get(`/competitions/${COMP}/scorers?season=${season}&limit=100`)
  await sleep(7000)
  const matches = await get(`/competitions/${COMP}/matches?season=${season}`)

  const payload = {
    provider: 'football-data.org',
    season,
    fetchedAt: new Date().toISOString(),
    competition: { id: competition.id, name: competition.name, currentMatchday: competition.currentSeason?.currentMatchday ?? null },
    squadre: teams.teams.map((t) => ({
      id: t.id,
      nome: t.shortName ?? t.name,
      nomeCompleto: t.name,
      sigla: t.tla,
      rosa: (t.squad ?? []).map((p) => ({
        id: p.id,
        nome: p.name,
        posizione: p.position,
        nazionalita: p.nationality,
        nascita: p.dateOfBirth,
      })),
    })),
    marcatori: scorers.scorers.map((s) => ({
      nome: s.player.name,
      squadra: s.team.shortName ?? s.team.name,
      gol: s.goals ?? 0,
      assist: s.assists ?? 0,
      presenze: s.playedMatches ?? 0,
      rigori: s.penalties ?? 0,
    })),
    calendario: matches.matches.map((m) => ({
      giornata: m.matchday,
      data: m.utcDate,
      stato: m.status,
      casa: m.homeTeam.shortName ?? m.homeTeam.name,
      trasferta: m.awayTeam.shortName ?? m.awayTeam.name,
      risultato: m.score?.fullTime ?? null,
    })),
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(payload, null, 1), 'utf8')
  console.log(
    `OK -> src/data/enrichment.json (${payload.squadre.length} squadre, ${payload.marcatori.length} marcatori, ${payload.calendario.length} partite)`,
  )
}

main().catch((e) => {
  console.error(`Errore: ${e.message}`)
  process.exit(1)
})
