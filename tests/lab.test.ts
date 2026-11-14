import { describe, it, expect } from 'vitest'
import { createProject, recordRun, done, startMission, grade, submitMission, certificate, MISSIONS } from '../src/domain/lab'
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
  it('certificate needs every mission passed and is stable', () => {
    const ps = MISSIONS.map((m) => {
      const p = startMission(m.id, 'expert')
      m.programs.forEach((id) => pass(p, id))
      p.qc = { compared: true, findings: FINDINGS.filter((f) => f.real).map((f) => f.id) }
      p.ars = allArs(); p.runs.ADSL && (p.runs.ADSL.byVariable = {})
      submitMission(p)
      return p
    })
    expect(ps.every((p) => p.mission!.score === 100)).toBe(true)
    const c = certificate(ps, 'L-1', 'Ada')
    expect(c.eligible).toBe(true)
    expect(c.distinction).toBe(true)
    expect(c.code).toMatch(/^TLF-[0-9A-Z]{5}-[0-9A-Z]{5}$/)
    expect(certificate(ps.slice(1), 'L-1', 'Ada').eligible).toBe(false)
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
