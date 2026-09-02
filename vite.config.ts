import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const ROOT = import.meta.dirname
const DATA_DIR = resolve(ROOT, 'data')
const INGEST = resolve(ROOT, 'scripts', 'ingest_xlsx.py')

/** File di data/ che, cambiando, fanno rigenerare il listone. */
const SORGENTI = /\.xlsx$|\/ceduti\.txt$/i

/**
 * Rigenera src/data/listone.json quando cambia una sorgente in data/: il .xlsx
 * del listone o l'elenco dei ceduti. Basta salvare e la dashboard si aggiorna
 * da sola (l'HMR ricarica il JSON).
 */
function autoIngest(): Plugin {
  let running = false
  let queued = false

  /**
   * `file` e' il .xlsx da passare allo script, o null per lasciargli scegliere
   * il piu recente in data/. `etichetta` e' solo per il log.
   */
  const ingest = (
    file: string | null,
    etichetta: string,
    log: (m: string) => void,
    warn: (m: string) => void,
  ) => {
    if (running) {
      queued = true
      return
    }
    running = true

    const tryCommand = (candidates: string[]) => {
      const [cmd, ...rest] = candidates
      if (!cmd) {
        running = false
        warn('listone: nessun interprete Python trovato. Lancia a mano "npm run ingest".')
        return
      }
      const proc = spawn(cmd, file ? [INGEST, file] : [INGEST], { cwd: ROOT })
      let stderr = ''
      // Un interprete che non esiste emette sia "error" sia "close": senza
      // questo flag ogni macchina senza il comando "python" vedrebbe un
      // avviso di ingest fallito prima del tentativo con "python3".
      let avviato = true
      proc.stderr.on('data', (d) => (stderr += String(d)))
      proc.on('error', () => {
        avviato = false
        tryCommand(rest)
      })
      proc.on('close', (code) => {
        if (!avviato) return
        running = false
        if (code === 0) {
          log(`listone rigenerato da ${etichetta}`)
        } else {
          warn(`listone: ingest fallito (${code}). ${stderr.trim().split('\n').pop() ?? ''}`)
        }
        if (queued) {
          queued = false
          ingest(file, etichetta, log, warn)
        }
      })
    }

    tryCommand(['python', 'python3', 'py'])
  }

  return {
    name: 'fantadash-auto-ingest',
    apply: 'serve',
    configureServer(server) {
      if (!existsSync(INGEST)) return
      // Chokidar 4 non supporta i glob: si guarda la cartella.
      server.watcher.add(DATA_DIR)

      // Su Windows il watcher normalizza i separatori, resolve() no.
      const posix = (p: string) => p.split('\\').join('/')
      const dir = posix(DATA_DIR)

      const onChange = (file: string) => {
        const f = posix(file)
        if (!SORGENTI.test(f)) return
        if (!f.startsWith(`${dir}/`)) return
        // I file di lock di Excel (~$nome.xlsx) non sono listoni.
        if ((f.split('/').pop() ?? '').startsWith('~$')) return
        // L'elenco dei ceduti non e' una sorgente da passare all'ingest: lo
        // script sceglie da solo il .xlsx piu recente e legge ceduti.txt.
        const xlsx = f.toLowerCase().endsWith('.xlsx')
        ingest(
          xlsx ? file : null,
          f.split('/').pop() ?? 'data/',
          (m) => server.config.logger.info(`\x1b[36m[fantadash]\x1b[0m ${m}`),
          (m) => server.config.logger.warn(`\x1b[33m[fantadash]\x1b[0m ${m}`),
        )
      }

      server.watcher.on('add', onChange)
      server.watcher.on('change', onChange)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), autoIngest()],
  // Percorsi relativi: la cartella dist/ funziona anche aperta da file://,
  // quindi si copia su qualunque PC e si apre index.html senza installare nulla.
  base: './',
  server: { port: 5180, open: true },
})
