// The analysis package: ADaM datasets as Dataset-JSON v1.1, define.xml (Define-XML 2.1) for them,
// the analysis data reviewer's guide (sections of the PHUSE ADRG template), analysis results as
// a reporting event shaped after CDISC's Analysis Results Standard, the displays as RTF, the
// programs and the log. The hub's lifecycle journey checks the manifest (analysis.json).
import { strToU8, zipSync } from 'fflate'
import type { Frame } from './runner'
import type { Program, StudyPack } from './packs/types'
import { displayRtf } from './display'
import type { Finding } from './conform'
import { ARS } from './ars'

export const PACKAGE_FORMAT = 'tlf-lab-analysis-package'
const x = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))

const LABELS: Record<string, string> = {
  STUDYID: 'Study Identifier', USUBJID: 'Unique Subject Identifier', SUBJID: 'Subject Identifier for the Study', SITEID: 'Study Site Identifier', AGE: 'Age', AGEU: 'Age Units', SEX: 'Sex', RACE: 'Race', ETHNIC: 'Ethnicity', COUNTRY: 'Country',
  AGEGR1: 'Pooled Age Group 1', AGEGR1N: 'Pooled Age Group 1 (N)', TRT01P: 'Planned Treatment for Period 01', TRT01PN: 'Planned Treatment for Period 01 (N)', TRT01A: 'Actual Treatment for Period 01', TRT01AN: 'Actual Treatment for Period 01 (N)',
  TRTSDT: 'Date of First Exposure to Treatment', TRTEDT: 'Date of Last Exposure to Treatment', TRTDURD: 'Total Treatment Duration (Days)', RANDFL: 'Randomized Population Flag', ITTFL: 'Intent-To-Treat Population Flag', SAFFL: 'Safety Population Flag',
  RANDDT: 'Date of Randomization', EOSSTT: 'End of Study Status', DCSREAS: 'Reason for Discontinuation from Study', EOSDT: 'End of Study Date', HBA1CBL: 'Baseline HbA1c (%)', HECSIBL: 'Baseline HECSI Score', IGABL: 'Baseline IGA-CHE Score', ITCHBL: 'Baseline Itch NRS',
  AESEQ: 'Sequence Number', AETERM: 'Reported Term for the Adverse Event', AEDECOD: 'Dictionary-Derived Term', AEBODSYS: 'Body System or Organ Class', AESEV: 'Severity/Intensity', AESER: 'Serious Event', AEREL: 'Causality',
  ASTDT: 'Analysis Start Date', ASTDTF: 'Analysis Start Date Imputation Flag', AENDT: 'Analysis End Date', ASTDY: 'Analysis Start Relative Day', TRTEMFL: 'Treatment Emergent Analysis Flag',
  PARAMCD: 'Parameter Code', PARAM: 'Parameter', AVISIT: 'Analysis Visit', AVISITN: 'Analysis Visit (N)', ADT: 'Analysis Date', ADY: 'Analysis Relative Day', AVAL: 'Analysis Value', ABLFL: 'Baseline Record Flag', BASE: 'Baseline Value', CHG: 'Change from Baseline', PCHG: 'Percent Change from Baseline',
  ANL01FL: 'Analysis Flag 01', ANRLO: 'Analysis Normal Range Lower Limit', ANRHI: 'Analysis Normal Range Upper Limit', ANRIND: 'Analysis Reference Range Indicator', BNRIND: 'Baseline Reference Range Indicator', LBSEQ: 'Sequence Number', VSSEQ: 'Sequence Number', QSSEQ: 'Sequence Number', VISIT: 'Visit Name',
  CMSEQ: 'Sequence Number', CMTRT: 'Reported Name of Drug, Med, or Therapy', CMDECOD: 'Standardized Medication Name', CMCLAS: 'Medication Class', CMINDC: 'Indication', CMENRTPT: 'End Relative to Reference Time Point', PREFL: 'Prior Medication Flag', ONTRTFL: 'On Treatment Record Flag',
  STARTDT: 'Time-to-Event Origin Date', CNSR: 'Censor', EVNTDESC: 'Event or Censoring Description', CNSDTDSC: 'Censor Date Description', CRIT1: 'Analysis Criterion 1', CRIT1FL: 'Criterion 1 Evaluation Result Flag',
}
const CLASS: Record<string, [string, string?]> = { adsl: ['SUBJECT LEVEL ANALYSIS DATASET'], adae: ['OCCURRENCE DATA STRUCTURE', 'ADVERSE EVENT'], adcm: ['OCCURRENCE DATA STRUCTURE'], adtte: ['BASIC DATA STRUCTURE', 'TIME-TO-EVENT'] }
const classOf = (out: string) => CLASS[out] ?? ['BASIC DATA STRUCTURE']
const typeOf = (f: Frame, i: number): 'integer' | 'float' | 'date' | 'text' => {
  const v = f.rows.map((r) => r[i]).filter((s): s is string => s !== null)
  if (v.length && v.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))) return 'date'
  if (v.length && v.every((s) => s !== '' && Number.isFinite(Number(s)))) return v.every((s) => Number.isInteger(Number(s))) ? 'integer' : 'float'
  return 'text'
}
const derivationOf = (p: Program, v: string) => p.spec.find((s) => s.name.split(/[,/()]/).map((t) => t.trim()).includes(v))

export function datasetJson(pack: StudyPack, p: Program, f: Frame, now = new Date()) {
  const cols = f.columns.map((c, i) => { const t = typeOf(f, i); const k = p.keys.indexOf(c); return { itemOID: `IT.${p.output.toUpperCase()}.${c}`, name: c, label: LABELS[c] ?? c, dataType: t === 'date' ? 'date' : t === 'integer' ? 'integer' : t === 'float' ? 'double' : 'string', ...(t === 'text' ? { length: Math.max(1, ...f.rows.map((r) => (r[i] ?? '').length)) } : {}), ...(k >= 0 ? { keySequence: k + 1 } : {}) } })
  return {
    datasetJSONCreationDateTime: now.toISOString().slice(0, 19), datasetJSONVersion: '1.1.0', fileOID: `${pack.id}.${p.output.toUpperCase()}`,
    originator: 'TLF Programming Lab (training data, fictional study)', sourceSystem: { name: 'TLF Programming Lab', version: '2' }, studyOID: pack.id,
    metaDataVersionOID: `MDV.${pack.id}.ADaMIG.1.3`, metaDataRef: 'define.xml', itemGroupOID: `IG.${p.output.toUpperCase()}`, records: f.rows.length, name: p.output.toUpperCase(), label: p.title.split(':')[1]?.trim() ?? p.title,
    columns: cols, rows: f.rows.map((r) => r.map((v, i) => (v === null ? null : cols[i].dataType === 'integer' || cols[i].dataType === 'double' ? Number(v) : v))),
  }
}

export function defineXml(pack: StudyPack, frames: Record<string, Frame>, now = new Date()): string {
  const ds = pack.programs.filter((p) => p.kind === 'dataset' && frames[p.id])
  const items: string[] = [], methods: string[] = [], groups: string[] = []
  for (const p of ds) {
    const f = frames[p.id], D = p.output.toUpperCase(), [cls, sub] = classOf(p.output)
    const refs = f.columns.map((c, i) => { const k = p.keys.indexOf(c); const der = derivationOf(p, c); return `      <ItemRef ItemOID="IT.${D}.${c}" OrderNumber="${i + 1}" Mandatory="${p.keys.includes(c) ? 'Yes' : 'No'}"${k >= 0 ? ` KeySequence="${k + 1}"` : ''}${der && !/^From /.test(der.label) ? ` MethodOID="MT.${D}.${c}"` : ''}/>` })
    groups.push(`    <ItemGroupDef OID="IG.${D}" Domain="${D}" Name="${D}" Repeating="${D === 'ADSL' ? 'No' : 'Yes'}" IsReferenceData="No" SASDatasetName="${D}" Purpose="Analysis" def:Structure="${x(D === 'ADSL' ? 'One record per subject' : `One record per ${p.keys.slice(1).join(', ') || 'subject'} per subject`)}" def:StandardOID="STD.ADAMIG.1.3" def:ArchiveLocationID="LF.${D}">
      <Description><TranslatedText xml:lang="en">${x(p.title.split(':')[1]?.trim() ?? p.title)}</TranslatedText></Description>
${refs.join('\n')}
      <def:Class Name="${cls}">${sub ? `<def:SubClass Name="${sub}"/>` : ''}</def:Class>
      <def:leaf ID="LF.${D}" xlink:href="adam/${p.output}.json"><def:title>${p.output}.json</def:title></def:leaf>
    </ItemGroupDef>`)
    f.columns.forEach((c, i) => {
      const t = typeOf(f, i), der = derivationOf(p, c), from = der && /^From (\w+)/.exec(der.label)
      const len = t === 'text' ? ` Length="${Math.max(1, ...f.rows.map((r) => (r[i] ?? '').length))}"` : ''
      const origin = from ? `<def:Origin Type="Predecessor"><Description><TranslatedText xml:lang="en">${x(`${from[1]}.${c}`)}</TranslatedText></Description></def:Origin>` : der ? '<def:Origin Type="Derived"/>' : '<def:Origin Type="Predecessor"/>'
      items.push(`    <ItemDef OID="IT.${D}.${c}" Name="${c}" DataType="${t}"${len} SASFieldName="${c}"><Description><TranslatedText xml:lang="en">${x(LABELS[c] ?? c)}</TranslatedText></Description>${origin}</ItemDef>`)
      if (der && !from) methods.push(`    <MethodDef OID="MT.${D}.${c}" Name="Algorithm to derive ${D}.${c}" Type="${/imput/i.test(der.derivation) ? 'Imputation' : 'Computation'}"><Description><TranslatedText xml:lang="en">${x(der.derivation)}</TranslatedText></Description></MethodDef>`)
    })
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by the TLF Programming Lab for a fictional training study. Not a submission. -->
<ODM xmlns="http://www.cdisc.org/ns/odm/v1.3" xmlns:def="http://www.cdisc.org/ns/def/v2.1" xmlns:xlink="http://www.w3.org/1999/xlink"
     ODMVersion="1.3.2" FileType="Snapshot" FileOID="DEF.${pack.id}.ADAM" CreationDateTime="${now.toISOString().slice(0, 19)}"
     Originator="TLF Programming Lab" SourceSystem="TLF Programming Lab" SourceSystemVersion="2" def:Context="Submission">
  <Study OID="${pack.id}">
    <GlobalVariables><StudyName>${x(pack.id)}</StudyName><StudyDescription>${x(pack.title)}</StudyDescription><ProtocolName>${x(pack.id)}</ProtocolName></GlobalVariables>
    <MetaDataVersion OID="MDV.${pack.id}.ADaMIG.1.3" Name="${x(pack.id)} ADaM" def:DefineVersion="2.1.7">
    <def:Standards><def:Standard OID="STD.ADAMIG.1.3" Name="ADaMIG" Type="IG" Version="1.3" Status="Final"/></def:Standards>
${groups.join('\n')}
${items.join('\n')}
${methods.join('\n')}
    </MetaDataVersion>
  </Study>
</ODM>
`
}

// Analysis results as a reporting event, shaped after the ARS v1.0 model's main objects.
export function reportingEvent(pack: StudyPack, ards: Record<string, Frame>, arsAnswers: Record<string, string>) {
  const tables = pack.programs.filter((p) => p.kind === 'ard')
  const setOf = (p: Program) => (/SAFFL|safety/i.test(p.reference) && !/ITTFL/.test(p.reference) ? 'AS_SAF' : /RANDFL/.test(p.reference) && p.id === 'T4' ? 'AS_RAND' : 'AS_ITT')
  return {
    id: `RE_${pack.id}`, name: `${pack.id} clinical study report analyses (training)`, version: 1,
    analysisSets: [
      { id: 'AS_SAF', name: 'Safety population', condition: { dataset: 'ADSL', variable: 'SAFFL', comparator: 'EQ', value: ['Y'] } },
      { id: 'AS_ITT', name: 'Intent-to-treat population', condition: { dataset: 'ADSL', variable: 'ITTFL', comparator: 'EQ', value: ['Y'] } },
      { id: 'AS_RAND', name: 'Randomised participants', condition: { dataset: 'ADSL', variable: 'RANDFL', comparator: 'EQ', value: ['Y'] } },
    ],
    analysisGroupings: [
      { id: 'GRP_TRTA', name: 'Actual treatment', groupingVariable: 'TRT01A', dataDriven: false, groups: [...pack.groups, 'Total'].map((g, i) => ({ id: `GRP_TRTA_${i + 1}`, name: g, condition: g === 'Total' ? undefined : { dataset: 'ADSL', variable: 'TRT01A', comparator: 'EQ', value: [g] } })) },
      { id: 'GRP_TRTP', name: 'Planned treatment', groupingVariable: 'TRT01P', dataDriven: false, groups: [...pack.groups, 'Total'].map((g, i) => ({ id: `GRP_TRTP_${i + 1}`, name: g, condition: g === 'Total' ? undefined : { dataset: 'ADSL', variable: 'TRT01P', comparator: 'EQ', value: [g] } })) },
    ],
    methods: tables.map((p) => ({ id: `MTH_${p.id}`, name: p.title, description: p.spec.slice(5).map((s) => s.derivation).join(' ') || p.intro, operations: [...new Set((ards[p.id]?.rows ?? []).map((r) => r[3]))].map((op, i) => ({ id: `MTH_${p.id}_${op}`, name: op, order: i + 1 })) })),
    analyses: tables.map((p) => {
      const f = ards[p.id], gv = /TRT01P/.test(p.reference) && !/TRT01A/.test(p.reference) ? 'GRP_TRTP' : 'GRP_TRTA'
      const meta = pack.id === 'GLV-12-301' ? ARS.find((a) => a.display === p.title.split(':')[0]) : undefined // the analyses with learner metadata
      return {
        id: `AN_${p.id}`, name: p.title, analysisSetId: setOf(p), methodId: `MTH_${p.id}`, orderedGroupings: [{ order: 1, groupingId: gv, resultsByGroup: true }],
        ...(meta ? { learnerMetadata: Object.fromEntries(meta.fields.map((fl) => [fl.id, arsAnswers[`${meta.id}.${fl.id}`] ?? null])) } : {}),
        results: (f?.rows ?? []).map((r) => ({ operationId: `MTH_${p.id}_${r[3]}`, analysis: r[0], category: r[2], resultGroups: [{ groupingId: gv, groupName: r[1] }], rawValue: r[4] })),
      }
    }),
    outputs: tables.map((p) => ({ id: `OUT_${p.id}`, name: p.title.split(':')[0], displays: [{ order: 1, displayTitle: p.title }], analysisIds: [`AN_${p.id}`] })),
  }
}

export interface AdrgInput { author: string; subjectIssues: string; explanations: Record<string, string> }
export function adrgHtml(pack: StudyPack, frames: Record<string, Frame>, findings: Finding[], a: AdrgInput, cut: string, explain: (f: Finding) => string | undefined): string {
  const ds = pack.programs.filter((p) => p.kind === 'dataset')
  const outs = pack.programs.filter((p) => p.kind !== 'dataset')
  const row = (cells: string[]) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`
  const tbl = (head: string[], rows: string[][]) => `<table><thead><tr>${head.map((h) => `<th>${x(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row).join('')}</tbody></table>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${x(pack.id)} Analysis Data Reviewer's Guide</title>
<style>body{font-family:Georgia,serif;max-width:52rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#111;background:#fff}h1{font-size:1.6rem}h2{font-size:1.2rem;border-bottom:1px solid #ccc;margin-top:2rem}table{border-collapse:collapse;width:100%;font-size:.85rem;margin:.5rem 0}td,th{border:1px solid #bbb;padding:3px 6px;text-align:left;vertical-align:top}.note{font-size:.8rem;color:#555}</style></head><body>
<p class="note">Training document for a fictional study, generated by the TLF Programming Lab. Section headings follow the PHUSE ADRG template.</p>
<h1>Analysis Data Reviewer's Guide</h1><p><b>${x(pack.id)}</b>: ${x(pack.title)}</p><p>Prepared by ${x(a.author || '(name)')} · ${new Date().toISOString().slice(0, 10)} · Data cut: ${x(cut)}</p>
<h2>1. Introduction</h2><p>This guide gives context for the analysis datasets and terminology of ${x(pack.id)} that accompany the define.xml. Standards: ADaMIG v1.3 with ADaM v2.1; Define-XML 2.1; datasets as Dataset-JSON v1.1. Dictionaries: the training Study Medical Dictionary and Study Drug Dictionary (fictional).</p>
<h2>2. Protocol description</h2><p>${x(pack.title)}. Statistical analysis plan: ${x(pack.sap)}.</p>
<h2>3. Analysis considerations related to multiple analysis datasets</h2>
<p><b>3.1 Comparison of SDTM and ADaM content.</b> Every ADaM dataset is derived from the SDTM hand-off; no data were collected outside SDTM.</p>
<p><b>3.2 Core variables.</b> STUDYID, USUBJID, the treatment variables and population flags come from ADSL.</p>
<p><b>3.3 Treatment variables.</b> TRT01P (planned, efficacy analyses) and TRT01A (actual, safety analyses). ${pack.groups.map(x).join(', ')}.</p>
<p><b>3.4 Subject issues that require special analysis rules.</b> ${x(a.subjectIssues || '(to be completed)')}</p>
<p><b>3.5 Use of visit windowing, unscheduled visits and record selection; imputation.</b> ${x(ds.flatMap((p) => p.spec.filter((s) => /window|imput|ANL01FL/i.test(s.name + s.derivation)).map((s) => `${p.output.toUpperCase()} ${s.name}: ${s.derivation}`)).join(' ') || 'None.')}</p>
<h2>4. Analysis data creation and processing issues</h2><p><b>4.1 Data dependencies.</b></p>
${tbl(['Dataset', 'Depends on'], ds.map((p) => [p.output.toUpperCase(), p.needs.map((n) => pack.programs.find((q) => q.id === n)!.output.toUpperCase()).join(', ') || 'SDTM only']))}
<h2>5. Analysis dataset descriptions</h2>
${tbl(['Dataset', 'Description', 'Class', 'Records', 'Key variables'], ds.map((p) => [p.output.toUpperCase(), x(p.title.split(':')[1] ?? p.title), classOf(p.output).join(' / '), String(frames[p.id]?.rows.length ?? '–'), p.keys.join(', ')]))}
<h2>6. Data conformance summary</h2><p>Checks: the lab's ADaM conformance checks (LAB-AD01 to LAB-AD14) on the datasets as delivered.</p>
${findings.length ? tbl(['Dataset', 'Check', 'Severity', 'Message', 'Records', 'Explanation'], findings.map((f) => [f.dataset, f.rule, f.sev, x(f.message), String(f.count), x(explain(f) ?? '(not explained)')])) : '<p>No findings.</p>'}
<h2>7. Submission of programs</h2><p>The analysis dataset and output programs are submitted as text files (programs/*.R), base R 4.6; the lab library (lab_mmrm, lab_estimate, lab_cox) is included as programs/lab_library.R.</p>
${tbl(['Program', 'Output', 'Title'], [...ds, ...outs].map((p) => [`${p.id.toLowerCase()}.R`, p.output, x(p.title)]))}
</body></html>`
}

export interface PackageInput {
  pack: StudyPack; projectName: string; userId: string; cut: string; source: unknown; producer: unknown
  frames: Record<string, Frame>; code: Record<string, string>; library: string
  programs: { id: string; kind: string; output: string; matched: boolean; rows: number; codeHash: string; log: 'clean' | 'issues'; logItems: string[] }[]
  conformance: { errors: number; warnings: number; explained: number; unexplained: number }
  defineXml: string; adrg: string; ars: object; displays: Record<string, import('./display').Display>; log: string
}
export function buildPackage(i: PackageInput, now = new Date()): { zip: Uint8Array; manifest: Record<string, unknown> } {
  const files: Record<string, Uint8Array> = {}
  for (const p of i.pack.programs) {
    const f = i.frames[p.id]
    if (f && p.kind === 'dataset') files[`adam/${p.output}.json`] = strToU8(JSON.stringify(datasetJson(i.pack, p, f, now)))
    if (f && p.kind !== 'dataset') files[`results/${p.output}.json`] = strToU8(JSON.stringify({ columns: f.columns, rows: f.rows }))
    files[`programs/${p.id.toLowerCase()}.R`] = strToU8(i.code[p.id] ?? '')
  }
  for (const [id, d] of Object.entries(i.displays)) files[`tlf/${id.toLowerCase()}.rtf`] = strToU8(displayRtf(d, i.pack.id))
  files['programs/lab_library.R'] = strToU8(i.library)
  files['define.xml'] = strToU8(i.defineXml)
  files['adrg.html'] = strToU8(i.adrg)
  files['ars-reporting-event.json'] = strToU8(JSON.stringify(i.ars, null, 1))
  files['logs/batch.log'] = strToU8(i.log)
  const manifest = {
    format: PACKAGE_FORMAT, version: 1, createdUtc: now.toISOString(),
    producer: { app: 'TLF Programming Lab', project: i.projectName, userId: i.userId },
    study: { id: i.pack.id, title: i.pack.title, cut: i.cut }, handoff: { source: i.source ?? null, producer: i.producer ?? null },
    standards: { adam: 'ADaMIG v1.3', define: 'Define-XML 2.1', datasetJson: 'Dataset-JSON 1.1', results: 'Shaped after CDISC Analysis Results Standard v1.0' },
    programs: i.programs, conformance: i.conformance,
    files: ['analysis.json', ...Object.keys(files).sort()],
  }
  files['analysis.json'] = strToU8(JSON.stringify(manifest, null, 1))
  return { zip: zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [v, { level: 6, mtime: now }]]))), manifest }
}

// The other direction: rebuild the analysis results data of each table from a reporting event
// file alone, so a display can be drawn from the metadata and results without the programs.
export interface ImportedTable { id: string; title: string; frame: Frame }
export function ardFromReportingEvent(re: unknown): { study: string; tables: ImportedTable[] } {
  const r = re as { id?: string; analyses?: { id: string; name: string; methodId: string; results?: { operationId: string; analysis: string; category: string | null; resultGroups?: { groupName?: string }[]; rawValue: string | number | null }[] }[] }
  if (!r || typeof r.id !== 'string' || !r.id.startsWith('RE_') || !Array.isArray(r.analyses)) throw new Error('This is not an analysis results file from the lab (a reporting event with analyses).')
  const study = r.id.slice(3)
  const tables = r.analyses.map((a) => {
    const prefix = `${a.methodId}_`
    return {
      id: a.id.replace(/^AN_/, ''), title: a.name,
      frame: { columns: ['ANALYSIS', 'GROUP', 'CATEGORY', 'STAT', 'VALUE'], rows: (a.results ?? []).map((x) => [x.analysis, x.resultGroups?.[0]?.groupName ?? null, x.category ?? null, x.operationId.startsWith(prefix) ? x.operationId.slice(prefix.length) : x.operationId, x.rawValue === null || x.rawValue === undefined ? null : String(x.rawValue)]) },
    }
  })
  return { study, tables }
}
