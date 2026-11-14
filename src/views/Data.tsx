import { useEffect, useState } from 'react'
import { currentHandoff, currentPack, referenceFrames, sdtm } from '../rclient'
import type { Frame } from '../domain/runner'
import { FrameTable } from './Programs'
import { Panel, Pill, Table } from './ui'

// The data the programs read: the SDTM datasets from the hand-off, and the lab's validated ADaM
// datasets, which later programs receive so one wrong ADSL does not break every table.
export default function Data({ ready }: { ready: boolean }) {
  const h = currentHandoff()
  const [sel, setSel] = useState('sdtm:DM')
  const [sd, setSd] = useState<Frame | null>(null)
  useEffect(() => { setSd(null); const [k, n] = sel.split(':'); if (ready && k === 'sdtm') sdtm(n).then(setSd).catch(() => setSd(null)) }, [sel, ready])
  if (!ready || !h) return <Panel title="Data"><p className="text-sm text-lab-text-muted">Waiting for R to load the hand-off…</p></Panel>
  const refs = referenceFrames()
  const adam = (currentPack()?.programs ?? []).filter((p) => p.kind === 'dataset')
  const [kind, name] = sel.split(':')
  let f: Frame | undefined
  if (kind === 'sdtm') {
    f = sd ?? undefined
  } else f = refs[name]
  const meta = kind === 'sdtm' ? h.datasets.find((x) => x.name === name) : undefined
  return (
    <div className="grid lg:grid-cols-[15rem_1fr] gap-4">
      <Panel title="Datasets" sub={`${h.study.id} · ${Object.entries(h.standards ?? {}).map(([k, v]) => `${k} ${v}`).join(' · ')}`}>
        <p className="text-[11px] font-semibold text-lab-text-muted">SDTM (from the hand-off)</p>
        <ul className="space-y-0.5">{h.datasets.map((d) => <li key={d.name}><Item on={sel === `sdtm:${d.name}`} onClick={() => setSel(`sdtm:${d.name}`)} name={d.name} n={d.rows.length} hint={`R: ${d.name.toLowerCase()}`} /></li>)}</ul>
        <p className="text-[11px] font-semibold text-lab-text-muted mt-2">Validated ADaM (the reference)</p>
        <ul className="space-y-0.5">{adam.map((p) => <li key={p.id}><Item on={sel === `adam:${p.id}`} onClick={() => setSel(`adam:${p.id}`)} name={p.id} n={refs[p.id]?.rows.length ?? 0} hint={`R: ${p.output}`} /></li>)}</ul>
        {h.validation && <p className="text-[11px] text-lab-text-muted mt-2">Hand-off validation: {h.validation.mustFix} must-fix, {h.validation.open} open, {h.validation.explained} explained.</p>}
      </Panel>
      <div className="space-y-3 min-w-0">
        {meta && <Panel title={`${meta.name} · ${meta.label}`} sub="Variable metadata from Dataset-JSON v1.1."><Table head={['Variable', 'Label', 'Type']} rows={meta.columns.map((c) => [<span className="font-mono">{c.name}</span>, c.label ?? '', <Pill>{c.dataType}</Pill>])} /></Panel>}
        {kind === 'adam' && <Panel title={`${name}: the validated dataset`}><p className="text-xs text-lab-text-muted">Programs that need {name} get this copy, not yours, so a table can be checked on its own. In R it is available inside programs that list it as an input.</p></Panel>}
        {f ? <FrameTable f={f} /> : <Panel title="Data"><p className="text-sm">Not loaded.</p></Panel>}
      </div>
    </div>
  )
}
function Item({ on, onClick, name, n, hint }: { on: boolean; onClick: () => void; name: string; n: number; hint: string }) {
  return <button onClick={onClick} aria-current={on ? 'true' : undefined} title={hint} className={`w-full text-left px-2 py-1 rounded text-xs ${on ? 'bg-lab-fda-soft text-lab-fda' : 'hover:bg-lab-panel-strong'}`}><span className="font-mono">{name}</span><span className="float-right text-lab-text-muted">{n}</span></button>
}
