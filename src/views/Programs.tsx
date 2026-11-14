import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { packOf, type Program } from '../domain/rcode'
import type { Comparison } from '../domain/compare'
import { displayHtml, displayRtf, type Display } from '../domain/display'
import { done, trackOf, MISSIONS } from '../domain/lab'
import type { Frame, RunResult } from '../domain/runner'
import { referenceFrames } from '../rclient'
import { lastResults, runOne } from '../session'
import { headerTemplate, scanLog } from '../domain/logscan'
import { TRACERS } from '../domain/trace'
import { download } from '../domain/store'
import Editor from './Editor'
import Trace from './Trace'
import { Btn, Panel, Pill, Table, Tabs } from './ui'

const AREAS = ['ADaM', 'Safety', 'Efficacy', 'Listings', 'Figures'] as const
export const missionPrograms = (m: string) => MISSIONS.find((x) => x.id === m)?.programs ?? []

export default function Programs({ ready }: { ready: boolean }) {
  const { p } = useStore()
  const { arg, go } = useNav()
  const pack = packOf(p!.study)
  const ids = new Map(pack.programs.map((x) => [x.id, x]))
  const focus = p!.mission ? missionPrograms(p!.mission.id) : []
  const id = arg && ids.has(arg) ? arg : focus[0] ?? pack.programs[0].id
  return (
    <div className="grid lg:grid-cols-[15rem_1fr] gap-4">
      <Panel title="Programs" sub={`${pack.id} · ${pack.sap}`}>
        {AREAS.map((a) => { const list = pack.programs.filter((x) => x.area === a); return list.length ? (
          <div key={a}>
            <p className="text-[10px] uppercase tracking-wide text-lab-text-muted mt-1">{a === 'ADaM' ? 'Analysis datasets' : a}</p>
            <ul className="space-y-0.5">
              {list.map((x) => {
                const st = done(p!, x.id) ? 'done' : p!.runs[x.id] ? (p!.runs[x.id].ok ? 'differs' : 'error') : 'todo'
                return (
                  <li key={x.id}><button onClick={() => go('programs', x.id)} aria-current={id === x.id ? 'true' : undefined} className={`w-full text-left px-2 py-1 rounded text-xs ${id === x.id ? 'bg-lab-fda-soft text-lab-fda' : 'hover:bg-lab-panel-strong'} ${focus.length && !focus.includes(x.id) ? 'opacity-60' : ''}`}>
                    <span className="font-mono">{x.id}</span> <span className="text-lab-text-muted">{x.title.split(':')[0].replace(/^(Table|Listing|Figure) /, '')}</span>
                    <span className="float-right" aria-label={st}>{st === 'done' ? '✓' : st === 'differs' ? '≠' : st === 'error' ? '!' : ''}</span>
                  </button></li>
                )
              })}
            </ul>
          </div>) : null })}
        <p className="text-[11px] text-lab-text-muted mt-2">✓ matches the reference · ≠ differs · ! error. Each program reads the SDTM datasets and the validated upstream analysis datasets.</p>
      </Panel>
      <Workspace key={id} prog={ids.get(id)!} ready={ready} />
    </div>
  )
}

function Workspace({ prog, ready }: { prog: Program; ready: boolean }) {
  const { p, act } = useStore()
  const pack = packOf(p!.study)
  const [code, setCode] = useState(p!.code[prog.id] ?? prog.starter)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'spec' | 'shell' | 'console' | 'compare' | 'output' | 'display'>('spec')
  const [, force] = useState(0)
  const r = lastResults.get(prog.id)
  const level = p!.mission?.level ?? 'guided'
  const save = (v: string) => { setCode(v); act((x) => { x.code[prog.id] = v }) }
  const exec = async () => {
    if (!ready || busy) return
    setBusy(true)
    try { const { res } = await runOne(p!, act, prog.id); setTab(!res.ok ? 'console' : 'compare') } finally { setBusy(false); force((n) => n + 1) }
  }
  const last = p!.runs[prog.id]
  const refDisplay = pack.displays[prog.id] && referenceFrames()[prog.id] ? pack.displays[prog.id](referenceFrames()[prog.id]) : null
  const inputs = [...new Set([...prog.needs.map((n) => pack.programs.find((q) => q.id === n)!.output), ...(prog.reference.match(/\b(dm|ae|ds|lb|ex|vs|cm|mh|qs|sv)\$/g) ?? []).map((s) => s.slice(0, -1))])]
  const log = r ? scanLog({ ok: r.res.ok, error: r.res.error, output: r.res.output, rows: r.res.frame?.rows.length }, code) : []
  return (
    <div className="space-y-3 min-w-0">
      <Panel title={prog.title} sub={prog.intro} right={<span className="flex gap-1"><Pill>{prog.ref}</Pill><Pill tone={trackOf(p!, prog.id).status === 'Validated' ? 'green' : 'grey'}>{trackOf(p!, prog.id).status}</Pill></span>}>
        <Editor value={code} onChange={save} onRun={exec} label={`R program ${prog.id}`} />
        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="solid" disabled={!ready || busy} onClick={exec}>{busy ? 'Running…' : 'Run (Ctrl+Enter)'}</Btn>
          <Btn tone="grey" onClick={() => { if (confirm('Replace your code with the starter code?')) save(prog.starter) }}>Reset to starter</Btn>
          {!/^#\s*Program\s*:/m.test(code) && <Btn tone="grey" onClick={() => save(headerTemplate(`${prog.id.toLowerCase()}.R`, prog.title, inputs, prog.output) + '\n' + code)}>Insert program header</Btn>}
          {last && <span className="text-xs text-lab-text-muted">Last run {last.utc.slice(11, 19)} UTC: {!last.ok ? <span className="text-lab-red">error</span> : last.matched ? <span className="text-lab-cdsco">matches the reference</span> : <span className="text-lab-amber">{last.diffs} differing values, {last.missingVars.length} missing variables, {last.missingRows} missing and {last.extraRows} extra records</span>}</span>}
          {!ready && <span className="text-xs text-lab-text-muted">Waiting for R…</span>}
        </div>
        <p className="text-[11px] text-lab-text-muted">Your program must create <code className="font-mono">{prog.output}</code>. Available: the SDTM datasets{prog.needs.length ? ` and the validated ${prog.needs.map((n) => pack.programs.find((q) => q.id === n)!.output).join(', ')}` : ''}; base R and the lab library (lab_mmrm, lab_estimate, lab_cox){p!.packages.length ? `; installed packages: ${p!.packages.join(', ')}` : ''}.</p>
      </Panel>
      <Tabs tabs={[{ id: 'spec', label: 'Specification' }, ...(refDisplay ? [{ id: 'shell' as const, label: 'Mock shell' }] : []), { id: 'console', label: `Console${log.some((l) => l.level !== 'NOTE') ? ' ⚠' : ''}` }, { id: 'compare', label: 'Compare with reference' }, { id: 'output', label: `Output (${r?.res.frame?.rows.length ?? 0})` }, ...(pack.displays[prog.id] || prog.kind === 'figure' ? [{ id: 'display' as const, label: prog.kind === 'figure' ? 'Figure' : 'Display' }] : [])]} value={tab} onChange={setTab} />
      {tab === 'spec' && <Panel title="Specification"><Table head={['Variable', 'Label', 'Derivation']} rows={prog.spec.map((s) => [<span className="font-mono">{s.name}</span>, s.label, s.derivation])} /><p className="text-xs text-lab-text-muted">Key for comparison: {prog.keys.join(', ')}.</p></Panel>}
      {tab === 'shell' && refDisplay && <Shell d={refDisplay} note={prog.shell} />}
      {tab === 'console' && <Console res={r?.res} log={log} />}
      {tab === 'compare' && <Compare cmp={r?.cmp} level={level} ok={r?.res.ok} />}
      {tab === 'output' && (r?.res.frame ? <FrameTable f={r.res.frame} /> : <Panel title="Output"><p className="text-sm text-lab-text-muted">Run the program.</p></Panel>)}
      {tab === 'display' && (prog.kind === 'figure' ? <Plots res={r?.res} /> : r?.res.frame ? <DisplayView id={prog.id} d={pack.displays[prog.id](r.res.frame)} study={p!.study} shell={refDisplay} /> : <Panel title="Display"><p className="text-sm text-lab-text-muted">Run the program: the display is drawn from your analysis results data.</p></Panel>)}
    </div>
  )
}

// The mock shell: the display's layout from the SAP with numbers replaced by placeholders.
const headShell = (t: string) => t.replace(/([Nn]=)\d+/g, '$1xx')
export const shellText = (t: string) => t.replace(/<0\.001/g, 'x.xxx').replace(/\d+\.\d+/g, (m) => `x${'.'}${'x'.repeat(m.split('.')[1].length)}`).replace(/\b\d+\b/g, 'xx')
function Shell({ d, note }: { d: Display; note?: string }) {
  return (
    <Panel title="Mock shell" sub="The layout agreed in the SAP's table shells, before any data are seen. Program to this: the same rows, columns, statistics and decimal places.">
      <div className="overflow-x-auto bg-white text-slate-900 rounded p-3">
        <p className="text-xs font-mono font-bold">{d.title}</p><p className="text-[11px] font-mono">{d.population}</p>
        <table className="w-full text-xs font-mono mt-1"><thead><tr className="border-y border-slate-800"><th className="text-left p-1" />{d.head.map((x) => <th key={x} className="p-1">{headShell(x)}</th>)}</tr></thead>
          <tbody>{d.rows.map((r, i) => <tr key={i}><td className={`p-1 ${r.indent ? 'pl-6' : ''}`}>{r.label}</td>{r.cells.map((c, j) => <td key={j} className="p-1 text-center">{shellText(c.text)}</td>)}</tr>)}</tbody></table>
        {d.footnotes.map((x) => <p key={x} className="text-[11px] mt-1">{x}</p>)}
      </div>
      {note && <p className="text-xs text-lab-text-muted">SAP shell note: {note}</p>}
    </Panel>
  )
}

function Console({ res, log }: { res?: RunResult; log: { level: string; text: string }[] }) {
  return (
    <Panel title="Console and log" sub={res ? `${res.ms} ms` : undefined}>
      {log.length > 0 && <ul className="text-xs space-y-0.5">{log.map((l, i) => <li key={i}><Pill tone={l.level === 'ERROR' ? 'red' : l.level === 'WARNING' ? 'amber' : 'grey'}>{l.level}</Pill> {l.text}</li>)}</ul>}
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

export function FrameTable({ f, max = 100, title }: { f: Frame; max?: number; title?: string }) {
  return (
    <Panel title={title ?? `${f.rows.length} records, ${f.columns.length} variables`} sub={f.rows.length > max ? `First ${max} shown.` : undefined}>
      <div className="overflow-x-auto"><Table head={f.columns} rows={f.rows.slice(0, max).map((r) => r.map((c) => (c === null ? <span className="text-lab-text-muted">NA</span> : c)))} /></div>
    </Panel>
  )
}

// Labels and headers of the display against the mock shell (ignoring the numbers).
function shellCheck(d: Display, shell: Display | null) {
  if (!shell) return null
  const lab = (x: Display) => x.rows.map((r) => r.label)
  const missing = lab(shell).filter((l) => !lab(d).includes(l)), extra = lab(d).filter((l) => !lab(shell).includes(l))
  const heads = shell.head.map(headShell).join('|') === d.head.map(headShell).join('|')
  return { ok: !missing.length && !extra.length && heads, missing, extra, heads }
}
function DisplayView({ id, d, study, shell }: { id: string; d: Display; study: string; shell: Display | null }) {
  const [sel, setSel] = useState<{ an: string; g: string; cat: string | null; label: string } | null>(null)
  const chk = shellCheck(d, shell)
  const tracer = !!TRACERS[study]?.[id]
  const file = d.title.split(' ').slice(0, 2).join('-')
  return (
    <div className="space-y-3">
      <Panel title={d.title} sub={d.population} right={<span className="flex gap-1"><Btn tone="grey" onClick={() => download(`${file}.rtf`, displayRtf(d, study), 'application/rtf')}>RTF</Btn><Btn tone="grey" onClick={() => download(`${file}.html`, displayHtml(d, study), 'text/html')}>HTML</Btn></span>}>
        {chk && <p className={`text-xs ${chk.ok ? 'text-lab-cdsco' : 'text-lab-amber'}`}>{chk.ok ? 'Layout matches the mock shell.' : `Layout differs from the mock shell${chk.missing.length ? `: rows missing (${chk.missing.slice(0, 4).join('; ')})` : ''}${chk.extra.length ? `; rows not in the shell (${chk.extra.slice(0, 4).join('; ')})` : ''}${chk.heads ? '' : '; column headers differ'}.`}</p>}
        <div className="overflow-x-auto bg-white text-slate-900 rounded p-3">
          <table className="w-full text-xs font-mono">
            <thead><tr className="border-y border-slate-800"><th className="text-left p-1" />{d.head.map((x) => <th key={x} className="p-1">{x}</th>)}</tr></thead>
            <tbody>{d.rows.map((r, i) => <tr key={i}><td className={`p-1 ${r.indent ? 'pl-6' : ''}`}>{r.label}</td>{r.cells.map((c, j) => <td key={j} className="p-1 text-center">{c.keys && c.text && tracer ? <button className="underline decoration-dotted hover:bg-sky-100 rounded px-0.5" title="Trace this number" onClick={() => setSel({ ...c.keys![0], label: `${r.label} · ${d.groups[j] ?? ''}: ${c.text}` })}>{c.text}</button> : c.text}</td>)}</tr>)}</tbody>
          </table>
          {d.footnotes.map((x) => <p key={x} className="text-[11px] mt-1">{x}</p>)}
        </div>
        <p className="text-xs text-lab-text-muted">Drawn from your analysis results data, rounded only here.{tracer ? ' Click a number to trace it back to the analysis records and SDTM.' : ''}</p>
      </Panel>
      {sel && tracer && <Trace id={id} sel={sel} onClose={() => setSel(null)} />}
    </div>
  )
}
