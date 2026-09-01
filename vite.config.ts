import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const ROOT = import.meta.dirname
const DATA_DIR = resolve(ROOT, 'data')
const INGEST = resolve(ROOT, 'scripts', 'ingest_xlsx.py')

/**
 * Rigenera src/data/listone.json quando un .xlsx in data/ viene aggiunto o
 * modificato: basta sostituire il file ufficiale e la dashboard si aggiorna
 * da sola (l'HMR ricarica il JSON).
 */
function autoIngest(): Plugin {
  let running = false
  let queued = false

  const ingest = (file: string, log: (m: string) => void, warn: (m: string) => void) => {
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
      const proc = spawn(cmd, [INGEST, file], { cwd: ROOT })
      let stderr = ''
      proc.stderr.on('data', (d) => (stderr += String(d)))
      proc.on('error', () => tryCommand(rest))
      proc.on('close', (code) => {
        running = false
        if (code === 0) {
          log(`listone rigenerato da ${file.split(/[\\/]/).pop()}`)
        } else {
          warn(`listone: ingest fallito (${code}). ${stderr.trim().split('\n').pop() ?? ''}`)
        }
        if (queued) {
          queued = false
          ingest(file, log, warn)
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
        if (!f.toLowerCase().endsWith('.xlsx')) return
        if (!f.startsWith(`${dir}/`)) return
        // I file di lock di Excel (~$nome.xlsx) non sono listoni.
        if ((f.split('/').pop() ?? '').startsWith('~$')) return
        ingest(
          file,
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
  server: { port: 5180, open: true },
})
