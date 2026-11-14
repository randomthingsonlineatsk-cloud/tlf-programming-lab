import { useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { packOf } from '../domain/rcode'
import { trackOf, markReady, qcOutput, type Snapshot } from '../domain/lab'
import { cutKey, cutLabel, TRANSFER2 } from '../domain/cut'
import { logClean } from '../domain/logscan'
import { compareFrames } from '../domain/compare'
import { batchRun } from '../session'
import { installPackages } from '../rclient'
import { download } from '../domain/store'
import { Btn, Panel, Pill, Table, fmtUtc } from './ui'

const toneOf = (s: string) => (s === 'Validated' ? 'green' : s === 'QC issues' ? 'red' : s === 'Ready for QC' ? 'blue' : s === 'In development' ? 'amber' : 'grey') as 'green' | 'red' | 'blue' | 'amber' | 'grey'

export default function Runs({ ready }: { ready: boolean }) {
  const { p, act } = useStore()
  const { go } = useNav()
  const pack = packOf(p!.study)
  const [busy, setBusy] = useState('')
  const last = [...p!.snapshots].reverse().find((s) => s.cut === cutKey(p!.cut))
  const run = async () => { setBusy('starting'); try { await batchRun(p!, act, (id) => setBusy(id)) } finally { setBusy('') } }
  const setCut = (phase: 'dry' | 'final', transfer: 1 | 2) => act((x) => { x.cut = { phase, transfer }; x.history.push({ utc: new Date().toISOString(), what: `Data cut: ${cutLabel(x.cut)}` }) })
  const csv = () => download(`${pack.id}-programming-tracker.csv`, ['Output,Title,Type,Programmer,QC programmer,Status,Last run,Matches reference,Log,Open issues,Validated'].concat(pack.programs.map((q) => { const t = trackOf(p!, q.id); const b = last?.results[q.id]; return [q.id, `"${q.title.replace(/"/g, '""')}"`, q.kind, 'You', 'Independent QC program (lab)', t.status, p!.runs[q.id]?.utc ?? '', p!.runs[q.id]?.matched ? 'Yes' : 'No', b ? (logClean(b.log) ? 'Clean' : 'Issues') : 'Not run', t.issues.filter((i) => !i.resolvedUtc).length, t.validatedUtc ?? ''].join(',') })).join('\n'), 'text/csv')
  return (
    <div className="space-y-4">
      <Panel title="Data cut" sub="Programs are written and checked on a blinded dry run with dummy treatment codes, rerun when the database is locked and unblinded, and rerun again on each new data transfer." right={<Pill tone={p!.cut.phase === 'dry' ? 'amber' : 'green'}>{cutLabel(p!.cut)}</Pill>}>
        <div className="flex flex-wrap gap-2">
          {p!.cut.phase === 'dry' ? <Btn tone="solid" onClick={() => { if (confirm('Unblind? The real treatment codes are loaded and every output must be rerun.')) setCut('final', p!.cut.transfer) }}>Lock and unblind</Btn> : <Btn tone="grey" onClick={() => setCut('dry', p!.cut.transfer)}>Back to dummy codes</Btn>}
          {TRANSFER2[pack.id] && (p!.cut.transfer === 1 ? <Btn onClick={() => setCut(p!.cut.phase, 2)}>Load transfer 2</Btn> : <Btn tone="grey" onClick={() => setCut(p!.cut.phase, 1)}>Back to transfer 1</Btn>)}
        </div>
        {TRANSFER2[pack.id] && p!.cut.transfer === 2 && <ul className="text-xs list-disc pl-5 text-lab-text-muted">{TRANSFER2[pack.id].changes.map((c) => <li key={c}>{c}</li>)}</ul>}
        {p!.cut.phase === 'dry' && <p className="text-xs text-lab-amber">Dry run: treatment assignments are shuffled. Results by treatment mean nothing yet; the structure, populations and derivations are what you check now.</p>}
      </Panel>

      <Panel title="Batch run and log review" sub="Runs every program in order with your code, compares each output with the reference, and scans each log for errors, warnings, notes and a complete program header." right={<Btn tone="solid" disabled={!ready || !!busy} onClick={run}>{busy ? `Running ${busy}…` : 'Run all programs'}</Btn>}>
        {last ? <>
          <p className="text-xs text-lab-text-muted">Last batch on this cut: {fmtUtc(last.utc)} UTC · {Object.values(last.results).filter((r) => r.matched).length} of {Object.keys(last.results).length} outputs match · {Object.values(last.results).filter((r) => logClean(r.log)).length} clean logs.</p>
          <Table head={['Program', 'Ran', 'Matches', 'Records', 'Log']} rows={pack.programs.map((q) => { const b = last.results[q.id]; return [<button className="font-mono underline" onClick={() => go('programs', q.id)}>{q.id}</button>, b ? (b.ok ? 'yes' : <span className="text-lab-red">error</span>) : '–', b?.matched ? '✓' : '–', b?.rows ?? '–', b ? (b.log.length ? <ul>{b.log.map((l, i) => <li key={i}><Pill tone={l.level === 'ERROR' ? 'red' : l.level === 'WARNING' ? 'amber' : 'grey'}>{l.level}</Pill> <span className="text-[11px]">{l.text}</span></li>)}</ul> : <Pill tone="green">clean</Pill>) : '–'] })} />
        </> : <p className="text-sm text-lab-text-muted">No batch run on this data cut yet.</p>}
      </Panel>

      <Panel title="Programming tracker" sub="One line per output: who programs it, who checks it, and where it stands. An output is validated when its independent QC matches and its log is clean; changing the code afterwards sends it back to development." right={<Btn tone="grey" onClick={csv}>Export CSV</Btn>}>
        <Table head={['Output', 'Programmer', 'QC', 'Status', 'Issues', '']} rows={pack.programs.map((q) => {
          const t = trackOf(p!, q.id), b = last?.results[q.id]
          return [<span><span className="font-mono">{q.id}</span> <span className="text-[11px] text-lab-text-muted">{q.title.split(':')[0]}</span></span>, 'You', 'Independent program', <Pill tone={toneOf(t.status)}>{t.status}</Pill>,
            <IssueList id={q.id} />,
            <span className="flex flex-wrap gap-1">
              {(t.status === 'In development' || t.status === 'QC issues') && <Btn className="py-0.5" onClick={() => act((x) => markReady(x, q.id))}>Ready for QC</Btn>}
              {(t.status === 'Ready for QC' || t.status === 'QC issues') && <Btn className="py-0.5" tone="solid" disabled={!b} title={b ? '' : 'Batch-run first: QC needs the log'} onClick={() => act((x) => qcOutput(x, q.id, !!b && logClean(b.log)))}>Run QC</Btn>}
            </span>]
        })} />
      </Panel>

      <SnapshotCompare />
      <Packages ready={ready} />
    </div>
  )
}

function IssueList({ id }: { id: string }) {
  const { p, act } = useStore()
  const t = trackOf(p!, id)
  const [text, setText] = useState('')
  const open = t.issues.filter((i) => !i.resolvedUtc)
  return (
    <details className="text-xs"><summary className="cursor-pointer">{open.length} open · {t.issues.length - open.length} resolved</summary>
      <ul className="space-y-1 mt-1">{t.issues.map((i) => <li key={i.id} className={i.resolvedUtc ? 'text-lab-text-muted line-through' : ''}>{i.by}: {i.text}{!i.resolvedUtc && <button className="ml-1 underline" onClick={() => act((x) => { const tr = trackOf(x, id); x.tracker[id] = { ...tr, issues: tr.issues.map((k) => (k.id === i.id ? { ...k, resolvedUtc: new Date().toISOString(), resolution: 'Resolved by the programmer' } : k)) } })}>resolve</button>}</li>)}</ul>
      <div className="flex gap-1 mt-1"><input aria-label={`New issue for ${id}`} className="flex-1 rounded border border-lab-line bg-lab-panel-strong px-1 py-0.5" value={text} onChange={(e) => setText(e.target.value)} placeholder="Raise an issue" />
        <button className="underline" disabled={!text.trim()} onClick={() => { act((x) => { const tr = trackOf(x, id); x.tracker[id] = { ...tr, issues: [...tr.issues, { id: `I${tr.issues.length + 1}`, text: text.trim(), raisedUtc: new Date().toISOString(), by: 'Programmer' }] } }); setText('') }}>add</button></div>
    </details>
  )
}

// Which outputs changed between two batch runs (for example transfer 1 and transfer 2).
export function snapDiff(a: Snapshot, b: Snapshot, keys: Record<string, string[]>) {
  return Object.keys(b.results).filter((id) => a.results[id]).map((id) => {
    const x = a.results[id], y = b.results[id]
    let cells: number | undefined
    if (x.ard && y.ard) { const c = compareFrames(y.ard, x.ard, keys[id] ?? []); cells = c.diffs.length + c.missingRows.length + c.extraRows.length }
    return { id, changed: x.hash !== y.hash || x.rows !== y.rows, rows: [x.rows, y.rows] as const, cells }
  })
}
function SnapshotCompare() {
  const { p, act } = useStore()
  const pack = packOf(p!.study)
  const s = p!.snapshots
  const [a, setA] = useState(s.at(-2)?.id ?? ''), [b, setB] = useState(s.at(-1)?.id ?? '')
  const A = s.find((x) => x.id === a), B = s.find((x) => x.id === b)
  const keys = Object.fromEntries(pack.programs.map((q) => [q.id, q.keys]))
  const diff = A && B ? snapDiff(A, B, keys) : []
  const f1 = [...s].reverse().find((x) => x.cut === 'final-1'), f2 = [...s].reverse().find((x) => x.cut === 'final-2')
  const truth = f1 && f2 ? snapDiff(f1, f2, keys).filter((d) => d.changed).map((d) => d.id) : null
  const marked = p!.changedReview?.marked ?? []
  const sel = (x: Snapshot) => `${fmtUtc(x.utc)} · ${x.label}`
  return (
    <Panel title="Compare runs" sub="Which outputs changed between two batch runs, and by how many results. After a new transfer, every changed output needs a reason in the data.">
      {s.length < 2 ? <p className="text-sm text-lab-text-muted">Two batch runs are needed.</p> : <>
        <div className="flex flex-wrap gap-2 text-xs items-center">
          <label>From <select className="rounded border border-lab-line bg-lab-panel-strong px-1" value={a} onChange={(e) => setA(e.target.value)}>{s.map((x) => <option key={x.id} value={x.id}>{sel(x)}</option>)}</select></label>
          <label>to <select className="rounded border border-lab-line bg-lab-panel-strong px-1" value={b} onChange={(e) => setB(e.target.value)}>{s.map((x) => <option key={x.id} value={x.id}>{sel(x)}</option>)}</select></label>
        </div>
        <Table head={['Output', 'Changed', 'Records', 'Results that differ']} rows={diff.map((d) => [<span className="font-mono">{d.id}</span>, d.changed ? <Pill tone="amber">changed</Pill> : 'no', `${d.rows[0] ?? '–'} → ${d.rows[1] ?? '–'}`, d.cells ?? '–'])} />
      </>}
      {p!.mission?.id === 'M10' && (
        <div className="rounded border border-lab-line p-2 space-y-2">
          <p className="text-sm">Impact of transfer 2: tick every output that the new data changed (unblinded runs of transfer 1 and transfer 2).</p>
          <div className="flex flex-wrap gap-3 text-xs">{pack.programs.filter((q) => ['ADSL', 'ADAE', 'ADLB', 'T2', 'T3'].includes(q.id)).map((q) => <label key={q.id} className="flex gap-1 items-center"><input type="checkbox" checked={marked.includes(q.id)} onChange={() => act((x) => { const m = x.changedReview?.marked ?? []; x.changedReview = { from: f1?.id ?? '', to: f2?.id ?? '', marked: m.includes(q.id) ? m.filter((k) => k !== q.id) : [...m, q.id] } })} />{q.id}</label>)}</div>
          <Btn disabled={!truth} onClick={() => act((x) => { const want = truth!.filter((id) => ['ADSL', 'ADAE', 'ADLB', 'T2', 'T3'].includes(id)).sort().join(','); x.changedReview = { ...x.changedReview!, checkedUtc: new Date().toISOString(), correct: [...(x.changedReview?.marked ?? [])].sort().join(',') === want } })}>Check my answer</Btn>
          {!truth && <p className="text-[11px] text-lab-text-muted">Needs an unblinded batch run on transfer 1 and on transfer 2.</p>}
          {p!.changedReview?.checkedUtc && <p className={`text-xs ${p!.changedReview.correct ? 'text-lab-cdsco' : 'text-lab-amber'}`}>{p!.changedReview.correct ? 'Right.' : 'Not quite: compare the two unblinded runs above.'}</p>}
        </div>
      )}
    </Panel>
  )
}

const PRESETS = ['dplyr', 'tidyr', 'survival', 'mmrm', 'admiral', 'cards', 'gtsummary', 'rtables']
function Packages({ ready }: { ready: boolean }) {
  const { p, act } = useStore()
  const [res, setRes] = useState<{ name: string; ok: boolean; detail: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const install = async (names: string[]) => { setBusy(true); try { const r = await installPackages(names); setRes(r); act((x) => { x.packages = [...new Set([...x.packages, ...r.filter((k) => k.ok).map((k) => k.name)])] }) } finally { setBusy(false) } }
  return (
    <Panel title="Optional package mode" sub="Most companies program with open-source packages (the pharmaverse: admiral for ADaM; cards, gtsummary, rtables or Tplyr for tables). Your browser can download webR builds of them from the webR package repository. The lab's references stay in base R, so the comparison works either way. Packages are loaded for this session only; some may not be available as webR builds.">
      <div className="flex flex-wrap gap-1">{PRESETS.map((n) => <Btn key={n} className="py-0.5" tone="grey" disabled={!ready || busy} onClick={() => install([n])}>{n}</Btn>)}</div>
      <div className="flex gap-2"><input aria-label="Package name" className="rounded border border-lab-line bg-lab-panel-strong px-2 py-1 text-sm" value={name} onChange={(e) => setName(e.target.value.trim())} placeholder="Another package" /><Btn disabled={!ready || busy || !name} onClick={() => install([name])}>{busy ? 'Installing…' : 'Install'}</Btn></div>
      {res.length > 0 && <ul className="text-xs">{res.map((r) => <li key={r.name}><Pill tone={r.ok ? 'green' : 'red'}>{r.name}</Pill> {r.detail}</li>)}</ul>}
      {p!.packages.length > 0 && <p className="text-xs text-lab-text-muted">Installed in this project before: {p!.packages.join(', ')} (reinstall after reloading the page).</p>}
    </Panel>
  )
}
