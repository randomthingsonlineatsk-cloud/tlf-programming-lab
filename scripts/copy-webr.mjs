// Copies the webR runtime (R compiled to WebAssembly, base R packages) from node_modules into
// public/webr so the site serves R itself, with no outside server. Run before dev and build.
import { cpSync, existsSync, rmSync } from 'node:fs'
const from = new URL('../node_modules/webr/dist/', import.meta.url)
const to = new URL('../public/webr/', import.meta.url)
if (!existsSync(from)) throw new Error('webr is not installed: run npm ci')
rmSync(to, { recursive: true, force: true })
cpSync(from, to, { recursive: true, filter: (p) => !/\.map$|\/tests\/|\/repl\/|\.d\.ts$/.test(p) })
console.log('webR runtime copied to public/webr')
