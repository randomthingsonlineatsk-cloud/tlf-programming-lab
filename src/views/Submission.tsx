import { useEffect, useState } from 'react'
import { useStore } from '../state'
import { packOf } from '../domain/rcode'
import { checkDataset, findingKey, RULES, type Finding } from '../domain/conform'
import { defineXml, adrgHtml, reportingEvent, buildPackage, ardFromReportingEvent, type ImportedTable } from '../domain/submission'
import { PACKS } from '../domain/rcode'
import { displayRtf } from '../domain/display'
import { codeHash, done } from '../domain/lab'
import { logClean } from '../domain/logscan'
import { cutKey, cutLabel } from '../domain/cut'
import { LIBRARY } from '../domain/rlib'
import { batchRun, sessionFrames, onSession } from '../session'
import { currentHandoff } from '../rclient'
import { getLearner } from '../domain/passport'
import { download } from '../domain/store'
import { Btn, Panel, Pill, Table, TextArea } from './ui'

export default function Submission({ ready }: { ready: boolean }) {
  const { p, act } = useStore()
  const pack = packOf(p!.study)
  const [busy, setBusy] = useState('')
  const [, force] = useState(0)
  useEffect(() => onSession(() => force((n) => n + 1)), [])
  const frames = sessionFrames()
  const ds = pack.programs.filter((q) => q.kind === 'dataset')
  const missing = ds.filter((q) => !frames[q.id]).map((q) => q.id)
  const findings: Finding[] = (p!.conformance?.findings ?? []) as Finding[]
  const explain = (f: Finding) => p!.adrg.explanations[findingKey(f)]?.trim() || undefined
  const runChecks = () => act((x) => { x.conformance = { utc: new Date().toISOString(), findings: ds.filter((q) => frames[q.id]).flatMap((q) => checkDataset(q, frames[q.id])) } })
  const batch = async () => { setBusy('starting'); try { await batchRun(p!, act, (id) => setBusy(id)) } finally { setBusy('') } }
  const dl = (name: string, text: string, type: string, mark: 'defineUtc' | 'adrgUtc' | 'arsUtc') => { download(name, text, type); act((x) => { x.submission[mark] = new Date().toISOString() }) }
  const ards = Object.fromEntries(pack.programs.filter((q) => q.kind === 'ard' && frames[q.id]).map((q) => [q.id, frames[q.id]]))
  const last = [...p!.snapshots].reverse().find((s) => s.cut === cutKey(p!.cut))
  const pkg = () => {
    const h = currentHandoff()
    const displays = Object.fromEntries(Object.entries(ards).filter(([id]) => pack.displays[id]).map(([id, f]) => [id, pack.displays[id](f)]))
    const progs = pack.programs.map((q) => ({ id: q.id, kind: q.kind, output: q.output, matched: done(p!, q.id), rows: frames[q.id]?.rows.length ?? 0, codeHash: codeHash(p!.code[q.id] ?? ''), log: (last?.results[q.id] && logClean(last.results[q.id].log) ? 'clean' : 'issues') as 'clean' | 'issues', logItems: (last?.results[q.id]?.log ?? []).map((l) => `${l.level}: ${l.text}`) }))
    const { zip } = buildPackage({
      pack, projectName: p!.name, userId: getLearner().userId, cut: cutLabel(p!.cut), source: (h?.study as { source?: unknown })?.source ?? null, producer: h?.producer ?? null,
      frames, code: p!.code, library: LIBRARY, programs: progs,
      conformance: { errors: findings.filter((f) => f.sev === 'Error').length, warnings: findings.filter((f) => f.sev !== 'Error').length, explained: findings.filter((f) => explain(f)).length, unexplained: findings.filter((f) => !explain(f)).length },
      defineXml: defineXml(pack, frames), adrg: adrgHtml(pack, frames, findings, p!.adrg, cutLabel(p!.cut), explain), ars: reportingEvent(pack, ards, p!.ars), displays, log: (last ? pack.programs.map((q) => `${q.id}: ${(last.results[q.id]?.log ?? []).map((l) => `${l.level} ${l.text}`).join(' | ') || 'clean'}`) : ['No batch run']).join('\n'),
    })
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
    const a = document.createElement('a'); a.href = url; a.download = `${pack.id.toLowerCase()}-analysis-package.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    act((x) => { x.submission.packageUtc = new Date().toISOString(); x.history.push({ utc: x.submission.packageUtc, what: 'Analysis package exported' }) })
  }
  return (
    <div className="space-y-4">
      <Panel title="Analysis datasets for submission" sub="The documents built here come from your datasets as they ran in this session." right={<Btn tone="solid" disabled={!ready || !!busy} onClick={batch}>{busy ? `Running ${busy}…` : 'Run all programs'}</Btn>}>
        <Table head={['Dataset', 'In this session', 'Matches reference']} rows={ds.map((q) => [<span className="font-mono">{q.output.toUpperCase()}</span>, frames[q.id] ? `${frames[q.id].rows.length} records` : <span className="text-lab-text-muted">not run</span>, done(p!, q.id) ? <Pill tone="green">yes</Pill> : <Pill tone="amber">no</Pill>])} />
        {missing.length > 0 && <p className="text-xs text-lab-amber">Run {missing.join(', ')} (or run all programs) before building the documents.</p>}
      </Panel>

      <Panel title="ADaM conformance checks" sub="Structure, keys, flags, baseline and change, time-to-event and naming, on your datasets. Errors must be fixed; warnings and notices that remain are explained in the reviewer's guide." right={<Btn disabled={missing.length === ds.length} onClick={runChecks}>Run the checks</Btn>}>
        <details className="text-xs"><summary className="cursor-pointer text-lab-text-muted">The checks</summary><Table head={['Check', 'Severity', 'Rule']} rows={RULES.map((r) => [r.id, r.sev, r.text])} /></details>
        {p!.conformance ? (findings.length ? <Table head={['Dataset', 'Check', 'Severity', 'Finding', 'Records', 'Explanation for the reviewer\'s guide']} rows={findings.map((f) => [f.dataset, f.rule, <Pill tone={f.sev === 'Error' ? 'red' : f.sev === 'Warning' ? 'amber' : 'grey'}>{f.sev}</Pill>, <span>{f.message}<span className="block text-[11px] text-lab-text-muted">{f.examples.join('; ')}</span></span>, f.count,
          <TextArea aria-label={`Explanation ${f.dataset} ${f.rule}`} className="min-h-12 text-xs" value={p!.adrg.explanations[findingKey(f)] ?? ''} onChange={(e) => act((x) => { x.adrg.explanations[findingKey(f)] = e.target.value })} placeholder={f.sev === 'Error' ? 'Fix the program instead' : 'Why this is expected'} />])} />
          : <p className="text-sm text-lab-cdsco">No findings.</p>) : <p className="text-sm text-lab-text-muted">Not run yet.</p>}
      </Panel>

      <Panel title="Analysis data reviewer's guide" sub="Generated from the specifications, the dataset metadata and the checks; sections follow the PHUSE ADRG template. Two parts need you.">
        <label className="block text-sm">Prepared by<input className="block w-full max-w-sm rounded-md border border-lab-line bg-lab-panel-strong px-2 py-1.5 text-sm" value={p!.adrg.author} onChange={(e) => act((x) => { x.adrg.author = e.target.value })} /></label>
        <label className="block text-sm">Section 3.4: subject issues that require special analysis rules<TextArea value={p!.adrg.subjectIssues} onChange={(e) => act((x) => { x.adrg.subjectIssues = e.target.value })} placeholder="For example: participants randomised but never dosed; a participant who received a different treatment from the one planned; imputed dates." /></label>
      </Panel>

      <Panel title="Documents and package">
        <div className="flex flex-wrap gap-2">
          <Btn disabled={missing.length === ds.length} onClick={() => dl('define.xml', defineXml(pack, frames), 'application/xml', 'defineUtc')}>define.xml (Define-XML 2.1)</Btn>
          <Btn disabled={missing.length === ds.length} onClick={() => dl('adrg.html', adrgHtml(pack, frames, findings, p!.adrg, cutLabel(p!.cut), explain), 'text/html', 'adrgUtc')}>Reviewer's guide (HTML)</Btn>
          <Btn disabled={!Object.keys(ards).length} onClick={() => dl('ars-reporting-event.json', JSON.stringify(reportingEvent(pack, ards, p!.ars), null, 2), 'application/json', 'arsUtc')}>Analysis results (ARS JSON)</Btn>
          <Btn tone="solid" disabled={missing.length > 0} onClick={pkg}>Analysis package (.zip)</Btn>
        </div>
        <p className="text-xs text-lab-text-muted">The package holds the analysis datasets (Dataset-JSON v1.1), results, displays (RTF), define.xml, the reviewer's guide, the analysis results as JSON, every program and the batch log, with a manifest (analysis.json). {p!.study === 'HRP-301' ? 'For HRP-301 it is step 8 of the lifecycle journey on the pharmolecule hub, which checks it.' : ''}</p>
        <p className="text-[11px] text-lab-text-muted">FDA recommends Define-XML 2.1 for studies starting on or after 15 March 2023. Analysis results metadata are not part of Define-XML 2.1 itself, so they travel here as a reporting event shaped after the Analysis Results Standard.</p>
      </Panel>
      <ImportResults />
    </div>
  )
}

// Draw tables from an analysis results file alone (exported here or by another project).
function ImportResults() {
  const [data, setData] = useState<{ study: string; tables: ImportedTable[]; name: string } | null>(null)
  const [sel, setSel] = useState('')
  const [err, setErr] = useState('')
  const load = async (f: File) => {
    setErr('')
    try { const r = ardFromReportingEvent(JSON.parse(await f.text())); if (!PACKS[r.study]) throw new Error(`No displays for study ${r.study}.`); setData({ ...r, name: f.name }); setSel(r.tables.find((t) => PACKS[r.study].displays[t.id])?.id ?? '') } catch (e) { setErr((e as Error).message); setData(null) }
  }
  const pack = data ? PACKS[data.study] : null
  const t = data?.tables.find((x) => x.id === sel)
  const d = t && pack?.displays[t.id] ? pack.displays[t.id](t.frame) : null
  return (
    <Panel title="Draw tables from an analysis results file" sub="Metadata-driven displays: load an analysis results JSON (the reporting event above) and each table is rebuilt from the results and metadata in the file alone, without running any program. Drawn this way, a table is identical to the one drawn from the program output; the tests check that for every table.">
      <input type="file" accept=".json,application/json" aria-label="Analysis results JSON file" className="text-xs" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
      {err && <p role="alert" className="text-xs text-lab-red">{err}</p>}
      {data && pack && <>
        <p className="text-xs text-lab-text-muted">{data.name}: study {data.study}, {data.tables.length} analyses, {data.tables.reduce((n, x) => n + x.frame.rows.length, 0)} results.</p>
        <div className="flex flex-wrap gap-1">{data.tables.filter((x) => pack.displays[x.id]).map((x) => <Btn key={x.id} className="py-0.5" tone={sel === x.id ? 'solid' : 'grey'} onClick={() => setSel(x.id)}>{x.id}</Btn>)}</div>
        {d && <div className="space-y-2">
          <div className="overflow-x-auto bg-white text-slate-900 rounded p-3">
            <p className="text-xs font-mono font-bold">{d.title}</p><p className="text-[11px] font-mono">{d.population}</p>
            <table className="w-full text-xs font-mono mt-1"><thead><tr className="border-y border-slate-800"><th className="text-left p-1" />{d.head.map((h) => <th key={h} className="p-1">{h}</th>)}</tr></thead>
              <tbody>{d.rows.map((r, i) => <tr key={i}><td className={`p-1 ${r.indent ? 'pl-6' : ''}`}>{r.label}</td>{r.cells.map((c, j) => <td key={j} className="p-1 text-center">{c.text}</td>)}</tr>)}</tbody></table>
            {d.footnotes.map((x) => <p key={x} className="text-[11px] mt-1">{x}</p>)}
          </div>
          <Btn tone="grey" onClick={() => download(`${t!.id.toLowerCase()}-from-results.rtf`, displayRtf(d, data.study), 'application/rtf')}>RTF</Btn>
        </div>}
      </>}
    </Panel>
  )
}
