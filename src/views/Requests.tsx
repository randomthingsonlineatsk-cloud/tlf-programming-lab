import { useEffect, useState } from 'react'
import { useStore } from '../state'
import { IRS, irStarter, sameAnswer, type InfoRequest, type IrAnswer } from '../domain/ir'
import { answer } from '../rclient'
import Editor from './Editor'
import { Btn, Panel, Pill, TextArea } from './ui'

const mins = (a: string, b = new Date().toISOString()) => (Date.parse(b) - Date.parse(a)) / 60000

export default function Requests({ ready }: { ready: boolean }) {
  const { p } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <Panel title="Information requests from the review division" sub="Fictional requests about the GLV-12-301 analyses, of the kind reviewers send during an application review. Each asks for numbers or participants; answer in R from the validated analysis datasets, then write the text that goes back with the answer. The response clock starts when you open a request.">
        <ul className="space-y-1">{IRS.map((r) => { const a = p!.ir[r.id]; return (
          <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono">{r.id}</span><span>{r.subject}</span><Pill>{r.dueMinutes} min</Pill>
            {a?.correct ? <Pill tone={a.onTime ? 'green' : 'amber'}>answered{a.onTime ? '' : ', late'}</Pill> : a?.openedUtc ? <Pill tone="blue">open</Pill> : null}
            <Btn className="py-0.5" tone={open === r.id ? 'solid' : 'grey'} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Close' : 'Open'}</Btn>
          </li>) })}</ul>
      </Panel>
      {open && <Request key={open} r={IRS.find((x) => x.id === open)!} ready={ready} />}
    </div>
  )
}

function Request({ r, ready }: { r: InfoRequest; ready: boolean }) {
  const { p, act } = useStore()
  const a = p!.ir[r.id]
  const [, tick] = useState(0)
  const [out, setOut] = useState<{ text: string; values?: string[]; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (!a?.openedUtc) act((x) => { const cur = x.ir[r.id] as IrAnswer | undefined; x.ir[r.id] = { code: cur?.code ?? irStarter(r), letter: cur?.letter ?? '', ...cur, openedUtc: new Date().toISOString() } }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t) }, [])
  const code = a?.code ?? irStarter(r)
  const left = a?.openedUtc ? r.dueMinutes - mins(a.openedUtc, a.correct ? a.answeredUtc : undefined) : r.dueMinutes
  const runIt = async () => {
    setBusy(true)
    try { const res = await answer(code); setOut({ text: res.output.map((o) => o.text).join('\n'), values: res.values, error: res.error }) } finally { setBusy(false) }
  }
  const submit = async () => {
    setBusy(true)
    try {
      const mine = await answer(code), want = await answer(r.reference)
      if (!mine.ok) { setOut({ text: '', error: mine.error }); return }
      const ok = !!want.values && !!mine.values && sameAnswer(r.kind, mine.values, want.values)
      act((x) => { const now = new Date().toISOString(); const cur = x.ir[r.id]; x.ir[r.id] = { ...cur, values: mine.values, correct: ok, ...(ok ? { answeredUtc: now, onTime: mins(cur.openedUtc ?? now, now) <= r.dueMinutes } : {}) }; x.history.push({ utc: now, what: `${r.id} answer submitted: ${ok ? 'correct' : 'not correct'}` }) })
      setOut({ text: '', values: mine.values })
    } finally { setBusy(false) }
  }
  return (
    <Panel title={`${r.id}: ${r.subject}`} sub={r.question} right={a?.correct ? <Pill tone="green">correct</Pill> : <Pill tone={left < 0 ? 'red' : left < 5 ? 'amber' : 'grey'}>{left < 0 ? `${Math.round(-left)} min overdue` : `${Math.round(left)} min left`}</Pill>}>
      {p!.mission?.level === 'guided' && <p className="text-xs text-lab-text-muted">Hint: {r.hint}</p>}
      <Editor value={code} onChange={(v) => act((x) => { x.ir[r.id] = { ...x.ir[r.id], code: v } })} onRun={runIt} label={`R code for ${r.id}`} />
      <div className="flex flex-wrap gap-2">
        <Btn disabled={!ready || busy} onClick={runIt}>Run</Btn>
        <Btn tone="solid" disabled={!ready || busy || !!a?.correct} onClick={submit}>Submit the answer</Btn>
      </div>
      {out && <pre className="text-xs font-mono whitespace-pre-wrap bg-white text-slate-900 rounded p-2 max-h-60 overflow-auto">{out.error ? `Error: ${out.error}\n` : ''}{out.text}{out.values ? `\nanswer: ${out.values.join(', ')}` : ''}</pre>}
      {a?.values && !a.correct && <p className="text-xs text-lab-amber">Not the value the division expects. Check the population, the selection and the model.</p>}
      <label className="block text-sm">Response text<TextArea value={a?.letter ?? ''} onChange={(e) => act((x) => { x.ir[r.id] = { ...x.ir[r.id], letter: e.target.value } })} placeholder="What was done, on which population, with which result." /></label>
    </Panel>
  )
}
