// Trace a number: from a cell of a display to the analysis results row, the analysis records it
// was computed from, and the SDTM records behind them. Each table program says how to select
// its records for an (analysis, group, category); the lab runs the selection on the validated data.
export interface TraceSpec { adam: string; sdtm?: { domain: string; by: string[] }; note?: string }
const q = (s: string) => JSON.stringify(s)
const grp = (v: string, g: string) => (g === 'Total' ? 'TRUE' : `${v} %in% ${q(g)}`)

type Tracer = (an: string, g: string, cat: string | null) => TraceSpec | null
const T1: Tracer = (an, g, cat) => ({ adam: `adsl[adsl$SAFFL == "Y" & ${grp('adsl$TRT01A', g)}${cat && ['AGEGR1', 'SEX', 'RACE'].includes(an) ? ` & adsl$${an} %in% ${q(cat)}` : ''}, ]`, sdtm: { domain: 'dm', by: ['USUBJID'] } })
const T2: Tracer = (an, g, cat) => {
  if (an === 'POP') return { adam: `adsl[adsl$SAFFL == "Y" & ${grp('adsl$TRT01A', g)}, ]`, sdtm: { domain: 'dm', by: ['USUBJID'] } }
  const [soc, pt] = (cat ?? '').split(' | ')
  return { adam: `adae[adae$TRTEMFL == "Y" & adae$SAFFL == "Y" & ${grp('adae$TRT01A', g)}${an === 'SOC' || an === 'PT' ? ` & adae$AEBODSYS %in% ${q(soc)}` : ''}${an === 'PT' ? ` & adae$AEDECOD %in% ${q(pt)}` : ''}, ]`, sdtm: { domain: 'ae', by: ['USUBJID', 'AESEQ'] }, note: 'Each participant counts once, however many records are listed.' }
}
const byVisit = (ds: string, week: string, trt = 'TRT01P', key = 'LBSEQ', dom = 'lb'): Tracer => (_an, g, cat) => {
  const wk = cat?.startsWith('WEEK') ? cat.slice(5) : week
  return { adam: `${ds}[${ds}$AVISITN == ${wk} & !is.na(${ds}$CHG) & (${grp(`${ds}$${trt}`, g)}${g !== 'Placebo' && g !== 'Total' ? ` | ${ds}$${trt} %in% "Placebo"` : ''}), ]`, sdtm: { domain: dom, by: ['USUBJID', key] }, note: g !== 'Placebo' ? 'A difference from placebo uses both groups (and the model uses every group).' : undefined }
}
const T4: Tracer = (an, g, cat) => {
  const base = `adsl$RANDFL == "Y" & ${grp('adsl$TRT01P', g)}`
  const extra = an === 'TREATED' ? ' & adsl$SAFFL == "Y"' : an === 'COMPLETED' ? ' & adsl$EOSSTT == "COMPLETED"' : an === 'DISC' ? ' & adsl$EOSSTT == "DISCONTINUED"' : an === 'DCSREAS' ? ` & adsl$DCSREAS %in% ${q(cat ?? '')}` : ''
  if (an === 'SCREENED') return { adam: 'adsl', sdtm: { domain: 'ds', by: ['USUBJID'] } }
  if (an === 'SCRFAIL') return { adam: 'adsl[adsl$RANDFL == "N", ]', sdtm: { domain: 'ds', by: ['USUBJID'] } }
  return { adam: `adsl[${base}${extra}, ]`, sdtm: { domain: 'ds', by: ['USUBJID'] } }
}
const T5: Tracer = (an, g, cat) => ({ adam: `adsl[adsl$SAFFL == "Y" & ${grp('adsl$TRT01A', g)}${an === 'DURCAT' && cat ? ` & cut(adsl$TRTDURD, c(0, 28, 84, 182, Inf), labels = c("1-28 days", "29-84 days", "85-182 days", ">182 days")) %in% ${q(cat)}` : ''}, ]`, sdtm: { domain: 'ex', by: ['USUBJID'] } })
const T6: Tracer = (_an, g, cat) => { const [p, b, a] = (cat ?? '').split(' | '); return { adam: `adlbc[adlbc$AVISITN == 26 & adlbc$PARAMCD %in% ${q(p)} & ${grp('adlbc$TRT01A', g)}${b ? ` & adlbc$BNRIND %in% ${q(b)} & adlbc$ANRIND %in% ${q(a)}` : ''}, ]`, sdtm: { domain: 'lb', by: ['USUBJID', 'LBSEQ'] } } }
const T7: Tracer = (_an, g, cat) => ({ adam: `advs[advs$ANL01FL %in% "Y" & advs$AVISITN %in% 26 & advs$PARAMCD %in% ${q(cat ?? '')} & ${grp('advs$TRT01A', g)}, ]`, sdtm: { domain: 'vs', by: ['USUBJID', 'VSSEQ'] } })
const T8: Tracer = (an, g, cat) => { const [cl, dr] = (cat ?? '').split(' | '); return { adam: `adcm[adcm$ONTRTFL %in% "Y" & ${grp('adcm$TRT01A', g)}${an === 'CLASS' || an === 'DRUG' ? ` & adcm$CMCLAS %in% ${q(cl)}` : ''}${an === 'DRUG' ? ` & adcm$CMDECOD %in% ${q(dr)}` : ''}, ]`, sdtm: { domain: 'cm', by: ['USUBJID', 'CMSEQ'] } } }
const T11: Tracer = (_an, g) => ({ adam: `adtte[adtte$PARAMCD == "TTAE" & ${grp('adtte$TRT01A', g)}, ]`, note: 'Events are first TEAEs from ADAE; censored records end at the TEAE window or the end of the study.' })
const resp = (param: string): Tracer => (_an, g) => ({ adam: `adqs[adqs$PARAMCD == ${q(param)} & adqs$AVISITN == 16 & ${grp('adqs$TRT01P', g)}, ]`, sdtm: { domain: 'qs', by: ['USUBJID', 'QSSEQ'] }, note: 'ITT participants with no Week 16 record are counted as non-responders and do not appear here.' })

export const TRACERS: Record<string, Record<string, Tracer>> = {
  'GLV-12-301': { T1, T2, T3: byVisit('adlb', '26'), T4, T5, T6, T7, T8, T9: byVisit('adlb', '26'), T10: byVisit('adlb', '26'), T11 },
  'HRP-301': { T1, T2, T3: resp('IGACHE'), T4: resp('HECSI') },
}
