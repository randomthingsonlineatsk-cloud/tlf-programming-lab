import { useState } from 'react'
import { useStore } from '../state'
import { useNav } from '../App'
import { MISSIONS, grade, startMission, submitMission, certificate, CERT_NEEDED, type Level } from '../domain/lab'
import { passportRecord, getLearner, setLearnerName, PASSPORT_PAGE, APP_ID, APP_URL } from '../domain/passport'
import { download } from '../domain/store'
import { Btn, Panel, Pill } from './ui'

const LEVELS: Record<Level, string> = {
  guided: 'Guided: the comparison shows every differing value, hints are shown and progress is visible.',
  standard: 'Standard: the comparison shows the differing values; no hints.',
  expert: 'Expert: the comparison shows counts by variable only, no values, no hints and no running score.',
}

export default function Missions() {
  const { p, projects, open, act } = useStore()
  const { go } = useNav()
  const [level, setLevel] = useState<Level>('standard')
  const g = p?.mission ? grade(p) : null
  const learner = getLearner()
  const [name, setName] = useState(learner.name)
  const all = [...projects.filter((x) => x.id !== p?.id), ...(p ? [p] : [])]
  const c = certificate(all, learner.userId, name || 'Learner')
  return (
    <div className="space-y-4">
      {p?.mission && g && (
        <Panel title={`Open mission: ${g.mission.id} · ${g.mission.title}`} sub={g.mission.brief} right={p.mission.endedUtc ? <Pill tone={g.passed ? 'green' : 'red'}>{p.mission.score}%</Pill> : <Pill tone="blue">{p.mission.level}</Pill>}>
          <ul className="space-y-1 text-sm">{g.results.map((r) => (
            <li key={r.id} className="flex gap-2"><span aria-hidden>{p.mission!.endedUtc || p.mission!.level !== 'expert' ? (r.ok ? '✓' : '○') : '·'}</span><span>{r.text} <span className="text-lab-text-muted text-xs">({r.weight} points)</span>{p.mission!.level === 'guided' && !r.ok && !p.mission!.endedUtc && <span className="block text-xs text-lab-text-muted">Hint: {r.hint}</span>}</span></li>
          ))}</ul>
          <div className="flex flex-wrap gap-2">
            {g.mission.programs.map((id) => <Btn key={id} onClick={() => go('programs', id)}>Open {id}</Btn>)}
            {g.mission.id === 'M4' && <Btn onClick={() => go('qc')}>Independent QC</Btn>}
            {g.mission.id === 'M5' && <Btn onClick={() => go('metadata')}>Results metadata</Btn>}
            {!p.mission.endedUtc && <Btn tone="solid" onClick={() => { if (confirm('Submit the mission? The score is final for this project.')) act((x) => { submitMission(x) }) }}>Submit and score</Btn>}
          </div>
          <p className="text-xs text-lab-text-muted">{p.mission.endedUtc ? `Submitted ${p.mission.endedUtc.slice(0, 16).replace('T', ' ')} UTC. ${g.passed ? 'Passed.' : 'Not passed: start the mission again in a new project.'}` : `Pass mark 80%. A program that does not yet match earns half its points times the share of reference values it reproduces. ${p.mission.level === 'expert' ? '' : `Now: ${g.score}%.`}`}</p>
        </Panel>
      )}
      <Panel title="Missions" sub="Each mission opens a new project on the shipped GLV-12-301 hand-off. Programs are graded by comparison with independent reference programs run on the same data.">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Level">
          <span className="text-xs text-lab-text-muted">Level</span>
          {(Object.keys(LEVELS) as Level[]).map((l) => <Btn key={l} className="py-0.5" tone={level === l ? 'solid' : 'grey'} aria-pressed={level === l} onClick={() => setLevel(l)}>{l[0].toUpperCase() + l.slice(1)}</Btn>)}
          <span className="text-[11px] text-lab-text-muted">{LEVELS[level]}</span>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {MISSIONS.map((m) => {
            const best = all.filter((x) => x.mission?.id === m.id && x.mission.endedUtc).sort((a, b) => (b.mission!.score ?? 0) - (a.mission!.score ?? 0))[0]
            return (
              <div key={m.id} className="rounded border border-lab-line p-3 space-y-2">
                <p className="font-mono text-sm">{m.id} · {m.title} {best && <Pill tone={(best.mission!.score ?? 0) >= 80 ? 'green' : 'red'}>best {best.mission!.score}%</Pill>}</p>
                <p className="text-xs text-lab-text-muted">{m.brief}</p>
                <p className="text-[11px]">Programs: {m.programs.join(', ')} · {m.goals.length} goals</p>
                <Btn tone="solid" onClick={() => { open(startMission(m.id, level)); go('missions') }}>Start at {level} level</Btn>
              </div>
            )
          })}
        </div>
      </Panel>
      <Panel title="Certificate" sub={`Pass all ${CERT_NEEDED} missions at 80% or more, in projects in this browser (learner ID ${learner.userId}). Distinction: three or more passed at expert level.`}>
        <p className="text-sm">{c.runs.filter((r) => r.p).length} of {CERT_NEEDED} passed.</p>
        {c.eligible ? (
          <div className="space-y-2">
            <input aria-label="Name on the certificate" className="w-full max-w-sm rounded-md border border-lab-line bg-lab-panel-strong px-2 py-1.5 text-sm" value={name} onChange={(e) => { setName(e.target.value); setLearnerName(e.target.value) }} placeholder="Your name as it should appear" />
            {name.trim() && <>
              <div id="certificate" className="rounded-lg border-2 border-lab-fda/70 p-6 text-center space-y-2 bg-lab-panel-strong/50">
                <p className="font-mono text-xs uppercase text-lab-text-muted">Certificate of completion · training</p>
                <p className="text-xl">{name.trim()}</p>
                <p className="text-sm">has completed the TLF Programming Lab on the fictional study GLV-12-301, programming in R the ADaM datasets, tables, listings and figures and their independent QC{c.distinction ? ', with distinction' : ''}:</p>
                <p className="text-xs text-lab-text-muted">{c.runs.map((r) => `${r.id} ${r.title} (${r.p!.mission!.score}%, ${r.p!.mission!.level})`).join(' · ')}</p>
                <p className="font-mono text-sm">Verification code {c.code}</p>
                <p className="text-[11px] text-lab-text-muted">Issued {new Date().toISOString().slice(0, 10)}. A practice certificate from a training app; not an accredited qualification. Built by Khan Gulrez Shagufa Fazal Ahmed.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Btn tone="solid" onClick={() => window.print()}>Print or save as PDF</Btn>
                <Btn tone="grey" onClick={() => { const date = new Date().toISOString().slice(0, 10); download(`tlf-lab-passport-${date}.json`, JSON.stringify(passportRecord({ app: APP_ID, appName: 'TLF Programming Lab', certificate: 'Certificate of completion', appUrl: APP_URL, name: name.trim(), userId: learner.userId, issued: date, basis: c.basis, code: c.code, criteria: c.runs.map((r) => ({ label: `${r.id} ${r.title} passed at 80% or more`, met: !!r.p })), distinction: c.distinction }), null, 2)) }}>Passport record (JSON)</Btn>
              </div>
              <p className="text-xs text-lab-text-muted">The passport record carries this certificate to the <a className="underline" href={PASSPORT_PAGE} target="_blank" rel="noopener">Regulatory Skills Passport</a>, which checks it and shows it with your certificates from the other apps.</p>
            </>}
          </div>
        ) : <p className="text-xs text-lab-text-muted">Still to pass: {c.runs.filter((r) => !r.p).map((r) => r.id).join(', ')}.</p>}
      </Panel>
    </div>
  )
}
