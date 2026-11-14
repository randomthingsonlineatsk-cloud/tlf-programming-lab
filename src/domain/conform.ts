// ADaM conformance checks on the learner's analysis datasets: a training set of checks of the kind
// CDISC's ADaM conformance rules and validation tools apply (structure, keys, flags, baseline and
// change, time-to-event). Rule IDs are the lab's own. Findings feed the reviewer's guide, where any
// that remain must be explained.
import type { Frame } from './runner'
import type { Program } from './packs/types'

export type Severity = 'Error' | 'Warning' | 'Notice'
export interface Finding { rule: string; sev: Severity; dataset: string; message: string; count: number; examples: string[] }
export const RULES: { id: string; sev: Severity; text: string }[] = [
  { id: 'LAB-AD01', sev: 'Error', text: 'STUDYID and USUBJID are present.' },
  { id: 'LAB-AD02', sev: 'Error', text: 'ADSL has one record per USUBJID.' },
  { id: 'LAB-AD03', sev: 'Error', text: 'Variable names have at most 8 characters: upper-case letters, digits and underscores, starting with a letter.' },
  { id: 'LAB-AD04', sev: 'Error', text: 'The dataset keys identify each record (no duplicates).' },
  { id: 'LAB-AD05', sev: 'Warning', text: 'Flag variables (*FL) take only "Y", "N" or missing; ADSL population flags (*FL ending the name of a population) are never missing.' },
  { id: 'LAB-AD06', sev: 'Error', text: 'BDS: PARAMCD has at most 8 characters and maps to exactly one PARAM.' },
  { id: 'LAB-AD07', sev: 'Error', text: 'BDS: at most one baseline record (ABLFL "Y") per USUBJID and PARAMCD.' },
  { id: 'LAB-AD08', sev: 'Error', text: 'BDS: BASE equals AVAL on the baseline record.' },
  { id: 'LAB-AD09', sev: 'Error', text: 'BDS: CHG = AVAL - BASE where all three are present.' },
  { id: 'LAB-AD10', sev: 'Warning', text: 'Date variables (*DT) hold dates (YYYY-MM-DD), not numbers or text.' },
  { id: 'LAB-AD11', sev: 'Error', text: 'Time-to-event: CNSR is 0 or 1 and AVAL is positive.' },
  { id: 'LAB-AD12', sev: 'Warning', text: 'Numeric codes (*N) map one-to-one to their character variable (TRT01P/TRT01PN and similar).' },
  { id: 'LAB-AD13', sev: 'Warning', text: 'Imputation flags (*DTF) take only "D", "M", "Y" or missing.' },
  { id: 'LAB-AD14', sev: 'Notice', text: 'A variable is missing on every record.' },
]
const POP = new Set(['RANDFL', 'ITTFL', 'SAFFL', 'FASFL', 'PPROTFL', 'COMPLFL', 'ENRLFL'])

export function checkDataset(p: Program, f: Frame): Finding[] {
  const out: Finding[] = []
  const name = p.output.toUpperCase()
  const col = (n: string) => f.columns.indexOf(n)
  const vals = (n: string) => f.rows.map((r) => r[col(n)])
  const add = (rule: string, message: string, ex: string[]) => { if (ex.length) { const r = RULES.find((x) => x.id === rule)!; out.push({ rule, sev: r.sev, dataset: name, message, count: ex.length, examples: ex.slice(0, 5) }) } }
  add('LAB-AD01', 'Missing identifier variable', ['STUDYID', 'USUBJID'].filter((v) => col(v) < 0))
  if (name === 'ADSL' && col('USUBJID') >= 0) { const seen = new Set<string>(); add('LAB-AD02', 'USUBJID repeated in ADSL', vals('USUBJID').filter((u) => { const d = seen.has(u ?? ''); seen.add(u ?? ''); return d }) as string[]) }
  add('LAB-AD03', 'Variable name not ADaM-compliant', f.columns.filter((c) => !/^[A-Z][A-Z0-9_]{0,7}$/.test(c)))
  if (p.keys.every((k) => col(k) >= 0)) { const seen = new Set<string>(); const dup: string[] = []; for (const r of f.rows) { const k = p.keys.map((x) => r[col(x)] ?? '').join(' | '); if (seen.has(k)) dup.push(k); seen.add(k) } add('LAB-AD04', `Duplicate key (${p.keys.join(', ')})`, dup) }
  for (const v of f.columns.filter((c) => /FL$/.test(c))) {
    const bad = vals(v).filter((x) => x !== null && x !== 'Y' && x !== 'N') as string[]
    add('LAB-AD05', `${v} has values other than Y, N or missing`, bad.map((x) => `${v} = ${x}`))
    if (name === 'ADSL' && POP.has(v)) add('LAB-AD05', `${v} is missing (population flags are Y or N)`, vals('USUBJID').filter((_, i) => f.rows[i][col(v)] === null) as string[])
  }
  if (col('PARAMCD') >= 0) {
    const m = new Map<string, Set<string>>()
    for (const r of f.rows) { const k = r[col('PARAMCD')] ?? ''; if (!m.has(k)) m.set(k, new Set()); if (col('PARAM') >= 0) m.get(k)!.add(r[col('PARAM')] ?? '') }
    add('LAB-AD06', 'PARAMCD too long or not one-to-one with PARAM', [...m].filter(([k, s]) => k.length > 8 || s.size > 1).map(([k]) => k))
    if (col('ABLFL') >= 0) {
      const base = new Map<string, number>()
      for (const r of f.rows) if (r[col('ABLFL')] === 'Y') { const k = `${r[col('USUBJID')]} | ${r[col('PARAMCD')]}`; base.set(k, (base.get(k) ?? 0) + 1) }
      add('LAB-AD07', 'More than one baseline record', [...base].filter(([, n]) => n > 1).map(([k]) => k))
      if (col('BASE') >= 0 && col('AVAL') >= 0) add('LAB-AD08', 'BASE differs from AVAL on the baseline record', f.rows.filter((r) => r[col('ABLFL')] === 'Y' && r[col('BASE')] !== null && r[col('AVAL')] !== null && Math.abs(Number(r[col('BASE')]) - Number(r[col('AVAL')])) > 1e-9).map((r) => `${r[col('USUBJID')]} ${r[col('PARAMCD')]}`))
    }
    if (col('CHG') >= 0 && col('BASE') >= 0 && col('AVAL') >= 0) add('LAB-AD09', 'CHG is not AVAL - BASE', f.rows.filter((r) => [r[col('CHG')], r[col('BASE')], r[col('AVAL')]].every((x) => x !== null) && Math.abs(Number(r[col('CHG')]) - (Number(r[col('AVAL')]) - Number(r[col('BASE')]))) > 1e-6 * Math.max(1, Math.abs(Number(r[col('CHG')])))).map((r) => `${r[col('USUBJID')]} ${r[col('PARAMCD')]}`))
  }
  for (const v of f.columns.filter((c) => /DT$/.test(c))) add('LAB-AD10', `${v} is not a date`, (vals(v).filter((x) => x !== null && !/^\d{4}-\d{2}-\d{2}$/.test(x)) as string[]).map((x) => `${v} = ${x}`))
  if (col('CNSR') >= 0) add('LAB-AD11', 'CNSR not 0/1 or AVAL not positive', f.rows.filter((r) => !['0', '1'].includes(r[col('CNSR')] ?? '') || !(Number(r[col('AVAL')]) > 0)).map((r) => `${r[col('USUBJID')]} ${r[col('PARAMCD')] ?? ''}`))
  for (const v of f.columns.filter((c) => /N$/.test(c) && f.columns.includes(c.slice(0, -1)))) {
    const a = new Map<string, Set<string>>(), b = new Map<string, Set<string>>()
    for (const r of f.rows) { const x = r[col(v.slice(0, -1))], n = r[col(v)]; if (x === null || n === null) continue; (a.get(x) ?? a.set(x, new Set()).get(x)!).add(n); (b.get(n) ?? b.set(n, new Set()).get(n)!).add(x) }
    add('LAB-AD12', `${v.slice(0, -1)} and ${v} do not map one-to-one`, [...[...a].filter(([, s]) => s.size > 1).map(([k]) => k), ...[...b].filter(([, s]) => s.size > 1).map(([k]) => `${v}=${k}`)])
  }
  for (const v of f.columns.filter((c) => /DTF$/.test(c))) add('LAB-AD13', `${v} has values other than D, M, Y`, (vals(v).filter((x) => x !== null && !['D', 'M', 'Y'].includes(x)) as string[]))
  add('LAB-AD14', 'Variable missing on every record', f.rows.length ? f.columns.filter((c) => f.rows.every((r) => r[col(c)] === null)) : [])
  return out
}
export const findingKey = (x: Finding) => `${x.dataset}|${x.rule}|${x.message}`
