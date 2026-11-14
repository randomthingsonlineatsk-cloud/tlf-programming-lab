import { useEffect, useState } from 'react'
import { useStore } from '../state'
import { TRACERS } from '../domain/trace'
import { referenceFrames, trace } from '../rclient'
import type { Frame } from '../domain/runner'
import { FrameTable } from './Programs'
import { Btn, Panel, Table } from './ui'

// Trace a number: display cell → analysis results rows → analysis records → SDTM records.
export default function Trace({ id, sel, onClose }: { id: string; sel: { an: string; g: string; cat: string | null; label: string }; onClose: () => void }) {
  const { p } = useStore()
  const spec = TRACERS[p!.study]?.[id]?.(sel.an, sel.g, sel.cat)
  const [res, setRes] = useState<{ adam: Frame; sdtm?: Frame } | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { setRes(null); setErr(''); if (spec) trace(spec.adam, spec.sdtm).then(setRes).catch((e) => setErr((e as Error).message)) }, [id, sel.an, sel.g, sel.cat]) // eslint-disable-line react-hooks/exhaustive-deps
  const ref = referenceFrames()[id]
  const ix = (n: string) => ref?.columns.indexOf(n) ?? -1
  const ard = ref ? ref.rows.filter((r) => r[ix('ANALYSIS')] === sel.an && r[ix('GROUP')] === sel.g && (r[ix('CATEGORY')] ?? null) === sel.cat) : []
  return (
    <Panel title={`Trace: ${sel.label}`} sub="From the cell to the analysis results, the analysis records and the SDTM records behind them (validated datasets)." right={<Btn tone="grey" onClick={onClose}>Close</Btn>}>
      <ol className="text-xs space-y-1 list-decimal pl-5">
        <li>Analysis results rows (ANALYSIS {sel.an}, GROUP {sel.g}{sel.cat ? `, CATEGORY ${sel.cat}` : ''}):</li>
      </ol>
      <Table head={['ANALYSIS', 'GROUP', 'CATEGORY', 'STAT', 'VALUE']} rows={ard.map((r) => r.map((c) => c ?? 'NA'))} />
      {spec && <p className="text-xs text-lab-text-muted">2. Selection on the analysis data: <code className="font-mono">{spec.adam}</code>{spec.note ? ` ${spec.note}` : ''}</p>}
      {err && <p className="text-xs text-lab-red">{err}</p>}
      {res && <FrameTable f={res.adam} max={50} title={`Analysis records: ${res.adam.rows.length}${res.adam.columns.includes('USUBJID') ? `, ${new Set(res.adam.rows.map((r) => r[res.adam.columns.indexOf('USUBJID')])).size} participants` : ''}`} />}
      {res?.sdtm && <FrameTable f={res.sdtm} max={50} title={`3. SDTM ${spec!.sdtm!.domain.toUpperCase()} records behind them: ${res.sdtm.rows.length}`} />}
    </Panel>
  )
}
