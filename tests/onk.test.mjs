// ONK-44-302: the oncology reference programs run in webR on the SDTM Mapping Trainer's hand-off,
// and every table cell agrees with an independent JavaScript derivation of the same analyses
// (the CSR & Narrative Studio's scripts/make-onk-44-302.mjs, whose survival statistics were
// cross-checked against a survival library). Skipped when the Studio is not beside this repo.
import { expect, test } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { WebR } from 'webr'
import { readHandoff } from '../src/domain/handoff'
import { loadHandoff, runReferences } from '../src/domain/runner'
import { packOf } from '../src/domain/rcode'

const IND = new URL('./fixtures/onk-independent.json', import.meta.url)
test('ONK-44-302 programs agree with the independent derivation', async () => {
  const w = new WebR({ interactive: false }); await w.init()
  await loadHandoff(w, readHandoff(new Uint8Array(readFileSync(new URL('./fixtures/onk44302_sdtm_handoff.zip', import.meta.url)))))
  const pack = packOf('ONK-44-302'), refs = await runReferences(w, pack)
  for (const p of pack.programs) expect(refs[p.id], p.id).toBeTruthy()
  if (existsSync(IND)) {
    const ind = JSON.parse(readFileSync(IND, 'utf8'))
    for (const o of ind.outputs.filter((x) => x.display)) {
      const d = pack.displays[o.id](refs[o.id])
      const a = d.rows.map((r) => `${r.label}: ${r.cells.map((c) => c.text).join(' | ')}`), b = o.display.rows.map((r) => `${r.label}: ${r.cells.map((c) => c.text).join(' | ')}`)
      expect(a, o.id).toEqual(b)
    }
  }
  w.close()
}, 900000)
