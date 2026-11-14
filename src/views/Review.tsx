import { useState } from 'react'
import { useStore } from '../state'
import { REVIEW_PROGRAM, REVIEW_KEY, REVIEW_CATEGORIES, type ReviewCategory } from '../domain/review'
import { Panel, Pill, Btn } from './ui'

export default function Review(_: { ready: boolean }) {
  const { p, act } = useStore()
  const [line, setLine] = useState<number | null>(null)
  const marks = p!.review.marks
  const ended = !!p!.mission?.endedUtc || !!p!.review.submittedUtc
  const key = (n: number) => REVIEW_KEY.find((k) => k.line === n)
  return (
    <div className="space-y-4">
      <Panel title="Code review: the production ADAE program" sub="Read before you run. Click a line to mark it and choose the kind of problem; click a marked line again to change or clear it. When you are done, close the review: the answers are shown and the marks are locked.">
        <div className="bg-white text-slate-900 rounded p-2 overflow-x-auto">
          <ol className="text-xs font-mono">{REVIEW_PROGRAM.map((l, i) => { const n = i + 1, m = marks[n], k = key(n); return (
            <li key={n} className={`flex gap-2 rounded ${m ? 'bg-amber-100' : ''} ${ended && k ? 'outline outline-1 outline-emerald-600' : ''}`}>
              <button disabled={ended} onClick={() => setLine(line === n ? null : n)} className="w-8 text-right text-slate-500 hover:text-slate-900" aria-label={`Line ${n}`}>{n}</button>
              <span className="whitespace-pre">{l || ' '}</span>
              {m && <span className="ml-auto pl-2 text-[10px] text-amber-800 whitespace-nowrap">{REVIEW_CATEGORIES.find((c) => c.id === m)!.label}</span>}
            </li>) })}</ol>
        </div>
        {line !== null && !ended && (
          <div className="flex flex-wrap gap-1 items-center text-xs"><span>Line {line}:</span>
            {REVIEW_CATEGORIES.map((c) => <Btn key={c.id} className="py-0.5" tone={marks[line] === c.id ? 'solid' : 'grey'} onClick={() => { act((x) => { x.review.marks[line] = c.id as ReviewCategory }); setLine(null) }}>{c.label}</Btn>)}
            {marks[line] && <Btn className="py-0.5" tone="red" onClick={() => { act((x) => { delete x.review.marks[line] }); setLine(null) }}>Clear</Btn>}
          </div>
        )}
        {!ended && <Btn tone="solid" onClick={() => { if (confirm('Close the review? Your marks are locked and the answers shown.')) act((x) => { x.review.submittedUtc = new Date().toISOString() }) }}>Close the review</Btn>}
      </Panel>
      {ended && (
        <Panel title="Review answers">
          <ul className="space-y-2 text-sm">{REVIEW_KEY.map((k) => (
            <li key={k.line}><Pill tone={marks[k.line] === k.cat ? 'green' : marks[k.line] ? 'amber' : 'red'}>Line {k.line}</Pill> <b>{REVIEW_CATEGORIES.find((c) => c.id === k.cat)!.label}.</b> {k.why}</li>))}
            {Object.keys(marks).map(Number).filter((n) => !key(n)).map((n) => <li key={n}><Pill tone="red">Line {n}</Pill> Marked, but the line is correct.</li>)}
          </ul>
        </Panel>
      )}
    </div>
  )
}
