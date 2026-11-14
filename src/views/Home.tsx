import { useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { createProject, done } from '../domain/lab'
import { PROGRAMS } from '../domain/rcode'
import { readHandoff } from '../domain/handoff'
import { Btn, Panel, Pill, Table, fmtUtc } from './ui'

export default function Home() {
  const { p, projects, open, close, remove } = useStore()
  const { go } = useNav()
  const [msg, setMsg] = useState('')
  const upload = async (f: File) => {
    try {
      const zip = new Uint8Array(await f.arrayBuffer())
      const h = readHandoff(zip)
      if (h.study.id !== 'GLV-12-301') throw new Error(`This hand-off is for ${h.study.id}; the lab's specifications are written for GLV-12-301.`)
      open(createProject(`${h.study.id} from ${f.name}`, { zip, zipName: f.name, study: h.study.id }))
      go('programs')
    } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <div className="space-y-4">
      <Panel title="Program the analysis of a clinical trial, in R" sub="The statistical programmer's job after SDTM: derive the analysis datasets (ADaM), then produce the tables, listings and figures for the clinical study report, each checked by an independent second program.">
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div><p className="font-semibold">1 · Analysis datasets</p><p className="text-lab-text-muted">ADSL (one record per participant), ADAE (occurrence data) and ADLB (basic data structure: parameter, visit, baseline and change), to ADaMIG v1.3.</p></div>
          <div><p className="font-semibold">2 · Tables, listings, figures</p><p className="text-lab-text-muted">Demographics, adverse events by system class and term, the ANCOVA of the primary endpoint, the SAE listing and a figure. Tables are built as analysis results data, then drawn.</p></div>
          <div><p className="font-semibold">3 · Independent QC</p><p className="text-lab-text-muted">Each output is compared, record by record, with a reference program written separately to the same specification, the way double programming works.</p></div>
        </div>
        <p className="text-xs text-lab-text-muted">R 4.6 runs inside your browser (webR): nothing you write leaves this computer, and projects are kept in this browser only. The first start downloads the R runtime once (about 20 MB).</p>
      </Panel>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Start" sub="GLV-12-301 is a fictional phase 3 trial of GLV-12 (5 mg and 10 mg) against placebo in type 2 diabetes: 90 screened, 81 randomised, 80 dosed.">
          <div className="flex flex-wrap gap-2">
            <Btn tone="solid" onClick={() => { open(createProject('GLV-12-301 practice')); go('programs') }}>New practice project</Btn>
            <Btn tone="grey" onClick={() => go('missions')}>Scored missions</Btn>
            <Btn tone="grey" onClick={() => go('learn')}>Learn first</Btn>
          </div>
          <label className="block text-sm mt-2">Or start from your own SDTM hand-off, exported from the <a className="underline" href="https://randomthingsonlineatsk-cloud.github.io/sdtm-mapping-trainer/" target="_blank" rel="noopener">SDTM Mapping Trainer</a> (Datasets &amp; checks tab, "Hand-off to the TLF Programming Lab"):
            <input type="file" accept=".zip,application/zip" className="block mt-1 text-xs" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {msg && <p role="alert" className="text-xs text-lab-red">{msg}</p>}
          <p className="text-[11px] text-lab-text-muted">The lab reads the Dataset-JSON datasets in the hand-off. Your own SDTM may differ from the trainer's reference; the reference programs then run on your data, so the comparison stays fair.</p>
        </Panel>
        <Panel title="Your projects" sub="Kept in this browser.">
          <Table empty="No projects yet." head={['Project', 'Source', 'Programs matched', 'Updated', '']} rows={projects.map((x) => [
            <span className="text-xs">{x.name}{x.mission?.endedUtc ? <Pill tone={(x.mission.score ?? 0) >= 80 ? 'green' : 'red'} className="ml-1">{x.mission.score}%</Pill> : x.mission ? <Pill tone="blue" className="ml-1">in progress</Pill> : null}</span>,
            <span className="text-xs">{x.source === 'uploaded' ? x.handoffName : 'shipped hand-off'}</span>,
            `${PROGRAMS.filter((q) => done(x, q.id)).length} / ${PROGRAMS.length}`,
            <span className="text-[11px] font-mono">{fmtUtc(x.updated)}</span>,
            <span className="flex gap-1">{p?.id === x.id ? <Pill tone="green">open</Pill> : <Btn className="py-0.5" onClick={() => { open(x); go('programs') }}>Open</Btn>}<Btn tone="grey" className="py-0.5" onClick={() => { if (confirm(`Delete ${x.name}?`)) remove(x.id) }}>Delete</Btn></span>,
          ])} />
          {p && <Btn tone="grey" onClick={close}>Close the open project</Btn>}
        </Panel>
      </div>
    </div>
  )
}
