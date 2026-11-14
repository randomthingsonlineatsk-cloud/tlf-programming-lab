// The R session in the browser: one webR instance, served from this site's webr/ folder (no
// outside server). It loads a hand-off, runs the reference programs once, and runs programs.
import { WebR } from 'webr'
import { readHandoff, type Handoff } from './domain/handoff'
import { loadHandoff, runReferences, runProgram, runProduction, type Frame, type RunResult } from './domain/runner'
import type { Program } from './domain/rcode'

type Status = { phase: 'idle' | 'starting' | 'loading' | 'ready' | 'error'; text: string }
let webR: WebR | null = null
let starting: Promise<WebR> | null = null
let loadedKey = ''
let refs: Record<string, Frame> = {}
let handoff: Handoff | null = null
let status: Status = { phase: 'idle', text: 'R not started' }
const listeners = new Set<(s: Status) => void>()
const set = (s: Status) => { status = s; listeners.forEach((f) => f(s)) }
export const onStatus = (f: (s: Status) => void) => { listeners.add(f); f(status); return () => { listeners.delete(f) } }
export const currentHandoff = () => handoff
export const referenceFrames = () => refs

async function start(): Promise<WebR> {
  if (webR) return webR
  starting ??= (async () => {
    set({ phase: 'starting', text: 'Starting R (about 20 MB the first time; your browser keeps it afterwards)…' })
    const w = new WebR({ baseUrl: new URL('./webr/', document.baseURI).href, interactive: false })
    await w.init()
    webR = w
    return w
  })()
  return starting
}

export async function shippedZip(): Promise<Uint8Array> {
  const r = await fetch(new URL('./data/glv-12-301-handoff.zip', document.baseURI))
  if (!r.ok) throw new Error('Could not load the shipped hand-off.')
  return new Uint8Array(await r.arrayBuffer())
}

// Make sure R is running with this project's hand-off loaded and the references computed.
// Calls are queued: two loads at once would clear each other's workspace.
let queue: Promise<unknown> = Promise.resolve()
export function ensure(key: string, zip: () => Promise<Uint8Array>): Promise<WebR> {
  const next = queue.then(() => ensureNow(key, zip))
  queue = next.catch(() => {})
  return next
}
async function ensureNow(key: string, zip: () => Promise<Uint8Array>): Promise<WebR> {
  try {
    const w = await start()
    if (loadedKey !== key) {
      set({ phase: 'loading', text: 'Loading the SDTM hand-off into R and running the reference programs…' })
      handoff = readHandoff(await zip())
      if (handoff.study.id !== 'GLV-12-301') throw new Error(`This hand-off is for ${handoff.study.id}. The lab's programs and references are written for GLV-12-301: export GLV-12-301 from the SDTM Mapping Trainer.`)
      await w.evalRVoid('rm(list = ls(all.names = TRUE))')
      await loadHandoff(w, handoff)
      refs = await runReferences(w)
      loadedKey = key
    }
    set({ phase: 'ready', text: `R ${await w.evalRString('paste(R.version$major, R.version$minor, sep = ".")')} ready · ${handoff!.study.id} · ${handoff!.datasets.length} SDTM datasets` })
    return w
  } catch (e) {
    console.error(e)
    set({ phase: 'error', text: `R could not start: ${(e as Error)?.message || String(e)}` })
    throw e
  }
}
export async function run(p: Program, code: string): Promise<RunResult> {
  if (!webR || status.phase !== 'ready') throw new Error('R is not ready yet.')
  return runProgram(webR, p, code, p.kind === 'figure' || /\bplot\(|\bhist\(|\bbarplot\(/.test(code) ? { width: 720, height: 480 } : undefined)
}
export async function production(code: string): Promise<Frame> {
  if (!webR) throw new Error('R is not ready yet.')
  return runProduction(webR, code)
}
