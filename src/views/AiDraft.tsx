import { useState } from 'react'
import { useStore } from '../state'
import { packOf } from '../domain/rcode'
import { AI_DRAFT, AI_ISSUES, AI_MODEL_CARD, AI_RECORD_FIELDS } from '../domain/aiwork'
import { compareFrames } from '../domain/compare'
import { run, referenceFrames } from '../rclient'
import Editor from './Editor'
import { Btn, Panel, Pill, Table, TextArea } from './ui'

export default function AiDraft({ ready }: { ready: boolean }) {
  const { p, act } = useStore()
  const prog = packOf(p!.study).programs.find((x) => x.id === 'T2')!
  const code = p!.ai.code || AI_DRAFT
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<{ ok: boolean; error?: string; diffs?: number; missing?: number; extra?: number; by?: Record<string, number> } | null>(null)
  const ended = !!p!.mission?.endedUtc
  const exec = async () => {
    setBusy(true)
    try {
      const r = await run(prog, code)
      if (!r.ok || !r.frame) { setRes({ ok: false, error: r.error }); act((x) => { x.ai.matched = false }); return }
      const c = compareFrames(r.frame, referenceFrames().T2, prog.keys)
      setRes({ ok: true, diffs: c.diffs.length, missing: c.missingRows.length, extra: c.extraRows.length, by: Object.fromEntries(Object.entries(c.diffs.reduce((m, d) => { const k = d.key.split(' | ')[0]; m[k] = (m[k] ?? 0) + 1; return m }, {} as Record<string, number>))) })
      act((x) => { x.ai.matched = c.ok; x.history.push({ utc: new Date().toISOString(), what: `AI draft run: ${c.ok ? 'matches the reference' : `${c.diffs.length} values differ`}` }) })
    } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <Panel title="A program drafted by an AI assistant" sub="Table 14.3.1, drafted from the specification by a (simulated) coding assistant. You are the qualified programmer: the draft is yours to verify, correct and answer for.">
        <div className="rounded border border-lab-line p-2 text-xs space-y-1">
          <p className="font-semibold">Model card: {AI_MODEL_CARD.name}</p>
          <p><b>Context of use.</b> {AI_MODEL_CARD.contextOfUse}</p>
          <p><b>Known limits.</b> {AI_MODEL_CARD.limits.join(' ')}</p>
          <p><b>Risk.</b> {AI_MODEL_CARD.risk}</p>
          <p className="text-lab-text-muted">The structure follows the credibility framework of the FDA draft guidance on using AI to support regulatory decision-making (January 2025) and the EMA–FDA good AI practice principles (January 2026): define the question and context of use, assess the model's risk, and verify its output in proportion.</p>
        </div>
      </Panel>
      <Panel title="The draft" right={p!.ai.matched ? <Pill tone="green">matches the reference</Pill> : null}>
        <Editor value={code} onChange={(v) => act((x) => { x.ai.code = v })} onRun={exec} label="AI-drafted R program for Table 14.3.1" />
        <div className="flex flex-wrap gap-2"><Btn tone="solid" disabled={!ready || busy} onClick={exec}>{busy ? 'Running…' : 'Run and compare'}</Btn><Btn tone="grey" onClick={() => { if (confirm('Restore the original draft?')) act((x) => { x.ai.code = AI_DRAFT; x.ai.matched = false }) }}>Restore the draft</Btn></div>
        {res && (res.ok ? <p className="text-xs">{res.diffs === 0 && !res.missing && !res.extra ? <span className="text-lab-cdsco">Matches the independent reference.</span> : <>Differs from the reference: {res.diffs} values ({Object.entries(res.by ?? {}).map(([k, n]) => `${k} ${n}`).join(', ')}), {res.missing} rows missing, {res.extra} extra.</>}</p> : <p className="text-xs text-lab-red">Error: {res.error}</p>)}
      </Panel>
      <Panel title="Defect log" sub="Tick each statement you log as a defect in the draft. Only what the comparison or the specification gives you evidence for.">
        <ul className="space-y-2">{AI_ISSUES.map((i) => (
          <li key={i.id} className="text-sm"><label className="flex gap-2 items-start"><input type="checkbox" disabled={ended} className="mt-1" checked={p!.ai.issues.includes(i.id)} onChange={() => act((x) => { x.ai.issues = x.ai.issues.includes(i.id) ? x.ai.issues.filter((k) => k !== i.id) : [...x.ai.issues, i.id] })} /><span><span className="font-mono text-xs">{i.id}</span> {i.text}</span></label>
            {ended && <p className={`ml-6 text-xs ${i.real ? 'text-lab-cdsco' : 'text-lab-text-muted'}`}>{i.real ? 'Real defect.' : 'Not a defect.'} {i.why}</p>}</li>))}</ul>
      </Panel>
      <Panel title="AI use record" sub="What goes in the programming file (and, where AI affects submitted results, the reviewer's guide): how the tool was used and how its output was checked.">
        {AI_RECORD_FIELDS.map((f) => <label key={f.id} className="block text-sm">{f.label}<TextArea value={p!.ai.record[f.id] ?? ''} onChange={(e) => act((x) => { x.ai.record[f.id] = e.target.value })} /></label>)}
      </Panel>
      {ended && <Panel title="Answers"><Table head={['Defect', 'Real?', 'Why']} rows={AI_ISSUES.map((i) => [i.id, i.real ? 'yes' : 'no', i.why])} /></Panel>}
    </div>
  )
}
