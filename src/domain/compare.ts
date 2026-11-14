// Comparing two outputs, the way independent double programming is checked (PROC COMPARE in SAS,
// diffdf in R): match records by key, then report variables missing on either side, records
// missing on either side, and every value that differs. Numbers match within a tolerance.
import type { Frame } from './runner'

export interface Diff { key: string; variable: string; got: string | null; want: string | null }
export interface Comparison {
  ok: boolean; missingVars: string[]; extraVars: string[]; missingRows: string[]; extraRows: string[]; duplicateKeys: string[]
  diffs: Diff[]; byVariable: Record<string, number>; comparedRows: number; comparedValues: number
}
const num = (s: string | null) => (s === null || s === '' || isNaN(Number(s)) ? null : Number(s))
export function sameValue(a: string | null, b: string | null, tol = 1e-6): boolean {
  if ((a ?? '') === (b ?? '')) return true
  const x = num(a), y = num(b)
  if (x === null || y === null) return false
  return Math.abs(x - y) <= tol * Math.max(1, Math.abs(y))
}
const keyOf = (f: Frame, row: (string | null)[], keys: string[]) => keys.map((k) => row[f.columns.indexOf(k)] ?? '').join(' | ')

export function compareFrames(got: Frame, want: Frame, keys: string[], opts: { vars?: string[]; tol?: number } = {}): Comparison {
  const vars = opts.vars ?? want.columns
  const missingVars = vars.filter((v) => !got.columns.includes(v))
  const extraVars = got.columns.filter((v) => !want.columns.includes(v))
  const missingKeys = keys.filter((k) => !got.columns.includes(k))
  const out: Comparison = { ok: false, missingVars, extraVars, missingRows: [], extraRows: [], duplicateKeys: [], diffs: [], byVariable: {}, comparedRows: 0, comparedValues: 0 }
  if (missingKeys.length) return out
  const gi = new Map<string, (string | null)[]>(), dup = new Set<string>()
  for (const r of got.rows) { const k = keyOf(got, r, keys); if (gi.has(k)) dup.add(k); gi.set(k, r) }
  const wi = new Map<string, (string | null)[]>()
  for (const r of want.rows) wi.set(keyOf(want, r, keys), r)
  out.duplicateKeys = [...dup]
  out.missingRows = [...wi.keys()].filter((k) => !gi.has(k))
  out.extraRows = [...gi.keys()].filter((k) => !wi.has(k))
  for (const [k, wr] of wi) {
    const gr = gi.get(k)
    if (!gr) continue
    out.comparedRows++
    for (const v of vars) {
      if (!got.columns.includes(v) || keys.includes(v)) continue
      out.comparedValues++
      const a = gr[got.columns.indexOf(v)], b = wr[want.columns.indexOf(v)]
      if (!sameValue(a, b, opts.tol)) { out.diffs.push({ key: k, variable: v, got: a, want: b }); out.byVariable[v] = (out.byVariable[v] ?? 0) + 1 }
    }
  }
  out.ok = !missingVars.length && !out.missingRows.length && !out.extraRows.length && !out.duplicateKeys.length && !out.diffs.length
  return out
}
// The share of reference values reproduced (for partial credit and progress).
export const matchRate = (c: Comparison, want: Frame, vars = want.columns.length) => {
  const total = want.rows.length * vars
  return total ? Math.max(0, (c.comparedValues - c.diffs.length - c.missingVars.length * want.rows.length) / total) : 0
}
