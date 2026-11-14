import { useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { PROD_T2, FINDINGS } from '../domain/qc'
import { compareFrames, type Comparison } from '../domain/compare'
import { done } from '../domain/lab'
import { production } from '../rclient'
import { lastFrame } from '../session'
import { Btn, Panel, Pill, Table } from './ui'

// Independent QC of Table 14.3.1: compare the learner's QC output (T2) with production's.
export default function Qc({ ready }: { ready: boolean }) {
  const { p, act } = useStore()
  const { go } = useNav()
  const [cmp, setCmp] = useState<Comparison | null>(null)
  const [msg, setMsg] = useState('')
  const mine = lastFrame('T2')
  const ok = done(p!, 'T2')
  const compare = async () => {
    setMsg('')
    try {
      const prod = await production(PROD_T2)
      if (!mine) throw new Error('Run your T2 program on the Programs page first (this session).')
      const c = compareFrames(prod, mine, ['ANALYSIS', 'GROUP', 'CATEGORY', 'STAT'])
      setCmp(c)
      act((x) => { x.qc.compared = true; x.history.push({ utc: new Date().toISOString(), what: `QC compare of T2 with production: ${c.diffs.length} differing values, ${c.missingRows.length} rows missing from production` }) })
    } catch (e) { setMsg((e as Error).message) }
  }
  const toggle = (id: string) => act((x) => { x.qc.findings = x.qc.findings.includes(id) ? x.qc.findings.filter((f) => f !== id) : [...x.qc.findings, id] })
  const ended = !!p!.mission?.endedUtc
  return (
    <div className="space-y-4">
      <Panel title="Independent QC: Table 14.3.1" sub="Production has delivered the adverse event table. As the QC programmer you write it yourself from the specification (program T2), compare the two outputs, and log every real discrepancy with its root cause before the table goes into the report.">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={ok ? 'green' : 'amber'}>Your T2 {ok ? 'matches the specification reference' : 'is not yet matching the reference'}</Pill>
          <Btn onClick={() => go('programs', 'T2')}>Open T2</Btn>
          <Btn tone="solid" disabled={!ready} onClick={compare}>Compare production with my QC output</Btn>
        </div>
        {msg && <p role="alert" className="text-xs text-lab-red">{msg}</p>}
        <p className="text-xs text-lab-text-muted">In practice the QC output is written blind: you do not see production's code until the comparison is done. A difference is a question, not yet a finding: find its root cause, then decide whose output is wrong.</p>
      </Panel>
      {cmp && (
        <Panel title={cmp.ok ? 'Production matches your QC output' : 'Production differs from your QC output'} sub="Production compared with your output as the base, by ANALYSIS, GROUP, CATEGORY and STAT.">
          <div className="flex flex-wrap gap-2">
            <Pill>{cmp.comparedRows} rows compared</Pill>
            <Pill tone={cmp.diffs.length ? 'red' : 'green'}>{cmp.diffs.length} values differ</Pill>
            <Pill tone={cmp.missingRows.length ? 'red' : 'green'}>{cmp.missingRows.length} rows only in your output</Pill>
            <Pill tone={cmp.extraRows.length ? 'red' : 'green'}>{cmp.extraRows.length} rows only in production</Pill>
          </div>
          <Table head={['Analysis (row type)', 'Values that differ']} rows={Object.entries(cmp.diffs.reduce((a, d) => { const k = d.key.split(' | ')[0]; a[k] = (a[k] ?? 0) + 1; return a }, {} as Record<string, number>)).map(([k, n]) => [k, n])} />
          <Table head={['Key', 'Production', 'Your QC']} rows={cmp.diffs.slice(0, 30).map((d) => [<span className="font-mono text-[11px]">{d.key}</span>, d.got ?? 'NA', d.want ?? 'NA'])} />
          {cmp.missingRows.length > 0 && <p className="text-xs">Rows only in your output: <span className="font-mono text-[11px]">{cmp.missingRows.slice(0, 8).join('; ')}{cmp.missingRows.length > 8 ? ' …' : ''}</span></p>}
        </Panel>
      )}
      <Panel title="QC log" sub="Tick each statement you are logging as a discrepancy. Log only what the comparison gives you evidence for.">
        <ul className="space-y-2">
          {FINDINGS.map((f) => (
            <li key={f.id} className="text-sm">
              <label className="flex gap-2 items-start"><input type="checkbox" disabled={ended} checked={p!.qc.findings.includes(f.id)} onChange={() => toggle(f.id)} className="mt-1" /><span><span className="font-mono text-xs">{f.id}</span> {f.text}</span></label>
              {ended && <p className={`ml-6 text-xs ${f.real ? 'text-lab-cdsco' : 'text-lab-text-muted'}`}>{f.real ? 'Real discrepancy.' : 'Not a discrepancy.'} {f.why}</p>}
            </li>
          ))}
        </ul>
        {!ended && <p className="text-[11px] text-lab-text-muted">The answers are shown after you submit a mission that grades this log (M4).</p>}
      </Panel>
      {p!.qc.compared && (
        <Panel title="Production's program" sub="Shown after the comparison, for the root-cause analysis.">
          <pre className="text-xs font-mono whitespace-pre-wrap bg-white text-slate-900 rounded p-2">{PROD_T2.trim()}</pre>
        </Panel>
      )}
    </div>
  )
}
