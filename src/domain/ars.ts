// Analysis results metadata, in the spirit of CDISC's Analysis Results Standard (published April
// 2024): for each analysis, the analysis set, the dataset and variable analysed, the selection,
// the grouping and the method, recorded before the program is written so results can be traced
// and regenerated. The lab asks for the metadata of two analyses and grades it.
export interface ArsField { id: string; label: string; options: string[]; answer: string; why: string }
export interface ArsAnalysis { id: string; display: string; analysis: string; fields: ArsField[] }
const SETS = ['Safety population (SAFFL = "Y")', 'Intent-to-treat population (ITTFL = "Y")', 'Randomised population (RANDFL = "Y")', 'All screened participants']
export const ARS: ArsAnalysis[] = [
  { id: 'A-T1-AGE', display: 'Table 14.1.2', analysis: 'Age, summary statistics by treatment', fields: [
    { id: 'set', label: 'Analysis set', options: SETS, answer: SETS[0], why: 'The demographics table of this SAP is on the safety population.' },
    { id: 'ds', label: 'Dataset and variable', options: ['ADSL.AGE', 'ADSL.AGEGR1', 'DM.AGE', 'ADAE.AGE'], answer: 'ADSL.AGE', why: 'Analyses read ADaM, not SDTM: ADSL.AGE.' },
    { id: 'group', label: 'Grouping', options: ['ADSL.TRT01A, plus a total', 'ADSL.TRT01P', 'ADSL.SITEID', 'None'], answer: 'ADSL.TRT01A, plus a total', why: 'Safety analyses group by actual treatment.' },
    { id: 'method', label: 'Method', options: ['Summary statistics: n, mean, SD, median, min, max', 'Counts and percentages', 'ANCOVA', 'Kaplan-Meier'], answer: 'Summary statistics: n, mean, SD, median, min, max', why: 'A continuous variable is summarised with descriptive statistics.' },
  ] },
  { id: 'A-T3-PRIM', display: 'Table 14.2.1', analysis: 'Primary endpoint: change from baseline in HbA1c at Week 26', fields: [
    { id: 'set', label: 'Analysis set', options: SETS, answer: SETS[1], why: 'Efficacy is analysed on the intent-to-treat population.' },
    { id: 'ds', label: 'Dataset and variable', options: ['ADLB.CHG', 'ADLB.AVAL', 'ADSL.HBA1CBL', 'LB.LBSTRESN'], answer: 'ADLB.CHG', why: 'The endpoint is the change from baseline, CHG.' },
    { id: 'where', label: 'Selection (where clause)', options: ['PARAMCD = "HBA1C" and AVISITN = 26 and ANL01FL = "Y"', 'PARAMCD = "HBA1C" and AVISITN > 0', 'ABLFL = "Y"', 'AVISITN = 26'], answer: 'PARAMCD = "HBA1C" and AVISITN = 26 and ANL01FL = "Y"', why: 'One parameter, one visit, the analysis records.' },
    { id: 'method', label: 'Method', options: ['ANCOVA: CHG = treatment + baseline; LS means and differences from placebo with 95% CI', 'Two-sample t-test of CHG', 'Mixed model for repeated measures', 'Summary statistics only'], answer: 'ANCOVA: CHG = treatment + baseline; LS means and differences from placebo with 95% CI', why: 'As SAP section 9.3 specifies for this lab.' },
  ] },
]
export const arsScore = (a: Record<string, string> = {}) => {
  const all = ARS.flatMap((x) => x.fields.map((f) => ({ key: `${x.id}.${f.id}`, f })))
  return { right: all.filter(({ key, f }) => a[key] === f.answer).length, total: all.length, answered: all.filter(({ key }) => a[key]).length }
}
// The analysis results metadata as JSON, shaped after the ARS model's main objects.
export function arsJson(a: Record<string, string>) {
  return { standard: 'Shaped after CDISC Analysis Results Standard v1.0 (training subset)', analyses: ARS.map((x) => ({ id: x.id, name: x.analysis, outputs: [x.display], ...Object.fromEntries(x.fields.map((f) => [f.id === 'ds' ? 'datasetVariable' : f.id === 'set' ? 'analysisSet' : f.id === 'group' ? 'groupingFactor' : f.id === 'where' ? 'dataSubset' : 'method', a[`${x.id}.${f.id}`] ?? null])) })) }
}
