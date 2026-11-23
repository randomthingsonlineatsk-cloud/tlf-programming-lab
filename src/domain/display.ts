// Drawing a display from analysis results data (ARD). The numbers are computed and checked first;
// the display only arranges and rounds them, so a reviewer can trace every cell to a result.
// Each cell carries the ARD keys it came from (for "trace a number").
import type { Frame } from './runner'

export interface Cell { text: string; keys?: { an: string; g: string; cat: string | null }[] }
export interface Display { title: string; population: string; head: string[]; groups: string[]; rows: { label: string; indent?: number; cells: Cell[] }[]; footnotes: string[] }

type Lookup = (an: string, g: string, cat: string | null, st: string) => number | undefined
export function lookup(f: Frame): Lookup {
  const ix = (n: string) => f.columns.indexOf(n)
  const m = new Map<string, number>()
  for (const r of f.rows) m.set([r[ix('ANALYSIS')], r[ix('GROUP')], r[ix('CATEGORY')] ?? '', r[ix('STAT')]].join('|'), r[ix('VALUE')] === null ? NaN : Number(r[ix('VALUE')]))
  return (an, g, cat, st) => m.get([an, g, cat ?? '', st].join('|'))
}
const f = (x: number | undefined, d: number) => (x === undefined || isNaN(x) ? '' : x.toFixed(d))
const pv = (v: number | undefined) => (v === undefined || isNaN(v) ? '' : v < 0.001 ? '<0.001' : v.toFixed(3))
const cats = (fr: Frame, an: string) => [...new Set(fr.rows.filter((r) => r[fr.columns.indexOf('ANALYSIS')] === an).map((r) => r[fr.columns.indexOf('CATEGORY')] ?? ''))]
const c = (text: string, an?: string, g?: string, cat: string | null = null): Cell => ({ text, keys: an && g ? [{ an, g, cat }] : undefined })
const blank = (gs: string[]) => gs.map(() => c(''))

// Common row builders.
function npctRow(L: Lookup, label: string, an: string, gs: string[], cat: string | null = null, indent = 0) {
  return { label, indent, cells: gs.map((g) => { const n = L(an, g, cat, 'n'); return c(n === undefined ? '' : n === 0 ? '0' : `${n} (${f(L(an, g, cat, 'pct'), 1)})`, an, g, cat) }) }
}
function contRows(L: Lookup, an: string, gs: string[], cat: string | null, d = 1, extra = true) {
  const rows = [
    { label: 'n', indent: 1, cells: gs.map((g) => c(f(L(an, g, cat, 'n'), 0), an, g, cat)) },
    { label: 'Mean (SD)', indent: 1, cells: gs.map((g) => c(L(an, g, cat, 'mean') === undefined ? '' : `${f(L(an, g, cat, 'mean'), d)} (${f(L(an, g, cat, 'sd'), d + 1)})`, an, g, cat)) },
  ]
  if (extra) rows.push(
    { label: 'Median', indent: 1, cells: gs.map((g) => c(f(L(an, g, cat, 'median'), d), an, g, cat)) },
    { label: 'Min, Max', indent: 1, cells: gs.map((g) => c(L(an, g, cat, 'min') === undefined ? '' : `${f(L(an, g, cat, 'min'), 0)}, ${f(L(an, g, cat, 'max'), 0)}`, an, g, cat)) })
  return rows
}
const headN = (L: Lookup, gs: string[], an = 'POP') => gs.map((g) => (L(an, g, null, 'N') === undefined ? g : `${g} (N=${f(L(an, g, null, 'N'), 0)})`))
const byTotal = (L: Lookup, an: string, total = 'Total') => (a: string, b: string) => (L(an, total, b, 'n') ?? 0) - (L(an, total, a, 'n') ?? 0) || a.localeCompare(b)

export function demographics(groups: string[], title = 'Table 14.1.2 Demographic characteristics') {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = [...groups, 'Total']
    const rows: Display['rows'] = [{ label: 'Age (years)', cells: blank(gs) }, ...contRows(L, 'AGE', gs, null)]
    for (const [an, lab] of [['AGEGR1', 'Age group, n (%)'], ['SEX', 'Sex, n (%)'], ['RACE', 'Race, n (%)']] as const) {
      rows.push({ label: lab, cells: blank(gs) })
      for (const ct of cats(fr, an)) rows.push(npctRow(L, ct, an, gs, ct, 1))
    }
    return { title, population: 'Safety population', head: headN(L, gs), groups: gs, rows, footnotes: ['Percentages are of N in each column.', 'SD: standard deviation.'] }
  }
}

export function aeTable(groups: string[], title = 'Table 14.3.1 Treatment-emergent adverse events by system class and preferred term', window = 'up to 30 days after the last dose') {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = [...groups, 'Total']
    const rows: Display['rows'] = [npctRow(L, 'Participants with at least one TEAE', 'ANY', gs)]
    for (const s of cats(fr, 'SOC').sort(byTotal(L, 'SOC'))) {
      rows.push(npctRow(L, s, 'SOC', gs, s))
      for (const pt of cats(fr, 'PT').filter((x) => x.startsWith(`${s} | `)).sort(byTotal(L, 'PT'))) rows.push(npctRow(L, pt.split(' | ')[1], 'PT', gs, pt, 1))
    }
    return { title, population: 'Safety population', head: headN(L, gs), groups: gs, rows, footnotes: ['A participant is counted once in each row.', `Treatment-emergent: starting on or after the first dose and ${window}.`, 'Coded with the Study Medical Dictionary (training).'] }
  }
}

function ancova(groups: string[], title: string, endpoint: string, d = 2) {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = groups, doses = groups.slice(1)
    const ci = (g: string) => (L('DIFF', g, null, 'est') === undefined ? '' : `${f(L('DIFF', g, null, 'est'), d)} (${f(L('DIFF', g, null, 'lcl'), d)}, ${f(L('DIFF', g, null, 'ucl'), d)})`)
    return {
      title, population: 'Intent-to-treat population, observed cases', head: gs, groups: gs,
      rows: [
        { label: 'Baseline', cells: blank(gs) }, ...contRows(L, 'BASE', gs, null, d, false),
        { label: `Change from baseline at ${endpoint}`, cells: blank(gs) }, ...contRows(L, 'CHG', gs, null, d, false),
        { label: 'LS mean (SE)', indent: 1, cells: gs.map((g) => c(`${f(L('LSMEAN', g, null, 'est'), d)} (${f(L('LSMEAN', g, null, 'se'), d + 1)})`, 'LSMEAN', g)) },
        { label: 'Difference from placebo (95% CI)', indent: 1, cells: gs.map((g) => (doses.includes(g) ? c(ci(g), 'DIFF', g) : c(''))) },
        { label: 'p-value', indent: 1, cells: gs.map((g) => (doses.includes(g) ? c(pv(L('DIFF', g, null, 'p')), 'DIFF', g) : c(''))) },
      ],
      footnotes: ['ANCOVA with treatment as a factor and baseline as a covariate.', 'LS means at the mean baseline of the analysis set. CI: confidence interval. SE: standard error.'],
    }
  }
}

function disposition(groups: string[]) {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = [...groups, 'Total']
    const tot = (an: string) => gs.map((g) => c(g === 'Total' ? f(L(an, 'Total', null, 'n'), 0) : '', an, 'Total'))
    const rows: Display['rows'] = [
      { label: 'Screened', cells: tot('SCREENED') }, { label: 'Screen failures', cells: tot('SCRFAIL') },
      { label: 'Randomised', cells: gs.map((g) => c(f(L('POP', g, null, 'N'), 0), 'POP', g)) },
      npctRow(L, 'Treated', 'TREATED', gs), npctRow(L, 'Completed the study', 'COMPLETED', gs), npctRow(L, 'Discontinued from the study', 'DISC', gs),
      { label: 'Primary reason for discontinuation', indent: 1, cells: blank(gs) },
      ...cats(fr, 'DCSREAS').map((r) => npctRow(L, r[0] + r.slice(1).toLowerCase(), 'DCSREAS', gs, r, 1)),
    ]
    return { title: 'Table 14.1.1 Disposition of participants', population: 'All screened participants; percentages of randomised participants', head: gs, groups: gs, rows, footnotes: ['Screening counts are shown in the Total column only.'] }
  }
}

function exposure(groups: string[]) {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = [...groups, 'Total']
    return {
      title: 'Table 14.3.5 Extent of exposure to study treatment', population: 'Safety population', head: headN(L, gs), groups: gs,
      rows: [{ label: 'Duration of treatment (days)', cells: blank(gs) }, ...contRows(L, 'DUR', gs, null, 1),
        { label: 'Duration category, n (%)', cells: blank(gs) }, ...cats(fr, 'DURCAT').map((k) => npctRow(L, k, 'DURCAT', gs, k, 1)),
        { label: 'Total exposure (participant-years)', cells: gs.map((g) => c(f(L('PYEARS', g, null, 'est'), 1), 'PYEARS', g)) }],
      footnotes: ['Duration = last dose date - first dose date + 1.', 'Participant-years = sum of durations / 365.25.'],
    }
  }
}

function shift(groups: string[]) {
  return (fr: Frame): Display => {
    const L = lookup(fr), lev = ['LOW', 'NORMAL', 'HIGH']
    const head = groups.flatMap((g) => lev.map((l) => `${g}: ${l}`))
    const rows: Display['rows'] = []
    for (const p of cats(fr, 'N')) {
      rows.push({ label: `${p} (n at Week 26: ${groups.map((g) => f(L('N', g, p, 'n'), 0)).join(' / ')})`, cells: head.map(() => c('')) })
      for (const b of lev) rows.push({ label: `Baseline ${b}`, indent: 1, cells: groups.flatMap((g) => lev.map((a) => { const k = `${p} | ${b} | ${a}`; const n = L('SHIFT', g, k, 'n'); return c(n === undefined ? '' : `${n}`, 'SHIFT', g, k) })) })
    }
    return { title: 'Table 14.3.4 Shift from baseline to Week 26 in reference range category, chemistry', population: 'Safety population, participants with both values', head, groups: head, rows, footnotes: ['Columns: Week 26 category within each treatment. LOW, NORMAL, HIGH: relative to the laboratory reference range.'] }
  }
}

function vitals(groups: string[]) {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = groups, rows: Display['rows'] = []
    for (const p of cats(fr, 'CHG')) {
      rows.push({ label: p, cells: blank(gs) })
      for (const [an, lab] of [['BASE', 'Baseline'], ['AVAL', 'Week 26'], ['CHG', 'Change from baseline']] as const)
        rows.push({ label: `${lab}: n; mean (SD)`, indent: 1, cells: gs.map((g) => c(L(an, g, p, 'n') ? `${f(L(an, g, p, 'n'), 0)}; ${f(L(an, g, p, 'mean'), 1)} (${f(L(an, g, p, 'sd'), 2)})` : '0', an, g, p)) })
    }
    return { title: 'Table 14.3.6 Vital signs: change from baseline to Week 26', population: 'Safety population; one record per analysis window', head: gs, groups: gs, rows, footnotes: ['Unscheduled visits are assigned to analysis windows by study day; the record closest to the target day is analysed.'] }
  }
}

function conmeds(groups: string[]) {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = [...groups, 'Total']
    const rows: Display['rows'] = [npctRow(L, 'Participants with at least one medication on treatment', 'ANY', gs)]
    for (const k of cats(fr, 'CLASS').sort(byTotal(L, 'CLASS'))) {
      rows.push(npctRow(L, k, 'CLASS', gs, k))
      for (const d of cats(fr, 'DRUG').filter((x) => x.startsWith(`${k} | `)).sort(byTotal(L, 'DRUG'))) rows.push(npctRow(L, d.split(' | ')[1], 'DRUG', gs, d, 1))
    }
    return { title: 'Table 14.3.7 Concomitant medications taken on treatment, by drug class and name', population: 'Safety population', head: headN(L, gs), groups: gs, rows, footnotes: ['On treatment: started on or before the last dose and continuing on or after the first dose.'] }
  }
}

function mmrm(groups: string[]) {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = groups, rows: Display['rows'] = []
    for (const v of cats(fr, 'LSMEAN')) {
      rows.push({ label: v[0] + v.slice(1).toLowerCase(), cells: blank(gs) })
      rows.push({ label: 'LS mean (SE)', indent: 1, cells: gs.map((g) => c(`${f(L('LSMEAN', g, v, 'est'), 2)} (${f(L('LSMEAN', g, v, 'se'), 3)})`, 'LSMEAN', g, v)) })
      rows.push({ label: 'Difference from placebo (95% CI)', indent: 1, cells: gs.map((g, i) => (i === 0 ? c('') : c(`${f(L('DIFF', g, v, 'est'), 2)} (${f(L('DIFF', g, v, 'lcl'), 2)}, ${f(L('DIFF', g, v, 'ucl'), 2)})`, 'DIFF', g, v))) })
      rows.push({ label: 'p-value', indent: 1, cells: gs.map((g, i) => (i === 0 ? c('') : c(pv(L('DIFF', g, v, 'p')), 'DIFF', g, v))) })
    }
    return { title: 'Table 14.2.2 HbA1c (%) change from baseline by visit: mixed model for repeated measures', population: 'Intent-to-treat population, participants with at least one post-baseline value', head: gs.map((g) => `${g} (n=${f(L('N', g, null, 'n'), 0)})`), groups: gs, rows,
      footnotes: ['Estimand: hypothetical strategy for treatment discontinuation (ICH E9(R1)); missing at random.', 'MMRM: treatment, visit, treatment-by-visit, baseline and baseline-by-visit; unstructured covariance; REML. Degrees of freedom: participants minus parameters.'] }
  }
}

function mi(groups: string[]) {
  return (fr: Frame): Display => {
    const L = lookup(fr), doses = groups.slice(1)
    return {
      title: 'Table 14.2.3 Sensitivity analysis: placebo-based multiple imputation, HbA1c change at Week 26', population: `Intent-to-treat population (N=${f(L('N', 'Total', null, 'n'), 0)}; imputed: ${f(L('NMISS', 'Total', null, 'n'), 0)}; imputations: ${f(L('M', 'Total', null, 'n'), 0)})`, head: doses, groups: doses,
      rows: [
        { label: 'Difference from placebo (95% CI)', cells: doses.map((g) => c(`${f(L('DIFF', g, null, 'est'), 2)} (${f(L('DIFF', g, null, 'lcl'), 2)}, ${f(L('DIFF', g, null, 'ucl'), 2)})`, 'DIFF', g)) },
        { label: 'Standard error', cells: doses.map((g) => c(f(L('DIFF', g, null, 'se'), 3), 'DIFF', g)) },
        { label: 'p-value', cells: doses.map((g) => c(pv(L('DIFF', g, null, 'p')), 'DIFF', g)) },
        { label: 'Degrees of freedom', cells: doses.map((g) => c(f(L('DIFF', g, null, 'df'), 1), 'DIFF', g)) },
      ],
      footnotes: ['Missing Week 26 values imputed from a regression on baseline fitted to placebo participants (reference-based), then ANCOVA; results combined with Rubin\'s rules.'],
    }
  }
}

function tte(groups: string[]) {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = groups
    const med = (g: string) => { const m = L('MEDIAN', g, null, 'est'); const fm = (x: number | undefined) => (x === undefined || isNaN(x) ? 'NE' : f(x, 0)); return `${fm(m)} (${fm(L('MEDIAN', g, null, 'lcl'))}, ${fm(L('MEDIAN', g, null, 'ucl'))})` }
    return {
      title: 'Table 14.3.8 Time to first treatment-emergent adverse event', population: 'Safety population', head: gs, groups: gs,
      rows: [
        { label: 'Participants', cells: gs.map((g) => c(f(L('N', g, null, 'n'), 0), 'N', g)) },
        { label: 'With an event, n', cells: gs.map((g) => c(f(L('EVENTS', g, null, 'n'), 0), 'EVENTS', g)) },
        { label: 'Censored, n', cells: gs.map((g) => c(f(L('CENSORED', g, null, 'n'), 0), 'CENSORED', g)) },
        { label: 'Median time, days (95% CI)', cells: gs.map((g) => c(med(g), 'MEDIAN', g)) },
        { label: 'Hazard ratio vs placebo (95% CI)', cells: gs.map((g, i) => (i === 0 ? c('') : c(`${f(L('HR', g, null, 'hr'), 2)} (${f(L('HR', g, null, 'lcl'), 2)}, ${f(L('HR', g, null, 'ucl'), 2)})`, 'HR', g))) },
        { label: 'p-value (Wald)', cells: gs.map((g, i) => (i === 0 ? c('') : c(pv(L('HR', g, null, 'p')), 'HR', g))) },
        { label: 'Log-rank test across groups, p-value', cells: gs.map((g, i) => (i === 0 ? c(pv(L('LOGRANK', 'Total', null, 'p')), 'LOGRANK', 'Total') : c(''))) },
      ],
      footnotes: ['Kaplan-Meier estimates; 95% CI for the median by the Brookmeyer-Crowley method with log(-log) limits. NE: not estimable.', 'Cox proportional hazards model with treatment, Breslow ties.'],
    }
  }
}

const GLV_G = ['Placebo', 'GLV-12 5 mg', 'GLV-12 10 mg']
export const glvDisplays: Record<string, (f: Frame) => Display> = {
  T1: demographics(GLV_G), T2: aeTable(GLV_G), T3: ancova(GLV_G, 'Table 14.2.1 Change from baseline in HbA1c (%) at Week 26: ANCOVA', 'Week 26'),
  T4: disposition(GLV_G), T5: exposure(GLV_G), T6: shift(GLV_G), T7: vitals(GLV_G), T8: conmeds(GLV_G), T9: mmrm(GLV_G), T10: mi(GLV_G), T11: tte(GLV_G),
}

// HRP-301 (hand eczema): responder analyses.
export function responder(groups: string[], title: string, endpoint: string) {
  return (fr: Frame): Display => {
    const L = lookup(fr), gs = groups
    return {
      title, population: 'Intent-to-treat population; missing responses imputed as non-response', head: gs, groups: gs,
      rows: [
        { label: 'N', cells: gs.map((g) => c(f(L('N', g, null, 'n'), 0), 'N', g)) },
        { label: `${endpoint}, n (%)`, cells: gs.map((g) => c(`${f(L('RESP', g, null, 'n'), 0)} (${f(L('RESP', g, null, 'pct'), 1)})`, 'RESP', g)) },
        { label: 'Missing, imputed as non-response, n', cells: gs.map((g) => c(f(L('MISS', g, null, 'n'), 0), 'MISS', g)) },
        { label: 'Difference from placebo, % (95% CI)', cells: gs.map((g, i) => (i === 0 ? c('') : c(`${f(L('DIFF', g, null, 'est'), 1)} (${f(L('DIFF', g, null, 'lcl'), 1)}, ${f(L('DIFF', g, null, 'ucl'), 1)})`, 'DIFF', g))) },
        { label: 'p-value (Fisher\'s exact test)', cells: gs.map((g, i) => (i === 0 ? c('') : c(pv(L('DIFF', g, null, 'p')), 'DIFF', g))) },
      ],
      footnotes: ['Composite strategy: participants who discontinued or used rescue treatment, or have no Week 16 value, count as non-responders.', 'CI: Wald interval for the difference in proportions.'],
    }
  }
}
export const hrpDisplays = (groups: string[]): Record<string, (f: Frame) => Display> => ({
  T1: demographics(groups), T2: aeTable(groups),
  T3: responder(groups, 'Table 14.2.1 IGA-CHE treatment success at Week 16', 'IGA-CHE treatment success'),
  T4: responder(groups, 'Table 14.2.2 HECSI-75 at Week 16', 'HECSI-75 response'),
  T5: disposition(groups), T6: exposure(groups),
})

const h = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))
export function displayHtml(d: Display, study: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${h(d.title)}</title><style>body{font-family:"Courier New",monospace;font-size:12px;margin:2rem;color:#000;background:#fff}table{border-collapse:collapse;width:100%}th,td{padding:2px 8px;text-align:center}td:first-child,th:first-child{text-align:left}thead tr{border-top:1px solid #000;border-bottom:1px solid #000}tbody tr:last-child{border-bottom:1px solid #000}.i1{padding-left:2em}</style></head><body>
<p>${h(study)} (fictional training study)</p><p><b>${h(d.title)}</b><br>${h(d.population)}</p>
<table><thead><tr><th></th>${d.head.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${d.rows.map((r) => `<tr><td class="${r.indent ? 'i1' : ''}">${h(r.label)}</td>${r.cells.map((x) => `<td>${h(x.text)}</td>`).join('')}</tr>`).join('')}</tbody></table>
${d.footnotes.map((x) => `<p>${h(x)}</p>`).join('')}<p>Source: analysis results data. Training material.</p></body></html>`
}

// RTF, the format most sponsors still deliver tables in: a plain table with a title, the population
// and footnotes, in a monospaced font, landscape.
const rtfEsc = (s: string) => s.replace(/[\\{}]/g, (ch) => `\\${ch}`).replace(/[^\x00-\x7f]/g, (ch) => `\\u${ch.charCodeAt(0)}?`)
export function displayRtf(d: Display, study: string): string {
  const cols = d.head.length + 1, first = 4200, width = Math.max(900, Math.floor((13200 - first) / Math.max(1, d.head.length)))
  const cellx = Array.from({ length: cols }, (_, i) => first + i * width)
  const row = (cells: string[], top = false, bottom = false, bold = false) => `\\trowd\\trgaph60${cellx.map((x) => `${top ? '\\clbrdrt\\brdrs' : ''}${bottom ? '\\clbrdrb\\brdrs' : ''}\\cellx${x}`).join('')}\n${cells.map((t, i) => `\\pard\\intbl${i === 0 ? '\\ql' : '\\qc'}${bold ? '\\b' : ''} ${rtfEsc(t)}${bold ? '\\b0' : ''}\\cell`).join('')}\\row\n`
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fmodern Courier New;}}\\landscape\\paperw15840\\paperh12240\\margl720\\margr720\\margt720\\margb720\\f0\\fs16
\\pard ${rtfEsc(study)} (fictional training study)\\par
\\pard\\b ${rtfEsc(d.title)}\\b0\\par
\\pard ${rtfEsc(d.population)}\\par\\pard\\par
${row(['', ...d.head], true, true, true)}${d.rows.map((r, i) => row([`${r.indent ? '    ' : ''}${r.label}`, ...r.cells.map((x) => x.text)], false, i === d.rows.length - 1)).join('')}\\pard\\par
${d.footnotes.map((x) => `\\pard ${rtfEsc(x)}\\par`).join('\n')}
\\pard Source: analysis results data. Training material.\\par}`
}

// ONK-44-302 (oncology): disposition at the cut-off, demographics, time to event and response.
export const onkDisplays = (groups: string[]): Record<string, (f: Frame) => Display> => {
  const gt = [...groups, 'Total'], onk = groups[0]
  const mo = (x: number | undefined) => (x === undefined || isNaN(x) ? 'NE' : f(x, 1))
  const tteD = (title: string, foot: string[]) => (fr: Frame): Display => {
    const L = lookup(fr), an = [...new Set(fr.rows.map((r) => String(r[0])))].find((x) => !x.includes('_'))!
    return {
      title, population: 'Intent-to-treat population (all randomised), as randomised', head: groups, groups,
      rows: [
        { label: 'Participants', cells: groups.map((g) => c(f(L(an, g, null, 'n'), 0), an, g)) },
        npctRow(L, 'With an event, n (%)', `${an}_EVT`, groups),
        npctRow(L, 'Censored, n (%)', `${an}_CNS`, groups),
        { label: 'Median, months (95% CI)', cells: groups.map((g) => c(`${mo(L(`${an}_MED`, g, null, 'est'))} (${mo(L(`${an}_MED`, g, null, 'lcl'))}, ${mo(L(`${an}_MED`, g, null, 'ucl'))})`, `${an}_MED`, g)) },
        { label: 'Hazard ratio, ONK-44 vs docetaxel (95% CI)', cells: groups.map((g) => (g === onk ? c(`${f(L(`${an}_HR`, g, null, 'est'), 2)} (${f(L(`${an}_HR`, g, null, 'lcl'), 2)}, ${f(L(`${an}_HR`, g, null, 'ucl'), 2)})`, `${an}_HR`, g) : c(''))) },
        { label: 'Log-rank test, p-value', cells: groups.map((g) => (g === onk ? c(pv(L(`${an}_P`, g, null, 'p')), `${an}_P`, g) : c(''))) },
      ].map((r) => ({ ...r, indent: undefined })),
      footnotes: [...foot, 'Kaplan-Meier medians; 95% CI by the Brookmeyer-Crowley method with log(-log) limits. NE: not estimable. Cox proportional hazards model with treatment (Breslow ties); unstratified log-rank test.'],
    }
  }
  const respRows = (L: Lookup, label: string, an: string): Display['rows'] => [
    { label, cells: blank(groups) },
    ...(['CR', 'PR', 'SD', 'PD', 'NE'] as const).map((k) => npctRow(L, { CR: 'Complete response', PR: 'Partial response', SD: 'Stable disease', PD: 'Progressive disease', NE: 'Not evaluable' }[k], `${an}_BOR`, groups, k, 1)),
    npctRow(L, 'Objective response (CR or PR), n (%)', `${an}_ORR`, groups, null, 1),
    { label: '95% CI for the response rate, %', indent: 1, cells: groups.map((g) => c(`${f(L(`${an}_ORRCI`, g, null, 'lcl'), 1)}, ${f(L(`${an}_ORRCI`, g, null, 'ucl'), 1)}`, `${an}_ORRCI`, g)) },
    { label: 'Difference, ONK-44 minus docetaxel, % (95% CI)', indent: 1, cells: groups.map((g) => (g === onk ? c(`${f(L(`${an}_DIFF`, g, null, 'est'), 1)} (${f(L(`${an}_DIFF`, g, null, 'lcl'), 1)}, ${f(L(`${an}_DIFF`, g, null, 'ucl'), 1)})`, `${an}_DIFF`, g) : c(''))) },
  ]
  return {
    T1: (fr) => { const L = lookup(fr); const tot = (an: string) => gt.map((g) => c(g === 'Total' ? f(L(an, 'Total', null, 'n'), 0) : '', an, 'Total'))
      return { title: 'Table 14.1.1 Disposition at the data cut-off', population: 'All randomised participants; data cut-off 2026-10-31', head: gt, groups: gt,
        rows: [{ label: 'Screened', cells: tot('SCREENED') }, { label: 'Screen failures', cells: tot('SCRFAIL') }, { label: 'Randomised', cells: gt.map((g) => c(f(L('POP', g, null, 'N'), 0), 'POP', g)) },
          { ...npctRow(L, 'Treated', 'TREATED', gt), indent: 0 }, { ...npctRow(L, 'Progressed or died (independent review)', 'PFSEVT', gt), indent: 0 }, { ...npctRow(L, 'Died', 'DEATH', gt), indent: 0 }, { ...npctRow(L, 'Alive at the data cut-off', 'ALIVE', gt), indent: 0 }],
        footnotes: ['Screen failures did not reach randomisation. Data cut-off 2026-10-31.'] } },
    T2: (fr) => { const L = lookup(fr)
      const rows: Display['rows'] = [{ label: 'Age (years)', cells: blank(gt) }, ...contRows(L, 'AGE', gt, null, 1).filter((r) => r.label !== 'n')]
      for (const [an, lab] of [['AGEGR1', 'Age group, n (%)'], ['SEX', 'Sex, n (%)'], ['RACE', 'Race, n (%)'], ['COUNTRY', 'Country, n (%)']] as const) { rows.push({ label: lab, cells: blank(gt) }); for (const k of cats(fr, an)) rows.push(npctRow(L, k, an, gt, k, 1)) }
      return { title: 'Table 14.1.2 Demographic characteristics', population: 'Intent-to-treat population (all randomised)', head: gt, groups: gt, rows, footnotes: [] } },
    T3: tteD('Table 14.2.1 Progression-free survival by independent review (primary endpoint)', ['Progression by RECIST 1.1 as read by the blinded independent central review, or death from any cause. Censored at the last adequate tumour assessment.']),
    T4: tteD('Table 14.2.2 Progression-free survival by the investigator (sensitivity analysis)', ['Progression by RECIST 1.1 as assessed by the investigator, or death. Censored at the last adequate assessment.']),
    T5: (fr) => { const L = lookup(fr)
      return { title: 'Table 14.2.3 Best overall response', population: 'Intent-to-treat population (all randomised), as randomised', head: groups, groups,
        rows: [{ label: 'N', cells: groups.map((g) => c(f(L('N', g, null, 'N'), 0), 'N', g)) }, ...respRows(L, 'Independent review', 'IRC'), ...respRows(L, 'Investigator', 'INV')],
        footnotes: [`Independent review and investigator agreed on whether a participant responded for ${f(L('AGREE', 'Total', null, 'n'), 0)} of ${f(groups.reduce((a, g) => a + (L('N', g, null, 'N') ?? 0), 0), 0)} participants (${f(L('AGREE', 'Total', null, 'pct'), 1)}%).`, 'Best overall response from the RECIST 1.1 overall responses up to progression; stable disease counts only if assessed at least 5 weeks after randomisation; responses need no confirmation in this randomised study. 95% CI for each rate by the Clopper-Pearson method; for the difference, a Wald interval.'] } },
    T6: tteD('Table 14.2.4 Overall survival (secondary endpoint, interim)', ['Death from any cause; censored at the last date known alive, no later than the data cut-off (2026-10-31). The analysis is not final: few deaths had occurred at the cut-off.']),
    T7: (fr) => { const L = lookup(fr)
      return { title: 'Table 14.3.5 Extent of exposure', population: 'Safety population (all who took at least one dose), as treated', head: groups, groups,
        rows: [{ label: 'Duration of treatment (days)', cells: blank(groups) }, ...contRows(L, 'DUR', groups, null, 1)],
        footnotes: ['ONK-44: from the first to the last daily dose. Docetaxel: from the first infusion to 21 days after the last (one cycle).'] } },
    T8: (fr) => { const L = lookup(fr)
      const lab: [string, string][] = [['ANY', 'Any TEAE'], ['REL', 'TEAE related to study treatment'], ['GR3', 'TEAE of grade 3 or higher'], ['SER', 'Serious TEAE'], ['SERREL', 'Serious TEAE related to study treatment'], ['DISC', 'TEAE leading to discontinuation of study treatment'], ['MOD', 'TEAE leading to interruption or dose reduction'], ['FATAL', 'TEAE with a fatal outcome (grade 5)'], ['DEATH', 'Deaths (any cause) by the data cut-off']]
      return { title: 'Table 14.3.1 Overview of treatment-emergent adverse events', population: 'Safety population, as treated', head: headN(L, gt), groups: gt,
        rows: lab.map(([an, l]) => npctRow(L, l, an, gt)),
        footnotes: ['Participants with at least one event of each kind, n (%). A participant is counted once in each row.', 'Treatment-emergent: starting on or after the first dose and up to 30 days after the last dose. Grades on a CTCAE-style scale (1 to 5). Disease progression is not an adverse event.', 'Deaths include those from disease progression.'] } },
    T9: aeTable(groups, 'Table 14.3.2 Treatment-emergent adverse events by system class and preferred term'),
    T10: (fr) => { const L = lookup(fr)
      const rows: Display['rows'] = [npctRow(L, 'Participants with at least one TEAE of grade 3 or higher', 'ANY', gt)]
      for (const pt of cats(fr, 'PT').sort(byTotal(L, 'PT'))) rows.push(npctRow(L, pt, 'PT', gt, pt, 1))
      return { title: 'Table 14.3.3 Treatment-emergent adverse events of grade 3 or higher by preferred term', population: 'Safety population, as treated', head: headN(L, gt), groups: gt, rows,
        footnotes: ['A participant is counted once in each row, at the highest grade.', 'Treatment-emergent: starting on or after the first dose and up to 30 days after the last dose.', 'Coded with the Study Medical Dictionary (training).'] } },
  }
}
