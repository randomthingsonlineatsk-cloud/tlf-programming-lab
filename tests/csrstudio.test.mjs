// Runs the reference programs of both studies through webR and writes every table (its ARD and
// the drawn display), listing and figure data into the CSR & Narrative Studio, whose report
// sections are written from them. Skipped when that repo is not beside this one.
import { expect, test } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { WebR } from 'webr'
import { readHandoff } from '../src/domain/handoff'
import { loadHandoff, runReferences } from '../src/domain/runner'
import { packOf } from '../src/domain/rcode'
import { reportingEvent } from '../src/domain/submission'

const OUT = new URL('../../csr-narrative-studio/src/data/', import.meta.url)
const KEEP = ['ADSL']
test('write the study outputs for the CSR & Narrative Studio', async () => {
  if (!existsSync(OUT)) return
  for (const [study, file, name] of [['GLV-12-301', '../public/data/glv-12-301-handoff.zip', 'glv-12-301'], ['HRP-301', './fixtures/hrp301_sdtm_handoff.zip', 'hrp-301']]) {
    const w = new WebR({ interactive: false }); await w.init()
    await loadHandoff(w, readHandoff(new Uint8Array(readFileSync(new URL(file, import.meta.url)))))
    const pack = packOf(study), refs = await runReferences(w, pack)
    const outputs = pack.programs.filter((p) => p.kind !== 'dataset' || KEEP.includes(p.id)).filter((p) => refs[p.id]).map((p) => ({
      id: p.id, title: p.title, kind: p.kind, area: p.area, ref: p.ref, shell: p.shell ?? '', frame: refs[p.id],
      display: p.kind === 'ard' && pack.displays[p.id] ? pack.displays[p.id](refs[p.id]) : null,
    }))
    const ards = Object.fromEntries(pack.programs.filter((p) => p.kind === 'ard').map((p) => [p.id, refs[p.id]]).filter(([, f]) => f))
    const doc = { format: 'csr-studio/study-outputs', schema: 1, study, title: pack.title, short: pack.short, sap: pack.sap, groups: pack.groups, source: 'TLF Programming Lab reference programs', outputs, reportingEvent: { ...reportingEvent(pack, ards, {}), study } }
    expect(outputs.filter((o) => o.kind === 'ard').length).toBeGreaterThan(3)
    writeFileSync(new URL(`${name}.json`, OUT), JSON.stringify(doc) + '\n')
    w.close()
  }
}, 900000)
