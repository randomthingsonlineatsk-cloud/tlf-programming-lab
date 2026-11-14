// The workflow features run on real R through webR in Node: information requests, the AI draft,
// tracing, data cuts (dummy codes and transfer 2), the HRP-301 pack and the analysis package.
import { expect, test, beforeAll } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebR } from 'webr'
import { unzipSync, strFromU8 } from 'fflate'
import { readHandoff } from '../src/domain/handoff'
import { loadHandoff, runReferences, runProgram, runAnswer, runTrace } from '../src/domain/runner'
import { packOf } from '../src/domain/rcode'
import { compareFrames } from '../src/domain/compare'
import { IRS } from '../src/domain/ir'
import { AI_DRAFT } from '../src/domain/aiwork'
import { REVIEW_PROGRAM } from '../src/domain/review'
import { TRACERS } from '../src/domain/trace'
import { DUMMY_R, TRANSFER2 } from '../src/domain/cut'
import { checkDataset } from '../src/domain/conform'
import { defineXml, adrgHtml, reportingEvent, buildPackage } from '../src/domain/submission'
import { hash } from '../src/domain/util'

const GLV = packOf('GLV-12-301'), HRP = packOf('HRP-301')
const glvZip = new Uint8Array(readFileSync(new URL('../public/data/glv-12-301-handoff.zip', import.meta.url)))
let w, refs
beforeAll(async () => {
  w = new WebR({ interactive: false }); await w.init()
  await loadHandoff(w, readHandoff(glvZip))
  refs = await runReferences(w, GLV)
}, 300000)

test('information requests: every reference answer runs; a wrong answer differs', async () => {
  for (const r of IRS) {
    const a = await runAnswer(w, GLV, r.reference)
    expect(a.ok, `${r.id}: ${a.error}`).toBe(true)
    console.log(r.id, a.values)
    expect(a.values.length).toBeGreaterThan(0)
  }
  const bad = await runAnswer(w, GLV, 'answer <- 42')
  expect(bad.values).toEqual(['42'])
}, 120000)

test('the AI draft differs from the reference, and the three fixes make it match', async () => {
  const t2 = GLV.programs.find((p) => p.id === 'T2')
  const draft = await runProgram(w, t2, AI_DRAFT, undefined, GLV)
  const c = compareFrames(draft.frame, refs.T2, t2.keys)
  const by = {}; for (const d of c.diffs) { const k = d.key.split(' | ')[0]; by[k] = (by[k] ?? 0) + 1 }
  console.log('AI draft diffs', JSON.stringify(by))
  expect(by.POP).toBeGreaterThan(0); expect(by.SOC).toBeGreaterThan(0)
  const fixed = AI_DRAFT.replace('adsl$RANDFL == "Y"', 'adsl$SAFFL == "Y"').replace('te <- merge(te, adsl[, c("USUBJID", "TRT01P")], by = "USUBJID")\n', '').replaceAll('TRT01P', 'TRT01A').replace('k <- sum(d$AEBODSYS == soc)', 'k <- length(unique(d$USUBJID[d$AEBODSYS == soc]))')
  const f = await runProgram(w, t2, fixed, undefined, GLV)
  expect(compareFrames(f.frame, refs.T2, t2.keys).ok).toBe(true)
  // Each defect alone also changes the output.
  for (const one of [fixed.replace('pop$TRT01A == g', 'pop$TRT01P == g').replace('te[te$TRT01A == g, ]', 'te[te$TRT01P == g, ]'),
    fixed.replace('adsl$SAFFL == "Y"', 'adsl$RANDFL == "Y"'), fixed.replace('k <- length(unique(d$USUBJID[d$AEBODSYS == soc]))', 'k <- sum(d$AEBODSYS == soc)')]) {
    const r = await runProgram(w, t2, one, undefined, GLV)
    expect(compareFrames(r.frame, refs.T2, t2.keys).ok).toBe(false)
  }
}, 120000)

test('the code-review program runs and loses records against the reference', async () => {
  const adae = GLV.programs.find((p) => p.id === 'ADAE')
  const r = await runProgram(w, adae, REVIEW_PROGRAM.join('\n'), undefined, GLV)
  expect(r.ok).toBe(true)
  const c = compareFrames(r.frame, refs.ADAE, adae.keys)
  console.log('review program: missing', c.missingRows.length, 'diffs', JSON.stringify(c.byVariable))
  expect(c.ok).toBe(false)
}, 60000)

test('tracing a cell finds analysis and SDTM records', async () => {
  const t = TRACERS['GLV-12-301']
  for (const [id, an, g, cat] of [['T2', 'PT', 'Placebo', 'Brain and nerves | Head pain'], ['T3', 'DIFF', 'GLV-12 10 mg', null], ['T6', 'SHIFT', 'Placebo', 'ALT | NORMAL | NORMAL'], ['T1', 'SEX', 'Total', 'F'], ['T4', 'DCSREAS', 'Total', 'ADVERSE EVENT'], ['T8', 'CLASS', 'Total', 'Biguanide class'], ['T7', 'CHG', 'Placebo', 'SYSBP'], ['T11', 'MEDIAN', 'Placebo', null]]) {
    const s = t[id](an, g, cat)
    const r = await runTrace(w, GLV, s.adam, s.sdtm)
    console.log('trace', id, r.adam.rows.length, r.sdtm?.rows.length)
    expect(r.adam.rows.length).toBeGreaterThan(0)
    if (s.sdtm) expect(r.sdtm.rows.length).toBeGreaterThan(0)
  }
}, 60000)

test('conformance checks pass on the reference datasets; the package is built', async () => {
  const ds = GLV.programs.filter((p) => p.kind === 'dataset')
  const f = ds.flatMap((p) => checkDataset(p, refs[p.id]))
  console.log('conformance on references:', f.map((x) => `${x.dataset} ${x.rule} ${x.message} ${x.examples.join(';')}`))
  expect(f.filter((x) => x.sev === 'Error')).toEqual([])
  const dir = mkdtempSync(join(tmpdir(), 'tlf-'))
  writeFileSync(join(dir, 'define.xml'), defineXml(GLV, refs))
  execFileSync('python3', ['-c', 'import sys,xml.etree.ElementTree as E; E.parse(sys.argv[1])', join(dir, 'define.xml')])
  const ards = Object.fromEntries(GLV.programs.filter((p) => p.kind === 'ard').map((p) => [p.id, refs[p.id]]))
  const ars = reportingEvent(GLV, ards, {})
  expect(ars.analyses.length).toBe(11)
  const displays = Object.fromEntries(Object.keys(ards).map((id) => [id, GLV.displays[id](refs[id])]))
  const { zip, manifest } = buildPackage({ pack: GLV, projectName: 't', userId: 'L-t', cut: 'Unblinded · transfer 1', source: null, producer: null, frames: refs, code: {}, library: '', programs: [], conformance: { errors: 0, warnings: 0, explained: 0, unexplained: 0 }, defineXml: defineXml(GLV, refs), adrg: adrgHtml(GLV, refs, f, { author: 'A', subjectIssues: 'x', explanations: {} }, 'cut', () => undefined), ars, displays, log: '' })
  const files = unzipSync(zip)
  expect(Object.keys(files)).toEqual(expect.arrayContaining(['analysis.json', 'adam/adsl.json', 'define.xml', 'adrg.html', 'tlf/t2.rtf', 'ars-reporting-event.json']))
  expect(JSON.parse(strFromU8(files['adam/adsl.json'])).records).toBe(90)
  expect(manifest.format).toBe('tlf-lab-analysis-package')
}, 60000)

test('data cuts: transfer 2 changes ADAE, ADLB, T2 and T3 but not ADSL; dummy codes change the efficacy result', async () => {
  const w2 = new WebR({ interactive: false }); await w2.init()
  await loadHandoff(w2, readHandoff(glvZip)); await w2.evalRVoid(TRANSFER2['GLV-12-301'].r)
  const t2 = await runReferences(w2, GLV)
  const changed = GLV.programs.filter((p) => hash(JSON.stringify(t2[p.id])) !== hash(JSON.stringify(refs[p.id]))).map((p) => p.id)
  console.log('transfer 2 changes', changed)
  expect(changed).toEqual(expect.arrayContaining(['ADAE', 'ADLB', 'T2', 'T3']))
  expect(changed).not.toContain('ADSL')
  await w2.evalRVoid('rm(list = ls(all.names = TRUE))'); await loadHandoff(w2, readHandoff(glvZip)); await w2.evalRVoid(DUMMY_R)
  const d = await runReferences(w2, GLV)
  expect(hash(JSON.stringify(d.T3))).not.toBe(hash(JSON.stringify(refs.T3)))
  expect(d.ADSL.rows.length).toBe(90)
  w2.close()
}, 300000)

test('HRP-301: the pack runs on a learner hand-off and its references self-match', async () => {
  const w3 = new WebR({ interactive: false }); await w3.init()
  const h = readHandoff(new Uint8Array(readFileSync(new URL('./fixtures/hrp301_sdtm_handoff.zip', import.meta.url))))
  expect(h.study.id).toBe('HRP-301')
  await loadHandoff(w3, h)
  const r = await runReferences(w3, HRP)
  console.log('HRP', Object.fromEntries(Object.entries(r).map(([k, f]) => [k, `${f.rows.length}x${f.columns.length}`])))
  for (const p of HRP.programs) {
    const x = await runProgram(w3, p, p.reference, undefined, HRP)
    expect(x.ok, `${p.id} ${x.error}`).toBe(true)
    expect(compareFrames(x.frame, r[p.id], p.keys).ok, p.id).toBe(true)
  }
  const tr = TRACERS['HRP-301'].T3('RESP', 'Placebo', null)
  expect((await runTrace(w3, HRP, tr.adam, tr.sdtm)).adam.rows.length).toBeGreaterThan(0)
  expect(HRP.programs.filter((p) => p.kind === 'dataset').flatMap((p) => checkDataset(p, r[p.id])).filter((x) => x.sev === 'Error')).toEqual([])
  w3.close()
}, 300000)

test('a table drawn from the exported analysis results file alone equals the one drawn from the program output', async () => {
  const { ardFromReportingEvent } = await import('../src/domain/submission')
  const ards = Object.fromEntries(GLV.programs.filter((p) => p.kind === 'ard').map((p) => [p.id, refs[p.id]]))
  const file = JSON.parse(JSON.stringify(reportingEvent(GLV, ards, {})))
  const back = ardFromReportingEvent(file)
  expect(back.study).toBe('GLV-12-301')
  for (const t of back.tables) {
    expect(compareFrames(t.frame, refs[t.id], ['ANALYSIS', 'GROUP', 'CATEGORY', 'STAT']).ok, t.id).toBe(true)
    expect(JSON.stringify(GLV.displays[t.id](t.frame))).toBe(JSON.stringify(GLV.displays[t.id](refs[t.id])))
  }
  expect(() => ardFromReportingEvent({ foo: 1 })).toThrow()
})
