import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { PROGRAMS, programById, type Program } from '../domain/rcode'
import { compareFrames, matchRate, type Comparison } from '../domain/compare'
import { DISPLAYS, displayHtml, type Display } from '../domain/display'
import { recordRun, done } from '../domain/lab'
import type { Frame, RunResult } from '../domain/runner'
import { run, referenceFrames } from '../rclient'
import { download } from '../domain/store'
import Editor from './Editor'
import { Btn, Panel, Pill, Table, Tabs } from './ui'

// Session-only results (frames and plots are not saved; the summary is).
const lastResults = new Map<string, { res: RunResult; cmp?: Comparison }>()
export const lastFrame = (id: string) => lastResults.get(id)?.res.frame

export default function Programs({ ready }: { ready: boolean }) {
  const { p } = useStore()
  const { arg, go } = useNav()
  const visible = p!.mission ? PROGRAMS.filter((x) => missionPrograms(p!.mission!.id).includes(x.id) || needsOf(p!.mission!.id).includes(x.id)) : PROGRAMS
  const id = arg && programById.has(arg) ? arg : visible[0].id
  return (
    <div className="grid lg:grid-cols-[15rem_1fr] gap-4">
      <Panel title="Programs">
        <ul className="space-y-0.5">
          {PROGRAMS.map((x) => {
            const st = done(p!, x.id) ? 'done' : p!.runs[x.id] ? (p!.runs[x.id].ok ? 'differs' : 'error') : 'todo'
            return (
              <li key={x.id}><button onClick={() => go('programs', x.id)} aria-current={id === x.id ? 'true' : undefined} className={`w-full text-left px-2 py-1 rounded text-xs ${id === x.id ? 'bg-lab-fda-soft text-lab-fda' : 'hover:bg-lab-panel-strong'} ${visible.includes(x) ? '' : 'opacity-60'}`}>
                <span className="font-mono">{x.id}</span> <span className="text-lab-text-muted">{x.kind === 'dataset' ? 'ADaM' : x.kind === 'ard' ? 'table' : x.kind}</span>
                <span className="float-right">{st === 'done' ? '✓' : st === 'differs' ? '≠' : st === 'error' ? '!' : ''}</span>
              </button></li>
            )
          })}
        </ul>
        <p className="text-[11px] text-lab-text-muted">✓ matches the reference · ≠ differs · ! error. Each program reads the SDTM datasets and the validated upstream ADaM datasets.</p>
      </Panel>
      <Workspace key={id} prog={programById.get(id)!} ready={ready} />
    </div>
  )
}
export const missionPrograms = (m: string) => ({ M1: ['ADSL'], M2: ['ADAE', 'T2', 'L1'], M3: ['ADLB', 'T3', 'F1'], M4: ['T2'], M5: ['T1'] } as Record<string, string[]>)[m] ?? []
const needsOf = (m: string) => [...new Set(missionPrograms(m).flatMap((x) => programById.get(x)!.needs))]

function Workspace({ prog, ready }: { prog: Program; ready: boolean }) {
  const { p, act } = useStore()
  const [code, setCode] = useState(p!.code[prog.id] ?? prog.starter)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'spec' | 'console' | 'compare' | 'output' | 'display'>('spec')
  const [, force] = useState(0)
  const r = lastResults.get(prog.id)
  const level = p!.mission?.level ?? 'guided'
  const save = (v: string) => { setCode(v); act((x) => { x.code[prog.id] = v }) }
  const exec = async () => {
    if (!ready || busy) return
    setBusy(true)
    try {
      const res = await run(prog, code)
      const ref = referenceFrames()[prog.id]
      const cmp = res.ok && res.frame ? compareFrames(res.frame, ref, prog.keys) : undefined
      lastResults.set(prog.id, { res, cmp })
      act((x) => recordRun(x, prog.id, code, { ok: res.ok, error: res.error, rows: res.frame?.rows.length }, cmp, cmp ? matchRate(cmp, ref) : 0))
      setTab(!res.ok ? 'console' : 'compare')
    } finally { setBusy(false); force((n) => n + 1) }
  }
  const last = p!.runs[prog.id]
  return (
    <div className="space-y-3 min-w-0">
      <Panel title={prog.title} sub={prog.intro} right={<Pill>{prog.ref}</Pill>}>
        <Editor value={code} onChange={save} onRun={exec} label={`R program ${prog.id}`} />
        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="solid" disabled={!ready || busy} onClick={exec}>{busy ? 'Running…' : 'Run (Ctrl+Enter)'}</Btn>
          <Btn tone="grey" onClick={() => { if (confirm('Replace your code with the starter code?')) save(prog.starter) }}>Reset to starter</Btn>
          {last && <span className="text-xs text-lab-text-muted">Last run {last.utc.slice(11, 19)} UTC: {!last.ok ? <span className="text-lab-red">error</span> : last.matched ? <span className="text-lab-cdsco">matches the reference</span> : <span className="text-lab-amber">{last.diffs} differing values, {last.missingVars.length} missing variables, {last.missingRows} missing and {last.extraRows} extra records</span>}</span>}
          {!ready && <span className="text-xs text-lab-text-muted">Waiting for R…</span>}
        </div>
        <p className="text-[11px] text-lab-text-muted">Your program must create <code className="font-mono">{prog.output}</code>. Available: the SDTM datasets (dm, ae, ds, lb, ex, vs, cm, mh, …){prog.needs.length ? ` and the validated ${prog.needs.map((n) => programById.get(n)!.output).join(', ')}` : ''}. Base R only.</p>
      </Panel>
      <Tabs tabs={[{ id: 'spec', label: 'Specification' }, { id: 'console', label: 'Console' }, { id: 'compare', label: 'Compare with reference' }, { id: 'output', label: `Output (${r?.res.frame?.rows.length ?? 0})` }, ...(DISPLAYS[prog.id] || prog.kind === 'figure' ? [{ id: 'display' as const, label: prog.kind === 'figure' ? 'Figure' : 'Display' }] : [])]} value={tab} onChange={setTab} />
      {tab === 'spec' && <Panel title="Specification"><Table head={['Variable', 'Label', 'Derivation']} rows={prog.spec.map((s) => [<span className="font-mono">{s.name}</span>, s.label, s.derivation])} /><p className="text-xs text-lab-text-muted">Key for comparison: {prog.keys.join(', ')}.</p></Panel>}
      {tab === 'console' && <Console res={r?.res} />}
      {tab === 'compare' && <Compare cmp={r?.cmp} level={level} ok={r?.res.ok} />}
      {tab === 'output' && (r?.res.frame ? <FrameTable f={r.res.frame} /> : <Panel title="Output"><p className="text-sm text-lab-text-muted">Run the program.</p></Panel>)}
      {tab === 'display' && (prog.kind === 'figure' ? <Plots res={r?.res} /> : r?.res.frame ? <DisplayView d={DISPLAYS[prog.id](r.res.frame)} study={p!.study} /> : <Panel title="Display"><p className="text-sm text-lab-text-muted">Run the program: the display is drawn from your analysis results data.</p></Panel>)}
    </div>
  )
}

function Console({ res }: { res?: RunResult }) {
  return (
    <Panel title="Console" sub={res ? `${res.ms} ms` : undefined}>
      <pre className="text-xs font-mono whitespace-pre-wrap bg-white text-slate-900 rounded p-2 max-h-96 overflow-auto">{res ? (res.output.map((o) => (o.type === 'stderr' || o.type === 'message' || o.type === 'warning' || o.type === 'error' ? `› ${o.text}` : o.text)).join('\n') || '(no output)') + (res.error ? `\n\nError: ${res.error}` : '') : 'Run the program.'}</pre>
      {res && res.images.length > 0 && <Plots res={res} />}
    </Panel>
  )
}

function Plots({ res }: { res?: RunResult }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = ''
    for (const img of (res?.images ?? []) as ImageBitmap[]) {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.className = 'max-w-full bg-white rounded'
      c.getContext('2d')!.drawImage(img, 0, 0); c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Plot drawn by your R program')
      ref.current.appendChild(c)
    }
  }, [res])
  return <Panel title="Figure">{res?.images.length ? null : <p className="text-sm text-lab-text-muted">No plot yet: run a program that draws one.</p>}<div ref={ref} className="space-y-2" /></Panel>
}

function Compare({ cmp, level, ok }: { cmp?: Comparison; level: string; ok?: boolean }) {
  if (!cmp) return <Panel title="Compare with reference"><p className="text-sm text-lab-text-muted">{ok === false ? 'The program stopped with an error: see the console.' : 'Run the program to compare its output with the independent reference.'}</p></Panel>
  const showRows = level !== 'expert'
  return (
    <Panel title={cmp.ok ? 'Matches the reference' : 'Differences from the reference'} sub="Records are matched by key; numbers within a relative tolerance of 1e-6. In double programming both outputs come from separate code written to the same specification.">
      <div className="flex flex-wrap gap-2">
        <Pill tone={cmp.ok ? 'green' : 'amber'}>{cmp.comparedRows} records compared</Pill>
        {cmp.missingVars.length > 0 && <Pill tone="red">Missing variables: {cmp.missingVars.join(', ')}</Pill>}
        {cmp.extraVars.length > 0 && <Pill>Extra variables (allowed): {cmp.extraVars.join(', ')}</Pill>}
        {cmp.missingRows.length > 0 && <Pill tone="red">{cmp.missingRows.length} records missing</Pill>}
        {cmp.extraRows.length > 0 && <Pill tone="red">{cmp.extraRows.length} extra records</Pill>}
        {cmp.duplicateKeys.length > 0 && <Pill tone="red">{cmp.duplicateKeys.length} duplicate keys</Pill>}
      </div>
      {Object.keys(cmp.byVariable).length > 0 && <Table head={['Variable', 'Values that differ']} rows={Object.entries(cmp.byVariable).map(([v, n]) => [<span className="font-mono">{v}</span>, n])} />}
      {showRows && cmp.diffs.length > 0 && <Table head={['Key', 'Variable', 'Yours', 'Reference']} rows={cmp.diffs.slice(0, 40).map((d) => [<span className="font-mono text-[11px]">{d.key}</span>, d.variable, d.got ?? 'NA', d.want ?? 'NA'])} />}
      {showRows && cmp.missingRows.length > 0 && <p className="text-xs text-lab-text-muted">Missing: {cmp.missingRows.slice(0, 10).join('; ')}{cmp.missingRows.length > 10 ? ' …' : ''}</p>}
      {showRows && cmp.extraRows.length > 0 && <p className="text-xs text-lab-text-muted">Extra: {cmp.extraRows.slice(0, 10).join('; ')}{cmp.extraRows.length > 10 ? ' …' : ''}</p>}
      {!showRows && !cmp.ok && <p className="text-xs text-lab-text-muted">Expert level: the counts above, not the values. Find the cause from the specification.</p>}
    </Panel>
  )
}

export function FrameTable({ f, max = 100 }: { f: Frame; max?: number }) {
  return (
    <Panel title={`${f.rows.length} records, ${f.columns.length} variables`} sub={f.rows.length > max ? `First ${max} shown.` : undefined}>
      <div className="overflow-x-auto"><Table head={f.columns} rows={f.rows.slice(0, max).map((r) => r.map((c) => (c === null ? <span className="text-lab-text-muted">NA</span> : c)))} /></div>
    </Panel>
  )
}

function DisplayView({ d, study }: { d: Display; study: string }) {
  return (
    <Panel title={d.title} sub={d.population} right={<Btn tone="grey" onClick={() => download(`${d.title.split(' ').slice(0, 2).join('-')}.html`, displayHtml(d, study), 'text/html')}>Download (HTML)</Btn>}>
      <div className="overflow-x-auto bg-white text-slate-900 rounded p-3">
        <table className="w-full text-xs font-mono">
          <thead><tr className="border-y border-slate-800"><th className="text-left p-1" />{d.head.map((x) => <th key={x} className="p-1">{x}</th>)}</tr></thead>
          <tbody>{d.rows.map((r, i) => <tr key={i}><td className={`p-1 ${r.indent ? 'pl-6' : ''}`}>{r.label}</td>{r.cells.map((c, j) => <td key={j} className="p-1 text-center">{c}</td>)}</tr>)}</tbody>
        </table>
        {d.footnotes.map((x) => <p key={x} className="text-[11px] mt-1">{x}</p>)}
      </div>
      <p className="text-xs text-lab-text-muted">Drawn from your analysis results data: every number traces to a row of {'ard'} you computed, rounded only here.</p>
    </Panel>
  )
}
