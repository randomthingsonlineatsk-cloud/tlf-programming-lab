// What this browser session holds outside the saved project: the last result of each program
// (frames and plots are not saved; the summaries are), and the batch run.
import { run, referenceFrames, currentPack } from './rclient'
import { compareFrames, matchRate, type Comparison } from './domain/compare'
import { recordRun, type LabProject, type BatchResult } from './domain/lab'
import { scanLog } from './domain/logscan'
import { cutKey, cutLabel } from './domain/cut'
import { hash } from './domain/util'
import type { RunResult, Frame } from './domain/runner'

export const lastResults = new Map<string, { res: RunResult; cmp?: Comparison }>()
export const lastFrame = (id: string) => lastResults.get(id)?.res.frame
export const sessionFrames = (): Record<string, Frame> => Object.fromEntries([...lastResults].filter(([, v]) => v.res.frame).map(([k, v]) => [k, v.res.frame!]))
const listeners = new Set<() => void>()
export const onSession = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
const changed = () => listeners.forEach((f) => f())

export async function runOne(p: LabProject, act: (fn: (x: LabProject) => void) => boolean, id: string) {
  const pack = currentPack()!
  const prog = pack.programs.find((x) => x.id === id)!
  const code = p.code[id] ?? prog.starter
  const res = await run(prog, code)
  const ref = referenceFrames()[id]
  const cmp = res.ok && res.frame ? compareFrames(res.frame, ref, prog.keys) : undefined
  lastResults.set(id, { res, cmp })
  act((x) => recordRun(x, id, code, { ok: res.ok, error: res.error, rows: res.frame?.rows.length }, cmp, cmp ? matchRate(cmp, ref) : 0))
  changed()
  return { res, cmp }
}

// Run every program in order (each reads the validated upstream datasets), scan the logs and keep
// a snapshot for comparing runs across data cuts.
export async function batchRun(p: LabProject, act: (fn: (x: LabProject) => void) => boolean, onProgress?: (id: string) => void, only?: string[]) {
  const pack = currentPack()!
  const results: Record<string, BatchResult> = {}
  for (const prog of pack.programs) {
    if (only && !only.includes(prog.id)) continue
    onProgress?.(prog.id)
    const { res, cmp } = await runOne(p, act, prog.id)
    const log = scanLog({ ok: res.ok, error: res.error, output: res.output, rows: res.frame?.rows.length }, p.code[prog.id] ?? '')
    const f = res.frame
    results[prog.id] = { ok: res.ok, matched: !!cmp?.ok, rows: f?.rows.length, log, hash: f ? hash(JSON.stringify(f)) : undefined, ...(f && prog.kind === 'ard' ? { ard: f } : {}) }
  }
  const snap = { id: `S${Date.now().toString(36)}`, utc: new Date().toISOString(), cut: cutKey(p.cut), label: cutLabel(p.cut), results }
  act((x) => { x.snapshots = [...x.snapshots.slice(-7), snap]; x.history.push({ utc: snap.utc, what: `Batch run (${snap.label}): ${Object.values(results).filter((r) => r.matched).length} of ${Object.keys(results).length} outputs match` }) })
  changed()
  return snap
}
