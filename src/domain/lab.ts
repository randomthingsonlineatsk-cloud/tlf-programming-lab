// A lab project: the learner's R programs, their last results against the reference, the QC log,
// the analysis results metadata and the mission. The SDTM data come from the shipped hand-off or
// from a hand-off the learner exported from the SDTM Mapping Trainer.
import { PROGRAMS } from './rcode'
import { FINDINGS } from './qc'
import { ARS, arsScore } from './ars'
import { hash } from './util'
import type { Comparison } from './compare'

export interface LastRun { utc: string; codeHash: string; ok: boolean; error?: string; rows?: number; matched: boolean; diffs: number; missingVars: string[]; missingRows: number; extraRows: number; rate: number; byVariable?: Record<string, number> }
export interface LabProject {
  schema: 1; id: string; name: string; created: string; updated: string
  source: 'shipped' | 'uploaded'; handoffZip?: Uint8Array; handoffName?: string; study: string
  code: Record<string, string>; runs: Record<string, LastRun>
  qc: { compared?: boolean; findings: string[] }
  ars: Record<string, string>
  mission?: { id: string; level: 'guided' | 'standard' | 'expert'; startedUtc: string; endedUtc?: string; score?: number; detail?: string[] }
  history: { utc: string; what: string }[]
}
const now = () => new Date().toISOString()
export function createProject(name: string, opts: { zip?: Uint8Array; zipName?: string; study?: string } = {}): LabProject {
  const t = now()
  return { schema: 1, id: `TLF-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name, created: t, updated: t,
    source: opts.zip ? 'uploaded' : 'shipped', handoffZip: opts.zip, handoffName: opts.zipName, study: opts.study ?? 'GLV-12-301',
    code: Object.fromEntries(PROGRAMS.map((p) => [p.id, p.starter])), runs: {}, qc: { findings: [] }, ars: {}, history: [{ utc: t, what: 'Project created' }] }
}
export const codeHash = (s: string) => hash(s.replace(/\s+$/g, ''))
export function recordRun(p: LabProject, id: string, code: string, r: { ok: boolean; error?: string; rows?: number }, c?: Comparison, rate = 0) {
  p.runs[id] = { utc: now(), codeHash: codeHash(code), ok: r.ok, error: r.error, rows: r.rows, matched: !!c?.ok, diffs: c?.diffs.length ?? 0, missingVars: c?.missingVars ?? [], missingRows: c?.missingRows.length ?? 0, extraRows: c?.extraRows.length ?? 0, rate, byVariable: c?.byVariable }
  p.updated = now(); p.history.push({ utc: now(), what: `${id} run: ${!r.ok ? `error (${r.error})` : c?.ok ? 'matches the reference' : `${c?.diffs.length ?? 0} differences`}` })
}
// A program is done when its last run matched and the code has not changed since.
export const done = (p: LabProject, id: string) => !!p.runs[id]?.matched && p.runs[id].codeHash === codeHash(p.code[id] ?? '')
const rate = (p: LabProject, id: string) => (done(p, id) ? 1 : p.runs[id]?.codeHash === codeHash(p.code[id] ?? '') ? p.runs[id].rate : 0)

export type Level = 'guided' | 'standard' | 'expert'
export interface Goal { id: string; text: string; hint: string; weight: number; met: (p: LabProject) => boolean }
export interface Mission { id: string; title: string; brief: string; programs: string[]; goals: Goal[] }
const prog = (id: string, weight: number, hint: string): Goal => ({ id, text: `${PROGRAMS.find((x) => x.id === id)!.title}: output matches the independent reference`, hint, weight, met: (p) => done(p, id) })
export const MISSIONS: Mission[] = [
  { id: 'M1', title: 'Build ADSL', programs: ['ADSL'], brief: 'Derive the subject-level dataset from DM, DS and LB to the specification: treatment variables, dates, population flags, disposition and baseline HbA1c. Every later program reads it.',
    goals: [prog('ADSL', 70, 'Read each derivation; R Dates come from as.Date(substr(x, 1, 10)).'),
      { id: 'flags', text: 'The population flags are right (RANDFL, ITTFL, SAFFL)', hint: 'Nine screen failures; one randomised participant never took a dose.', weight: 30, met: (p) => !!p.runs.ADSL && p.runs.ADSL.codeHash === codeHash(p.code.ADSL ?? '') && p.runs.ADSL.ok && !['RANDFL', 'ITTFL', 'SAFFL'].some((v) => p.runs.ADSL.missingVars.includes(v) || (p.runs.ADSL.byVariable?.[v] ?? 0) > 0) && p.runs.ADSL.missingRows === 0 }] },
  { id: 'M2', title: 'Safety: ADAE, the adverse event table and the SAE listing', programs: ['ADAE', 'T2', 'L1'], brief: 'Derive ADAE with the treatment-emergent flag, then Table 14.3.1 (participants with TEAEs by system class and preferred term) and Listing 16.2.7 (serious adverse events).',
    goals: [prog('ADAE', 35, 'The TEAE window runs to 30 days after the last dose.'), prog('T2', 35, 'Count participants with unique(); denominators from the safety population.'), prog('L1', 30, 'All serious AEs, treatment-emergent or not.')] },
  { id: 'M3', title: 'Efficacy: ADLB, the ANCOVA and the figure', programs: ['ADLB', 'T3', 'F1'], brief: 'Derive the HbA1c analysis dataset with baseline and change, analyse the primary endpoint with ANCOVA, and draw the mean change by visit.',
    goals: [prog('ADLB', 30, 'BASE comes from the record flagged ABLFL; CHG is NA at baseline.'), prog('T3', 40, 'Make treatment a factor with placebo first; predict() at the mean baseline gives the LS means.'), prog('F1', 30, 'aggregate() can return mean and SE together.')] },
  { id: 'M4', title: 'Independent QC of the adverse event table', programs: ['T2'], brief: 'The production programmer has delivered Table 14.3.1. Program it independently from the specification, compare your output with production, and log each real discrepancy with its root cause. Do not log what is not a discrepancy.',
    goals: [prog('T2', 40, 'Your QC program must match the specification, not production.'),
      { id: 'cmp', text: 'Your output compared with production', hint: 'QC page: compare with production.', weight: 10, met: (p) => !!p.qc.compared },
      { id: 'real', text: 'All three real discrepancies logged', hint: 'Look at the N row, the rows missing from production, and the preferred-term counts.', weight: 30, met: (p) => FINDINGS.filter((f) => f.real).every((f) => p.qc.findings.includes(f.id)) },
      { id: 'false', text: 'No false finding logged', hint: 'A finding needs evidence in the comparison.', weight: 20, met: (p) => !FINDINGS.filter((f) => !f.real).some((f) => p.qc.findings.includes(f.id)) }] },
  { id: 'M5', title: 'Demographics and analysis results metadata', programs: ['T1'], brief: 'Build the demographics table as analysis results data, and record the analysis results metadata for two analyses (analysis set, dataset and variable, selection, grouping, method), as CDISC\'s Analysis Results Standard describes.',
    goals: [prog('T1', 40, 'Every category of AGEGR1, SEX and RACE appears in every column, with zeros.'),
      { id: 'ars', text: 'Analysis results metadata: at least 7 of 8 right', hint: 'Efficacy on ITT, safety on the safety population; analyses read ADaM.', weight: 40, met: (p) => arsScore(p.ars).right >= 7 },
      { id: 'arsall', text: 'Every metadata field right', hint: 'Check the selection of the primary analysis.', weight: 20, met: (p) => arsScore(p.ars).right === arsScore(p.ars).total }] },
]
export const missionOf = (p: LabProject) => MISSIONS.find((m) => m.id === p.mission?.id)
export function grade(p: LabProject) {
  const m = missionOf(p)
  if (!m) return null
  const results = m.goals.map((g) => { let ok = false; try { ok = g.met(p) } catch { ok = false } return { ...g, ok } })
  const total = results.reduce((s, g) => s + g.weight, 0)
  // Programs not yet matching earn credit for the share of reference values they reproduce.
  const partial = results.filter((g) => !g.ok && PROGRAMS.some((x) => x.id === g.id)).reduce((s, g) => s + g.weight * 0.5 * rate(p, g.id), 0)
  const score = Math.round((100 * (results.filter((g) => g.ok).reduce((s, g) => s + g.weight, 0) + partial)) / total)
  return { mission: m, results, score, passed: score >= 80 }
}
export function startMission(id: string, level: Level, opts: Parameters<typeof createProject>[1] = {}): LabProject {
  const m = MISSIONS.find((x) => x.id === id)!
  const p = createProject(`Mission ${m.id}: ${m.title}`, opts)
  p.mission = { id, level, startedUtc: now() }
  return p
}
export function submitMission(p: LabProject) {
  const g = grade(p)
  if (!g) throw new Error('This project is not a mission.')
  p.mission!.endedUtc = now(); p.mission!.score = g.score; p.mission!.detail = g.results.map((r) => `${r.ok ? 'Met' : 'Not met'}: ${r.text}`)
  p.history.push({ utc: now(), what: `Mission ${g.mission.id} submitted: ${g.score}%` })
  return g
}
export const CERT_NEEDED = MISSIONS.length
export function certificate(projects: LabProject[], userId: string, name: string) {
  const runs = MISSIONS.map((m) => ({ id: m.id, title: m.title, p: projects.filter((p) => p.mission?.id === m.id && p.mission.endedUtc && (p.mission.score ?? 0) >= 80).sort((a, b) => (b.mission!.score ?? 0) - (a.mission!.score ?? 0))[0] }))
  const passed = runs.filter((r) => r.p)
  const basis = `${name.trim().toLowerCase()}|${passed.map((r) => `${r.id}:${r.p!.mission!.score}:${r.p!.mission!.level}`).join(',')}|${userId}`
  const h = hash(basis).slice(-10).toUpperCase()
  return { eligible: passed.length >= CERT_NEEDED, runs, basis, code: `TLF-${h.slice(0, 5)}-${h.slice(5)}`, distinction: passed.length >= CERT_NEEDED && passed.filter((r) => r.p!.mission!.level === 'expert').length >= 3 }
}
export const _refs = { FINDINGS, ARS }
