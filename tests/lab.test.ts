import { describe, it, expect } from 'vitest'
import { createProject, recordRun, done, startMission, grade, certificate, trackOf, markReady, qcOutput } from '../src/domain/lab'
import { REVIEW_KEY } from '../src/domain/review'
import { AI_ISSUES, AI_RECORD_FIELDS } from '../src/domain/aiwork'
import { scanLog, headerMissing, headerTemplate } from '../src/domain/logscan'
import { checkDataset } from '../src/domain/conform'
import { sameAnswer } from '../src/domain/ir'
import { FINDINGS } from '../src/domain/qc'
import { ARS, arsScore } from '../src/domain/ars'
import { compareFrames } from '../src/domain/compare'

const match = { ok: true, missingVars: [], extraVars: [], missingRows: [], extraRows: [], duplicateKeys: [], diffs: [], byVariable: {}, comparedRows: 1, comparedValues: 1 }
const pass = (p: ReturnType<typeof createProject>, id: string) => recordRun(p, id, p.code[id], { ok: true, rows: 1 }, match, 1)
const allArs = () => Object.fromEntries(ARS.flatMap((a) => a.fields.map((f) => [`${a.id}.${f.id}`, f.answer])))

describe('lab', () => {
  it('a program is done only while its code is unchanged since the matching run', () => {
    const p = createProject('t')
    pass(p, 'ADSL')
    expect(done(p, 'ADSL')).toBe(true)
    p.code.ADSL += '\nx <- 1'
    expect(done(p, 'ADSL')).toBe(false)
  })
  it('partial credit for programs that reproduce part of the reference', () => {
    const p = startMission('M2', 'standard')
    recordRun(p, 'ADAE', p.code.ADAE, { ok: true }, { ...match, ok: false, diffs: [{ key: 'k', variable: 'TRTEMFL', got: 'N', want: 'Y' }] }, 0.9)
    expect(grade(p)!.score).toBe(Math.round(35 * 0.5 * 0.9))
  })
  it('M4 rewards real findings and penalises false ones', () => {
    const p = startMission('M4', 'expert')
    pass(p, 'T2'); p.qc.compared = true
    p.qc.findings = FINDINGS.filter((f) => f.real).map((f) => f.id)
    expect(grade(p)!.score).toBe(100)
    p.qc.findings.push('F4')
    expect(grade(p)!.score).toBe(80)
  })
  it('M5 needs the analysis results metadata', () => {
    const p = startMission('M5', 'guided')
    pass(p, 'T1')
    expect(grade(p)!.passed).toBe(false)
    p.ars = allArs()
    expect(arsScore(p.ars).right).toBe(8)
    expect(grade(p)!.score).toBe(100)
  })
  it('certificate needs the core missions and three workflow missions', () => {
    const passed = (id: string, level: 'expert' | 'standard' = 'expert') => { const p = startMission(id, level); p.mission!.endedUtc = '2026-11-14T00:00:00Z'; p.mission!.score = 90; return p }
    const core = ['M1', 'M2', 'M3', 'M4', 'M5'].map((id) => passed(id))
    expect(certificate(core, 'L-1', 'Ada').eligible).toBe(false)
    const c = certificate([...core, passed('M6'), passed('M7'), passed('M8')], 'L-1', 'Ada')
    expect(c.eligible).toBe(true)
    expect(c.distinction).toBe(false)
    expect(c.code).toMatch(/^TLF-[0-9A-Z]{5}-[0-9A-Z]{5}$/)
    expect(certificate([...core, passed('M6'), passed('M7'), passed('M8'), passed('M9'), passed('M10')], 'L-1', 'Ada').distinction).toBe(true)
    expect(certificate([...core.slice(1), passed('M6'), passed('M7'), passed('M8')], 'L-1', 'Ada').eligible).toBe(false)
  })
  it('workflow missions grade their goals', () => {
    const p = startMission('M8', 'standard')
    for (const k of REVIEW_KEY) p.review.marks[k.line] = k.cat
    expect(grade(p)!.score).toBe(100)
    p.review.marks[1] = 'hard'
    expect(grade(p)!.score).toBe(80)
    const a = startMission('M7', 'standard')
    a.ai.issues = AI_ISSUES.filter((i) => i.real).map((i) => i.id); a.ai.matched = true
    expect(grade(a)!.score).toBe(80)
    for (const f of AI_RECORD_FIELDS) a.ai.record[f.id] = 'A sentence long enough to count as a record entry.'
    expect(grade(a)!.score).toBe(100)
    const m10 = startMission('M10', 'guided')
    expect(m10.cut).toEqual({ phase: 'dry', transfer: 1 })
  })
  it('tracker: ready, QC, validated, and back to development when the code changes', () => {
    const p = createProject('t')
    expect(trackOf(p, 'ADSL').status).toBe('Not started')
    p.code.ADSL += '\n# change'
    expect(trackOf(p, 'ADSL').status).toBe('In development')
    markReady(p, 'ADSL')
    qcOutput(p, 'ADSL', true)
    expect(trackOf(p, 'ADSL').status).toBe('QC issues')
    pass(p, 'ADSL'); qcOutput(p, 'ADSL', true)
    expect(trackOf(p, 'ADSL').status).toBe('Validated')
    p.code.ADSL += '\n# again'
    expect(trackOf(p, 'ADSL').status).toBe('In development')
  })
  it('log scan and conformance checks', () => {
    expect(scanLog({ ok: true, output: [{ type: 'warning', text: 'NAs introduced by coercion' }], rows: 3 }, 'x <- 1').map((l) => l.level)).toEqual(['WARNING', 'NOTE'])
    expect(headerMissing(headerTemplate('a.R', 'p', ['dm'], 'adsl'))).toEqual([])
    const f = { columns: ['STUDYID', 'USUBJID', 'PARAMCD', 'PARAM', 'AVAL', 'BASE', 'CHG', 'ABLFL', 'SAFFL'], rows: [['S', '1', 'X', 'x', '5', '5', null, 'Y', 'Y'], ['S', '1', 'X', 'x', '7', '5', '1', null, 'Q']] }
    const rules = checkDataset({ output: 'advs', keys: ['USUBJID', 'PARAMCD'] } as never, f).map((x) => x.rule)
    expect(rules).toEqual(expect.arrayContaining(['LAB-AD04', 'LAB-AD05', 'LAB-AD09']))
  })
  it('answers to information requests compare as numbers or as sets', () => {
    expect(sameAnswer('numbers', ['1.0000001'], ['1'])).toBe(true)
    expect(sameAnswer('numbers', ['1.01'], ['1'])).toBe(false)
    expect(sameAnswer('ids', ['B', 'A'], ['A', 'B'])).toBe(true)
  })
  it('compare reports missing variables, rows and differing values', () => {
    const want = { columns: ['K', 'A'], rows: [['1', '0.1'], ['2', 'x']] }
    const got = { columns: ['K'], rows: [['1'], ['3']] }
    const c = compareFrames(got, want, ['K'])
    expect(c.missingVars).toEqual(['A'])
    expect(c.missingRows).toEqual(['2'])
    expect(c.extraRows).toEqual(['3'])
    const c2 = compareFrames({ columns: ['K', 'A'], rows: [['1', '0.1000000001'], ['2', 'y']] }, want, ['K'])
    expect(c2.diffs.map((d) => d.variable)).toEqual(['A'])
  })
})
