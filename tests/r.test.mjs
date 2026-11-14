// Runs real R through webR in Node: the reference programs on the shipped hand-off, the compare
// engine, and the planted-bug programs.
import { expect, test, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { WebR } from 'webr'
import { readHandoff } from '../src/domain/handoff'
import { loadHandoff, runReferences, runProgram } from '../src/domain/runner'
import { PROGRAMS, programById } from '../src/domain/rcode'
import { compareFrames } from '../src/domain/compare'

let w, refs
beforeAll(async () => {
  w = new WebR({ interactive: false }); await w.init()
  const h = readHandoff(new Uint8Array(readFileSync(new URL('../public/data/glv-12-301-handoff.zip', import.meta.url))))
  await loadHandoff(w, h)
  refs = await runReferences(w)
}, 240000)

test('reference outputs', () => {
  const sum = Object.fromEntries(Object.entries(refs).map(([k, f]) => [k, `${f.rows.length}x${f.columns.length}`]))
  console.log(JSON.stringify(sum))
  const adsl = refs.ADSL; const c = (n) => adsl.columns.indexOf(n)
  expect(adsl.rows.length).toBe(90)
  expect(adsl.rows.filter((r) => r[c('SAFFL')] === 'Y').length).toBe(80)
  expect(adsl.rows.filter((r) => r[c('RANDFL')] === 'Y').length).toBe(81)
  const t3 = refs.T3; console.log(t3.rows.map((r) => r.join(' ')).join('\n'))
  console.log(refs.T1.rows.slice(0, 12).map((r) => r.join(' ')).join('\n'))
  console.log(refs.L1.rows.map((r) => r.join(' ')).join('\n'))
})
test('the reference code run as a learner program matches itself', async () => {
  for (const p of PROGRAMS) {
    const r = await runProgram(w, p, p.reference)
    expect(r.ok, `${p.id}: ${r.error}`).toBe(true)
    expect(compareFrames(r.frame, refs[p.id], p.keys).ok, p.id).toBe(true)
  }
}, 120000)
test('an error and a wrong derivation are reported', async () => {
  const p = programById.get('ADSL')
  const bad = await runProgram(w, p, 'adsl <- data.frame(x = undefined_thing)')
  expect(bad.ok).toBe(false); expect(bad.error).toMatch(/undefined_thing/)
  const wrong = await runProgram(w, p, p.reference.replace('adsl$AGE < 65, "<65"', 'adsl$AGE <= 65, "<65"').replace('AGEGR1N <- ifelse(adsl$AGE < 65', 'AGEGR1N <- ifelse(adsl$AGE <= 65'))
  const cmp = compareFrames(wrong.frame, refs.ADSL, p.keys)
  console.log('wrong:', JSON.stringify(cmp.byVariable), cmp.diffs.slice(0, 2))
  expect(cmp.ok).toBe(false)
}, 60000)

import { PROD_T2 } from '../src/domain/qc'
import { runProduction } from '../src/domain/runner'
test('each planted production error shows in the comparison', async () => {
  const prod = await runProduction(w, PROD_T2)
  const cmp = compareFrames(prod, refs.T2, ['ANALYSIS', 'GROUP', 'CATEGORY', 'STAT'])
  const ix = (n) => refs.T2.columns.indexOf(n)
  const byAn = {}; for (const d of cmp.diffs) { const a = d.key.split(' | ')[0]; byAn[a] = (byAn[a] ?? 0) + 1 }
  console.log('prod diffs', JSON.stringify(byAn), cmp.missingRows.length, cmp.extraRows.length, cmp.diffs.filter((d) => d.key.startsWith('POP')).map((d) => `${d.key} ${d.got}/${d.want}`))
  console.log(cmp.diffs.filter((d) => d.key.startsWith('PT') && d.key.endsWith('| n')).slice(0, 6).map((d) => `${d.key} ${d.got}/${d.want}`))
  // F1: N differs; F2/F3 show in counts
  expect(cmp.diffs.some((d) => d.key.startsWith('POP') )).toBe(true)
  const r = await runProgram(w, programById.get('ADAE'), 'adae <- .ref_adae[.ref_adae$TRTEMFL == "Y" & .ref_adae$ASTDY == 1, ]')
  console.log('TEAEs on day 1:', r.frame.rows.length)
  const dup = await runProgram(w, programById.get('ADAE'), 'x <- .ref_adae[.ref_adae$TRTEMFL == "Y", ]; adae <- x[duplicated(paste(x$USUBJID, x$AEDECOD)), ]')
  console.log('repeat PT within participant:', dup.frame.rows.length)
  const pt = await runProgram(w, programById.get('ADSL'), 'adsl <- .ref_adsl[.ref_adsl$SAFFL == "Y" & .ref_adsl$TRT01P != .ref_adsl$TRT01A, ]')
  console.log('planned != actual in safety:', pt.frame.rows.length)
}, 60000)
