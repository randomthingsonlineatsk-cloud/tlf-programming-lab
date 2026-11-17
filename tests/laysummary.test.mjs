// Runs the reference programs of both studies through webR and writes their analysis results
// (the ARS reporting event the Submission page downloads) into the Plain Language Lab, whose lay
// summary drill uses them as worked examples. Skipped when that repo is not beside this one.
import { expect, test } from 'vitest'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { WebR } from 'webr'
import { readHandoff } from '../src/domain/handoff'
import { loadHandoff, runReferences } from '../src/domain/runner'
import { packOf } from '../src/domain/rcode'
import { reportingEvent } from '../src/domain/submission'

const LAB = new URL('../../plain-language-lab/src/domain/', import.meta.url)
test('write the reporting events for the Plain Language Lab', async () => {
  if (!existsSync(LAB)) return
  const out = {}
  for (const [study, file] of [['GLV-12-301', '../public/data/glv-12-301-handoff.zip'], ['HRP-301', './fixtures/hrp301_sdtm_handoff.zip']]) {
    const w = new WebR({ interactive: false }); await w.init()
    await loadHandoff(w, readHandoff(new Uint8Array(readFileSync(new URL(file, import.meta.url)))))
    const pack = packOf(study), refs = await runReferences(w, pack)
    const ards = Object.fromEntries(pack.programs.filter((p) => p.kind === 'ard').map((p) => [p.id, refs[p.id]]).filter(([, f]) => f))
    out[study] = { ...reportingEvent(pack, ards, {}), study }
    w.close()
  }
  expect(out['HRP-301'].analyses.length).toBeGreaterThan(2)
  writeFileSync(new URL('results.json', LAB), JSON.stringify(out, null, 1) + '\n')
}, 600000)
