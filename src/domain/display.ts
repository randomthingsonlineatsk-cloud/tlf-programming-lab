// Drawing a display from analysis results data (ARD). The numbers are computed and checked first;
// the display only arranges and rounds them, so a reviewer can trace every cell to a result.
import type { Frame } from './runner'

export const GROUPS = ['Placebo', 'GLV-12 5 mg', 'GLV-12 10 mg', 'Total']
export interface Display { title: string; population: string; head: string[]; rows: { label: string; indent?: number; cells: string[] }[]; footnotes: string[] }

type Lookup = (an: string, g: string, cat: string | null, st: string) => number | undefined
function lookup(f: Frame): Lookup {
  const ix = (n: string) => f.columns.indexOf(n)
  const m = new Map<string, number>()
  for (const r of f.rows) m.set([r[ix('ANALYSIS')], r[ix('GROUP')], r[ix('CATEGORY')] ?? '', r[ix('STAT')]].join('|'), Number(r[ix('VALUE')]))
  return (an, g, cat, st) => m.get([an, g, cat ?? '', st].join('|'))
}
const f = (x: number | undefined, d: number) => (x === undefined || isNaN(x) ? '' : x.toFixed(d))
const npct = (n: number | undefined, p: number | undefined) => (n === undefined ? '' : n === 0 ? '0' : `${n} (${f(p, 1)})`)
const cats = (fr: Frame, an: string) => [...new Set(fr.rows.filter((r) => r[fr.columns.indexOf('ANALYSIS')] === an).map((r) => r[fr.columns.indexOf('CATEGORY')] ?? ''))]

export function displayT1(fr: Frame): Display {
  const L = lookup(fr), gs = GROUPS
  const rows: Display['rows'] = [
    { label: 'Age (years)', cells: gs.map(() => '') },
    { label: 'n', indent: 1, cells: gs.map((g) => f(L('AGE', g, null, 'n'), 0)) },
    { label: 'Mean (SD)', indent: 1, cells: gs.map((g) => `${f(L('AGE', g, null, 'mean'), 1)} (${f(L('AGE', g, null, 'sd'), 2)})`) },
    { label: 'Median', indent: 1, cells: gs.map((g) => f(L('AGE', g, null, 'median'), 1)) },
    { label: 'Min, Max', indent: 1, cells: gs.map((g) => `${f(L('AGE', g, null, 'min'), 0)}, ${f(L('AGE', g, null, 'max'), 0)}`) },
  ]
  for (const [an, lab] of [['AGEGR1', 'Age group, n (%)'], ['SEX', 'Sex, n (%)'], ['RACE', 'Race, n (%)']] as const) {
    rows.push({ label: lab, cells: gs.map(() => '') })
    for (const c of cats(fr, an)) rows.push({ label: c, indent: 1, cells: gs.map((g) => npct(L(an, g, c, 'n'), L(an, g, c, 'pct'))) })
  }
  return { title: 'Table 14.1.2 Demographic characteristics', population: 'Safety population', head: gs.map((g) => `${g} (N=${f(L('POP', g, null, 'N'), 0)})`), rows, footnotes: ['Percentages are of N in each column.', 'SD: standard deviation.'] }
}

export function displayT2(fr: Frame): Display {
  const L = lookup(fr), gs = GROUPS
  const rows: Display['rows'] = [{ label: 'Participants with at least one TEAE', cells: gs.map((g) => npct(L('ANY', g, null, 'n'), L('ANY', g, null, 'pct'))) }]
  const socs = cats(fr, 'SOC').sort((a, b) => (L('SOC', 'Total', b, 'n') ?? 0) - (L('SOC', 'Total', a, 'n') ?? 0) || a.localeCompare(b))
  for (const s of socs) {
    rows.push({ label: s, cells: gs.map((g) => npct(L('SOC', g, s, 'n'), L('SOC', g, s, 'pct'))) })
    const pts = cats(fr, 'PT').filter((c) => c.startsWith(`${s} | `)).sort((a, b) => (L('PT', 'Total', b, 'n') ?? 0) - (L('PT', 'Total', a, 'n') ?? 0) || a.localeCompare(b))
    for (const pt of pts) rows.push({ label: pt.split(' | ')[1], indent: 1, cells: gs.map((g) => npct(L('PT', g, pt, 'n'), L('PT', g, pt, 'pct'))) })
  }
  return { title: 'Table 14.3.1 Treatment-emergent adverse events by system class and preferred term', population: 'Safety population', head: gs.map((g) => `${g} (N=${f(L('POP', g, null, 'N'), 0)})`), rows, footnotes: ['A participant is counted once in each row.', 'Treatment-emergent: starting on or after the first dose and up to 30 days after the last dose.', 'Coded with the Study Medical Dictionary (training).'] }
}

export function displayT3(fr: Frame): Display {
  const L = lookup(fr), gs = GROUPS.slice(0, 3)
  const ci = (g: string) => (L('DIFF', g, null, 'est') === undefined ? '' : `${f(L('DIFF', g, null, 'est'), 2)} (${f(L('DIFF', g, null, 'lcl'), 2)}, ${f(L('DIFF', g, null, 'ucl'), 2)})`)
  const p = (g: string) => { const v = L('DIFF', g, null, 'p'); return v === undefined ? '' : v < 0.001 ? '<0.001' : v.toFixed(3) }
  return {
    title: 'Table 14.2.1 Change from baseline in HbA1c (%) at Week 26: ANCOVA', population: 'Intent-to-treat population, observed cases', head: gs,
    rows: [
      { label: 'Baseline', cells: gs.map(() => '') },
      { label: 'n', indent: 1, cells: gs.map((g) => f(L('BASE', g, null, 'n'), 0)) },
      { label: 'Mean (SD)', indent: 1, cells: gs.map((g) => `${f(L('BASE', g, null, 'mean'), 2)} (${f(L('BASE', g, null, 'sd'), 3)})`) },
      { label: 'Change from baseline at Week 26', cells: gs.map(() => '') },
      { label: 'n', indent: 1, cells: gs.map((g) => f(L('CHG', g, null, 'n'), 0)) },
      { label: 'Mean (SD)', indent: 1, cells: gs.map((g) => `${f(L('CHG', g, null, 'mean'), 2)} (${f(L('CHG', g, null, 'sd'), 3)})`) },
      { label: 'LS mean (SE)', indent: 1, cells: gs.map((g) => `${f(L('LSMEAN', g, null, 'est'), 2)} (${f(L('LSMEAN', g, null, 'se'), 3)})`) },
      { label: 'Difference from placebo (95% CI)', indent: 1, cells: gs.map((g) => (g === 'Placebo' ? '' : ci(g))) },
      { label: 'p-value', indent: 1, cells: gs.map((g) => (g === 'Placebo' ? '' : p(g))) },
    ],
    footnotes: ['ANCOVA with treatment as a factor and baseline HbA1c as a covariate.', 'LS means at the mean baseline of the analysis set. CI: confidence interval. SE: standard error.'],
  }
}
export const DISPLAYS: Record<string, (f: Frame) => Display> = { T1: displayT1, T2: displayT2, T3: displayT3 }

const h = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
export function displayHtml(d: Display, study: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${h(d.title)}</title><style>body{font-family:"Courier New",monospace;font-size:12px;margin:2rem;color:#000;background:#fff}table{border-collapse:collapse;width:100%}th,td{padding:2px 8px;text-align:center}td:first-child,th:first-child{text-align:left}thead tr{border-top:1px solid #000;border-bottom:1px solid #000}tbody tr:last-child{border-bottom:1px solid #000}.i1{padding-left:2em}</style></head><body>
<p>${h(study)} (fictional training study)</p><p><b>${h(d.title)}</b><br>${h(d.population)}</p>
<table><thead><tr><th></th>${d.head.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${d.rows.map((r) => `<tr><td class="${r.indent ? 'i1' : ''}">${h(r.label)}</td>${r.cells.map((c) => `<td>${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
${d.footnotes.map((x) => `<p>${h(x)}</p>`).join('')}<p>Source: analysis results data. Training material.</p></body></html>`
}
