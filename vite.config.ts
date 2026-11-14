import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'
import type { Connect } from 'vite'

// webR inflates its .gz file-system images itself, so they must reach it as stored. Vite's servers
// would mark them Content-Encoding: gzip and the browser would decompress them first; GitHub Pages
// serves them as stored.
const rawGz = (root: string): Connect.NextHandleFunction => (req, res, next) => {
  const path = decodeURIComponent((req.url ?? '').split('?')[0])
  const i = path.indexOf('/webr/')
  if (i < 0 || !path.endsWith('.gz')) return next()
  const file = fileURLToPath(new URL(`./${root}/${path.slice(i + 1)}`, import.meta.url))
  if (!existsSync(file)) return next()
  res.setHeader('Content-Type', 'application/octet-stream')
  res.end(readFileSync(file))
}

// Relative base so the built site works from any GitHub Pages path.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), { name: 'webr-raw-gz', configureServer: (s) => { s.middlewares.use(rawGz('public')) }, configurePreviewServer: (s) => { s.middlewares.use(rawGz('dist')) } }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
