// A lab project: the learner's R programs, their last results against the reference, the
// programming tracker, batch runs and their logs, data cuts, the QC log, the analysis results
// metadata, the submission documents and the mission. The SDTM data come from the shipped hand-off
// or from a hand-off the learner exported from the SDTM Mapping Trainer.
import { packOf } from './rcode'
import { FINDINGS } from './qc'
import { ARS, arsScore } from './ars'
import { IRS } from './ir'
import { AI_ISSUES, AI_RECORD_FIELDS } from './aiwork'
import { REVIEW_KEY, type ReviewCategory } from './review'
import { DEFAULT_CUT, type Cut } from './cut'
import { hash } from './util'
import type { Comparison } from './compare'
import type { IrAnswer } from './ir'

export interface LastRun { utc: string; codeHash: string; ok: boolean; error?: string; rows?: number; matched: boolean; diffs: number; missingVars: string[]; missingRows: number; extraRows: number; rate: number; byVariable?: Record<string, number>; cut?: string }
export type TrackStatus = 'Not started' | 'In development' | 'Ready for QC' | 'QC issues' | 'Validated'
export interface Issue { id: string; text: string; raisedUtc: string; by: 'QC' | 'Programmer'; resolvedUtc?: string; resolution?: string }
export interface Track { status: TrackStatus; issues: Issue[]; readyUtc?: string; validatedUtc?: string; validatedHash?: string }
export interface BatchResult { ok: boolean; matched: boolean; rows?: number; log: { level: string; text: string }[]; hash?: string; ard?: { columns: string[]; rows: (string | null)[][] } }
export interface Snapshot { id: string; utc: string; cut: string; label: string; results: Record<string, BatchResult> }
export interface LabProject {
  schema: 2; id: string; name: string; created: string; updated: string
  source: 'shipped' | 'uploaded'; handoffZip?: Uint8Array; handoffName?: string; study: string
  code: Record<string, string>; runs: Record<string, LastRun>
  qc: { compared?: boolean; findings: string[] }
  ars: Record<string, string>
  tracker: Record<string, Track>
  snapshots: Snapshot[]
  cut: Cut; cutsDone: string[]
  changedReview?: { from: string; to: string; marked: string[]; checkedUtc?: string; correct?: boolean }
  conformance?: { utc: string; findings: { rule: string; sev: string; dataset: string; message: string; count: number; examples: string[] }[] }
  adrg: { author: string; subjectIssues: string; explanations: Record<string, string> }
  submission: { defineUtc?: string; adrgUtc?: string; arsUtc?: string; packageUtc?: string }
  ir: Record<string, IrAnswer>
  ai: { code: string; issues: string[]; record: Record<string, string>; matched?: boolean }
  review: { marks: Record<number, ReviewCategory>; submittedUtc?: string }
  packages: string[]
  mission?: { id: string; level: 'guided' | 'standard' | 'expert'; startedUtc: string; endedUtc?: string; score?: number; detail?: string[] }
  history: { utc: string; what: string }[]
}
const now = () => new Date().toISOString()
export function createProject(name: string, opts: { zip?: Uint8Array; zipName?: string; study?: string; cut?: Cut } = {}): LabProject {
  const t = now(), pack = packOf(opts.study ?? 'GLV-12-301')
  return {
    schema: 2, id: `TLF-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name, created: t, updated: t,
    source: opts.zip ? 'uploaded' : 'shipped', handoffZip: opts.zip, handoffName: opts.zipName, study: pack.id,
    code: Object.fromEntries(pack.programs.map((p) => [p.id, p.starter])), runs: {}, qc: { findings: [] }, ars: {},
    tracker: {}, snapshots: [], cut: opts.cut ?? { ...DEFAULT_CUT }, cutsDone: [], adrg: { author: '', subjectIssues: '', explanations: {} }, submission: {},
    ir: {}, ai: { code: '', issues: [], record: {} }, review: { marks: {} }, packages: [],
    history: [{ utc: t, what: 'Project created' }],
  }
}
// Projects saved before study packs and the workflow features.
export function upgrade(p: LabProject): LabProject {
  const q = p as LabProject & { schema: number }
  if (q.schema === 2) return p
  return { ...createProject(p.name, { study: p.study }), ...p, schema: 2, id: p.id, created: p.created }
}
export const codeHash = (s: string) => hash(s.replace(/\s+$/g, ''))
export function recordRun(p: LabProject, id: string, code: string, r: { ok: boolean; error?: string; rows?: number }, c?: Comparison, rate = 0) {
  p.runs[id] = { utc: now(), codeHash: codeHash(code), ok: r.ok, error: r.error, rows: r.rows, matched: !!c?.ok, diffs: c?.diffs.length ?? 0, missingVars: c?.missingVars ?? [], missingRows: c?.missingRows.length ?? 0, extraRows: c?.extraRows.length ?? 0, rate, byVariable: c?.byVariable, cut: `${p.cut.phase}-${p.cut.transfer}` }
  p.updated = now(); p.history.push({ utc: now(), what: `${id} run: ${!r.ok ? `error (${r.error})` : c?.ok ? 'matches the reference' : `${c?.diffs.length ?? 0} differences`}` })
}
// A program is done when its last run matched and the code has not changed since.
export const done = (p: LabProject, id: string) => !!p.runs[id]?.matched && p.runs[id].codeHash === codeHash(p.code[id] ?? '')
const rate = (p: LabProject, id: string) => (done(p, id) ? 1 : p.runs[id]?.codeHash === codeHash(p.code[id] ?? '') ? p.runs[id].rate : 0)

// ---------- Programming tracker ----------
export function trackOf(p: LabProject, id: string): Track {
  const t = p.tracker[id] ?? { status: 'Not started', issues: [] }
  const prog = packOf(p.study).programs.find((x) => x.id === id)
  const changed = (p.code[id] ?? '') !== (prog?.starter ?? '')
  if (t.status === 'Validated' && t.validatedHash !== codeHash(p.code[id] ?? '')) return { ...t, status: 'In development' }
  if (t.status === 'Not started' && changed) return { ...t, status: 'In development' }
  return t
}
export function markReady(p: LabProject, id: string) {
  const t = trackOf(p, id)
  if (t.status === 'Not started') throw new Error('Write the program first.')
  p.tracker[id] = { ...t, status: 'Ready for QC', readyUtc: now() }
  p.history.push({ utc: now(), what: `${id} marked ready for QC` })
}
// QC by the lab's independent program: validated when the output matches and the log is clean.
export function qcOutput(p: LabProject, id: string, logClean: boolean) {
  const t = trackOf(p, id)
  if (t.status !== 'Ready for QC' && t.status !== 'QC issues') throw new Error('Mark the program ready for QC first.')
  const ok = done(p, id) && logClean
  const r = p.runs[id]
  const issues = [...t.issues]
  if (!ok) issues.push({ id: `I${issues.length + 1}`, raisedUtc: now(), by: 'QC', text: !done(p, id) ? (r ? `Independent QC: ${r.ok ? `${r.diffs} values differ${r.missingVars.length ? `, missing ${r.missingVars.join(', ')}` : ''}${r.missingRows ? `, ${r.missingRows} records missing` : ''}${r.extraRows ? `, ${r.extraRows} extra records` : ''}` : `program error: ${r.error}`}` : 'Independent QC: the program has not been run on this code.') : 'Log review: the log is not clean (see the batch run).' })
  p.tracker[id] = ok ? { ...t, issues: issues.map((i) => (i.resolvedUtc ? i : { ...i, resolvedUtc: now(), resolution: 'Resolved: output matches the independent QC program.' })), status: 'Validated', validatedUtc: now(), validatedHash: codeHash(p.code[id] ?? '') } : { ...t, issues, status: 'QC issues' }
  p.history.push({ utc: now(), what: `${id} QC: ${ok ? 'validated' : 'issues raised'}` })
}

// ---------- Missions ----------
export type Level = 'guided' | 'standard' | 'expert'
export interface Goal { id: string; text: string; hint: string; weight: number; met: (p: LabProject) => boolean; credit?: (p: LabProject) => number }
export interface Mission { id: string; title: string; brief: string; programs: string[]; goals: Goal[]; core: boolean; cut?: Cut; view?: string }
const prog = (id: string, weight: number, hint: string): Goal => ({ id, text: `${packOf('GLV-12-301').programs.find((x) => x.id === id)!.title}: output matches the independent reference`, hint, weight, met: (p) => done(p, id), credit: (p) => 0.5 * rate(p, id) })
const frac = (n: number, d: number) => (d ? n / d : 0)
export const MISSIONS: Mission[] = [
  { id: 'M1', core: true, title: 'Build ADSL', programs: ['ADSL'], brief: 'Derive the subject-level dataset from DM, DS and LB to the specification: treatment variables, dates, population flags, disposition and baseline HbA1c. Every later program reads it.',
    goals: [prog('ADSL', 70, 'Read each derivation; R Dates come from as.Date(substr(x, 1, 10)).'),
      { id: 'flags', text: 'The population flags are right (RANDFL, ITTFL, SAFFL)', hint: 'Nine screen failures; one randomised participant never took a dose.', weight: 30, met: (p) => !!p.runs.ADSL && p.runs.ADSL.codeHash === codeHash(p.code.ADSL ?? '') && p.runs.ADSL.ok && !['RANDFL', 'ITTFL', 'SAFFL'].some((v) => p.runs.ADSL.missingVars.includes(v) || (p.runs.ADSL.byVariable?.[v] ?? 0) > 0) && p.runs.ADSL.missingRows === 0 }] },
  { id: 'M2', core: true, title: 'Safety: ADAE, the adverse event table and the SAE listing', programs: ['ADAE', 'T2', 'L1'], brief: 'Derive ADAE with the imputed start dates and the treatment-emergent flag, then Table 14.3.1 (participants with TEAEs by system class and preferred term) and Listing 16.2.7 (serious adverse events).',
    goals: [prog('ADAE', 35, 'The TEAE window runs to 30 days after the last dose; one AE has a partial start date.'), prog('T2', 35, 'Count participants with unique(); denominators from the safety population.'), prog('L1', 30, 'All serious AEs, treatment-emergent or not.')] },
  { id: 'M3', core: true, title: 'Efficacy: ADLB, the ANCOVA and the figure', programs: ['ADLB', 'T3', 'F1'], brief: 'Derive the HbA1c analysis dataset with baseline and change, analyse the primary endpoint with ANCOVA, and draw the mean change by visit.',
    goals: [prog('ADLB', 30, 'BASE comes from the record flagged ABLFL; CHG is NA at baseline.'), prog('T3', 40, 'Make treatment a factor with placebo first; predict() at the mean baseline gives the LS means.'), prog('F1', 30, 'aggregate() can return mean and SE together.')] },
  { id: 'M4', core: true, title: 'Independent QC of the adverse event table', programs: ['T2'], view: 'qc', brief: 'The production programmer has delivered Table 14.3.1. Program it independently from the specification, compare your output with production, and log each real discrepancy with its root cause. Do not log what is not a discrepancy.',
    goals: [prog('T2', 40, 'Your QC program must match the specification, not production.'),
      { id: 'cmp', text: 'Your output compared with production', hint: 'Independent QC page: compare with production.', weight: 10, met: (p) => !!p.qc.compared },
      { id: 'real', text: 'All three real discrepancies logged', hint: 'Look at the N row, the rows missing from production, and the preferred-term counts.', weight: 30, met: (p) => FINDINGS.filter((f) => f.real).every((f) => p.qc.findings.includes(f.id)), credit: (p) => frac(FINDINGS.filter((f) => f.real && p.qc.findings.includes(f.id)).length, 3) },
      { id: 'false', text: 'No false finding logged', hint: 'A finding needs evidence in the comparison.', weight: 20, met: (p) => !FINDINGS.filter((f) => !f.real).some((f) => p.qc.findings.includes(f.id)) }] },
  { id: 'M5', core: true, title: 'Demographics and analysis results metadata', programs: ['T1'], view: 'metadata', brief: 'Build the demographics table as analysis results data, and record the analysis results metadata for two analyses (analysis set, dataset and variable, selection, grouping, method), as CDISC\'s Analysis Results Standard describes.',
    goals: [prog('T1', 40, 'Every category of AGEGR1, SEX and RACE appears in every column, with zeros.'),
      { id: 'ars', text: 'Analysis results metadata: at least 7 of 8 right', hint: 'Efficacy on ITT, safety on the safety population; analyses read ADaM.', weight: 40, met: (p) => arsScore(p.ars).right >= 7 },
      { id: 'arsall', text: 'Every metadata field right', hint: 'Check the selection of the primary analysis.', weight: 20, met: (p) => arsScore(p.ars).right === arsScore(p.ars).total }] },
  { id: 'M6', core: false, title: 'Answer the agency\'s information requests', programs: [], view: 'ir', brief: 'The review division has sent six information requests about the submitted analyses. Each has a response clock. Answer each in R from the validated datasets and write the response text that goes back with the numbers.',
    goals: [{ id: 'right', text: 'Every request answered correctly', hint: 'The validated datasets are loaded under their usual names.', weight: 60, met: (p) => IRS.every((r) => p.ir[r.id]?.correct), credit: (p) => frac(IRS.filter((r) => p.ir[r.id]?.correct).length, IRS.length) },
      { id: 'letters', text: 'A response text for every request (at least 40 characters)', hint: 'Say what was done and on which population.', weight: 20, met: (p) => IRS.every((r) => (p.ir[r.id]?.letter ?? '').trim().length >= 40), credit: (p) => frac(IRS.filter((r) => (p.ir[r.id]?.letter ?? '').trim().length >= 40).length, IRS.length) },
      { id: 'time', text: 'Every request answered within its response time', hint: 'The clock starts when you open the request.', weight: 20, met: (p) => IRS.every((r) => p.ir[r.id]?.correct && p.ir[r.id]?.onTime), credit: (p) => frac(IRS.filter((r) => p.ir[r.id]?.correct && p.ir[r.id]?.onTime).length, IRS.length) }] },
  { id: 'M7', core: false, title: 'Validate a program written by an AI assistant', programs: [], view: 'ai', brief: 'A coding assistant drafted Table 14.3.1 from the specification. Treat it as a draft: run it, compare it, log what is wrong (and only that), fix it until it matches the independent reference, and record how AI was used and how its output was verified.',
    goals: [{ id: 'issues', text: 'The three real defects logged', hint: 'Population, grouping, counting unit.', weight: 30, met: (p) => AI_ISSUES.filter((i) => i.real).every((i) => p.ai.issues.includes(i.id)), credit: (p) => frac(AI_ISSUES.filter((i) => i.real && p.ai.issues.includes(i.id)).length, 3) },
      { id: 'nofalse', text: 'No false defect logged', hint: 'Display choices are not defects in analysis results.', weight: 10, met: (p) => !AI_ISSUES.filter((i) => !i.real).some((i) => p.ai.issues.includes(i.id)) },
      { id: 'fixed', text: 'The corrected program matches the independent reference', hint: 'Run it on the AI page after fixing.', weight: 40, met: (p) => !!p.ai.matched },
      { id: 'record', text: 'The AI use record is complete', hint: 'Context of use, verification, changes: a sentence each at least.', weight: 20, met: (p) => AI_RECORD_FIELDS.every((f) => (p.ai.record[f.id] ?? '').trim().length >= 30) }] },
  { id: 'M8', core: false, title: 'Review a colleague\'s program without running it', programs: [], view: 'review', brief: 'Read the production ADAE program line by line before it is run. Mark each line that is wrong and say what kind of problem it is. Marking a correct line costs points.',
    goals: [{ id: 'found', text: 'Every problem line found', hint: 'Six lines; joins, filters, typed-in values, sorts and the specification.', weight: 50, met: (p) => REVIEW_KEY.every((k) => p.review.marks[k.line]), credit: (p) => frac(REVIEW_KEY.filter((k) => p.review.marks[k.line]).length, REVIEW_KEY.length) },
      { id: 'cat', text: 'Each problem given the right category', hint: 'A typed-in date is a hard-coded value; a dropped row is a silent loss.', weight: 30, met: (p) => REVIEW_KEY.every((k) => p.review.marks[k.line] === k.cat), credit: (p) => frac(REVIEW_KEY.filter((k) => p.review.marks[k.line] === k.cat).length, REVIEW_KEY.length) },
      { id: 'clean', text: 'No correct line marked', hint: 'Only mark what you could defend in the review meeting.', weight: 20, met: (p) => Object.keys(p.review.marks).every((l) => REVIEW_KEY.some((k) => k.line === Number(l))) }] },
  { id: 'M9', core: false, title: 'ADaM submission package: conformance, define.xml and reviewer\'s guide', programs: ['ADSL', 'ADAE', 'ADLB', 'ADLBC', 'ADVS', 'ADCM', 'ADTTE'], view: 'submission', brief: 'Program all seven analysis datasets, run the ADaM conformance checks on them, explain any finding that remains in the analysis data reviewer\'s guide, and produce define.xml and the reviewer\'s guide.',
    goals: [{ id: 'adam', text: 'All seven analysis datasets match the reference', hint: 'Programs page, ADaM section.', weight: 40, met: (p) => ['ADSL', 'ADAE', 'ADLB', 'ADLBC', 'ADVS', 'ADCM', 'ADTTE'].every((id) => done(p, id)), credit: (p) => frac(['ADSL', 'ADAE', 'ADLB', 'ADLBC', 'ADVS', 'ADCM', 'ADTTE'].filter((id) => done(p, id)).length, 7) },
      { id: 'conf', text: 'Conformance checks run on your datasets with no error left', hint: 'Submission page: run the checks.', weight: 20, met: (p) => !!p.conformance && !p.conformance.findings.some((f) => f.sev === 'Error') },
      { id: 'explain', text: 'Every remaining finding explained', hint: 'Each warning or notice needs a sentence in the reviewer\'s guide.', weight: 10, met: (p) => !!p.conformance && p.conformance.findings.every((f) => (p.adrg.explanations[`${f.dataset}|${f.rule}|${f.message}`] ?? '').trim().length >= 15) },
      { id: 'docs', text: 'define.xml and the reviewer\'s guide produced, with the subject issues section written', hint: 'Section 3.4: the participants that need special rules.', weight: 30, met: (p) => !!p.submission.defineUtc && !!p.submission.adrgUtc && p.adrg.subjectIssues.trim().length >= 40 && p.adrg.author.trim().length > 1 }] },
  { id: 'M10', core: false, title: 'Dry run, unblinding and the second data transfer', programs: ['ADSL', 'ADAE', 'ADLB', 'T2', 'T3'], view: 'runs', cut: { phase: 'dry', transfer: 1 }, brief: 'Program on dummy treatment codes, run everything as a batch with a clean log and get each output validated on the tracker. Then unblind and rerun, then take transfer 2 and rerun, and say which outputs the new data changed.',
    goals: [{ id: 'dry', text: 'Batch run on dummy codes: every program in this mission runs with a clean log', hint: 'Program headers count in the log review.', weight: 20, met: (p) => p.snapshots.some((s) => s.cut === 'dry-1' && ['ADSL', 'ADAE', 'ADLB', 'T2', 'T3'].every((id) => s.results[id]?.ok && !s.results[id].log.some((l) => l.level !== 'NOTE' || l.text.startsWith('Program header')))) },
      { id: 'tracker', text: 'Every output of this mission validated on the tracker', hint: 'Mark ready for QC, then run QC.', weight: 20, met: (p) => ['ADSL', 'ADAE', 'ADLB', 'T2', 'T3'].every((id) => trackOf(p, id).status === 'Validated') },
      { id: 'unblind', text: 'Unblinded and rerun: all outputs match the reference', hint: 'Runs page: unblind, then batch run.', weight: 20, met: (p) => p.snapshots.some((s) => s.cut === 'final-1' && ['ADSL', 'ADAE', 'ADLB', 'T2', 'T3'].every((id) => s.results[id]?.matched)) },
      { id: 't2', text: 'Transfer 2 loaded and rerun: all outputs match the reference', hint: 'Runs page: load transfer 2, then batch run.', weight: 20, met: (p) => p.snapshots.some((s) => s.cut === 'final-2' && ['ADSL', 'ADAE', 'ADLB', 'T2', 'T3'].every((id) => s.results[id]?.matched)) },
      { id: 'impact', text: 'The outputs changed by transfer 2 identified correctly', hint: 'Compare the two unblinded snapshots, then mark the changed outputs.', weight: 20, met: (p) => !!p.changedReview?.correct }] },
]
export const missionOf = (p: LabProject) => MISSIONS.find((m) => m.id === p.mission?.id)
export function grade(p: LabProject) {
  const m = missionOf(p)
  if (!m) return null
  const results = m.goals.map((g) => { let ok = false, part = 0; try { ok = g.met(p); part = ok ? 1 : g.credit ? g.credit(p) : 0 } catch { ok = false } return { ...g, ok, part } })
  const total = results.reduce((s, g) => s + g.weight, 0)
  const score = Math.round((100 * results.reduce((s, g) => s + g.weight * g.part, 0)) / total)
  return { mission: m, results, score, passed: score >= 80 }
}
export function startMission(id: string, level: Level, opts: Parameters<typeof createProject>[1] = {}): LabProject {
  const m = MISSIONS.find((x) => x.id === id)!
  const p = createProject(`Mission ${m.id}: ${m.title}`, { ...opts, cut: m.cut ? { ...m.cut } : undefined })
  p.mission = { id, level, startedUtc: now() }
  if (id === 'M7') p.ai.code = ''
  return p
}
export function submitMission(p: LabProject) {
  const g = grade(p)
  if (!g) throw new Error('This project is not a mission.')
  p.mission!.endedUtc = now(); p.mission!.score = g.score; p.mission!.detail = g.results.map((r) => `${r.ok ? 'Met' : 'Not met'}: ${r.text}`)
  p.history.push({ utc: now(), what: `Mission ${g.mission.id} submitted: ${g.score}%` })
  return g
}
// The certificate: the five core missions and at least three of the five workflow missions.
export const CERT_CORE = MISSIONS.filter((m) => m.core).length
export const CERT_EXTRA = 3
export function certificate(projects: LabProject[], userId: string, name: string) {
  const runs = MISSIONS.map((m) => ({ id: m.id, title: m.title, core: m.core, p: projects.filter((p) => p.mission?.id === m.id && p.mission.endedUtc && (p.mission.score ?? 0) >= 80).sort((a, b) => (b.mission!.score ?? 0) - (a.mission!.score ?? 0))[0] }))
  const passed = runs.filter((r) => r.p)
  const basis = `${name.trim().toLowerCase()}|${passed.map((r) => `${r.id}:${r.p!.mission!.score}:${r.p!.mission!.level}`).join(',')}|${userId}`
  const h = hash(basis).slice(-10).toUpperCase()
  const core = passed.filter((r) => r.core).length, extra = passed.filter((r) => !r.core).length
  const eligible = core >= CERT_CORE && extra >= CERT_EXTRA
  return { eligible, runs, passed, core, extra, basis, code: `TLF-${h.slice(0, 5)}-${h.slice(5)}`, distinction: eligible && passed.length === MISSIONS.length && passed.filter((r) => r.p!.mission!.level === 'expert').length >= 3 }
}
export const _refs = { FINDINGS, ARS }
