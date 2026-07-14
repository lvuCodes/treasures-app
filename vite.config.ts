import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// Dev-only: accept exported captures (gopher maps, saved maps) over POST and
// write them to a gitignored captures/ dir at the project root. Registered only
// for `vite serve` (apply: 'serve'), so the production static bundle ships
// without any server-side code.
function captureEndpoint(): Plugin {
  return {
    name: 'treasures-capture-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__capture', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', async () => {
          try {
            const { kind, data } = JSON.parse(body)
            // sanitize the kind into a filename-safe topic segment
            const topic = String(kind).replace(/[^a-z0-9-]/gi, '') || 'capture'
            const now = new Date()
            const date = now.toISOString().slice(0, 10) // YYYY-MM-DD
            const time = now.toTimeString().slice(0, 8).replace(/:/g, '') // HHMMSS
            const file = `${date}_${topic}_${time}.json`
            const dir = resolve(server.config.root, 'captures')
            await mkdir(dir, { recursive: true })
            await writeFile(resolve(dir, file), JSON.stringify(data, null, 2))
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: `captures/${file}` }))
          } catch (err) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the built app runs as a static bundle over file://
  // (per the zero-dependency static-zip distribution constraint).
  base: './',
  plugins: [react(), captureEndpoint()],
  test: {
    // Provide an in-memory localStorage for every test (see the setup file).
    // Test files opt into jsdom per-file via `// @vitest-environment jsdom`.
    setupFiles: ['./src/test-setup.ts'],
  },
})
