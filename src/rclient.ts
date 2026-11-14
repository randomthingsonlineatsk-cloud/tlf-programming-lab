// The R session in the browser: one webR instance, served from this site's webr/ folder (no
// outside server). It loads a hand-off (with the project's data cut applied), runs the reference
// programs once, and runs the learner's programs.
import { WebR } from 'webr'
import { readHandoff, type Handoff } from './domain/handoff'
import { loadHandoff, runReferences, runProgram, runProduction, runAnswer, runTrace, frameOf, type Frame, type RunResult } from './domain/runner'
import { PACKS, type Program, type StudyPack } from './domain/rcode'
import { DUMMY_R, TRANSFER2, type Cut } from './domain/cut'

type Status = { phase: 'idle' | 'starting' | 'loading' | 'ready' | 'error'; text: string }
let webR: WebR | null = null
let starting: Promise<WebR> | null = null
let loadedKey = ''
let refs: Record<string, Frame> = {}
let handoff: Handoff | null = null
let pack: StudyPack | null = null
let status: Status = { phase: 'idle', text: 'R not started' }
const listeners = new Set<(s: Status) => void>()
const set = (s: Status) => { status = s; listeners.forEach((f) => f(s)) }
export const onStatus = (f: (s: Status) => void) => { listeners.add(f); f(status); return () => { listeners.delete(f) } }
export const currentHandoff = () => handoff
export const currentPack = () => pack
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

// Make sure R is running with this project's hand-off and data cut loaded and the references computed.
// Calls are queued: two loads at once would clear each other's workspace.
let queue: Promise<unknown> = Promise.resolve()
export function ensure(key: string, zip: () => Promise<Uint8Array>, cut: Cut): Promise<WebR> {
  const next = queue.then(() => ensureNow(key, zip, cut))
  queue = next.catch(() => {})
  return next
}
async function ensureNow(key: string, zip: () => Promise<Uint8Array>, cut: Cut): Promise<WebR> {
  try {
    const w = await start()
    if (loadedKey !== key) {
      set({ phase: 'loading', text: 'Loading the SDTM hand-off into R…' })
      handoff = readHandoff(await zip())
      pack = PACKS[handoff.study.id] ?? null
      if (!pack) throw new Error(`This hand-off is for ${handoff.study.id}. The lab has programs for ${Object.keys(PACKS).join(' and ')}.`)
      await w.evalRVoid('rm(list = ls(all.names = TRUE))')
      await loadHandoff(w, handoff)
      if (cut.transfer === 2 && TRANSFER2[pack.id]) await w.evalRVoid(TRANSFER2[pack.id].r)
      if (cut.phase === 'dry') await w.evalRVoid(DUMMY_R)
      refs = await runReferences(w, pack, (id) => set({ phase: 'loading', text: `Running the reference programs: ${id}…` }))
      loadedKey = key
    }
    set({ phase: 'ready', text: `R ${await w.evalRString('paste(R.version$major, R.version$minor, sep = ".")')} ready · ${handoff!.study.id}${cut.phase === 'dry' ? ' · DRY RUN, dummy codes' : ''}${cut.transfer === 2 ? ' · transfer 2' : ''}` })
    return w
  } catch (e) {
    console.error(e)
    loadedKey = ''
    set({ phase: 'error', text: `R could not start: ${(e as Error)?.message || String(e)}` })
    throw e
  }
}
const need = () => { if (!webR || !pack || status.phase !== 'ready') throw new Error('R is not ready yet.'); return { w: webR, pk: pack } }
const gfx = (p: Program, code: string) => (p.kind === 'figure' || /\bplot\(|\bhist\(|\bbarplot\(/.test(code) ? { width: 760, height: 520 } : undefined)
export async function run(p: Program, code: string): Promise<RunResult> {
  const { w, pk } = need()
  return runProgram(w, p, code, gfx(p, code), pk)
}
export async function production(code: string): Promise<Frame> {
  const { w } = need()
  return runProduction(w, code)
}
export async function answer(code: string) {
  const { w, pk } = need()
  return runAnswer(w, pk, code)
}
export async function trace(adam: string, sdtm?: { domain: string; by: string[] }) {
  const { w, pk } = need()
  return runTrace(w, pk, adam, sdtm)
}
// Optional packages from the webR package repository (downloaded by the browser).
export async function installPackages(names: string[]): Promise<{ name: string; ok: boolean; detail: string }[]> {
  const { w } = need()
  const out: { name: string; ok: boolean; detail: string }[] = []
  for (const n of names) {
    try {
      await w.installPackages([n], { quiet: true })
      const ok = await w.evalRBoolean(`suppressWarnings(suppressMessages(requireNamespace(${JSON.stringify(n)}, quietly = TRUE)))`)
      out.push({ name: n, ok, detail: ok ? 'installed; use library(' + n + ')' : 'not available in the webR repository' })
    } catch (e) { out.push({ name: n, ok: false, detail: (e as Error).message }) }
  }
  return out
}
// An SDTM dataset as R holds it (with the project's data cut applied).
export async function sdtm(name: string): Promise<Frame> {
  const { w } = need()
  return frameOf(w, `${name.toLowerCase()}`)
}
