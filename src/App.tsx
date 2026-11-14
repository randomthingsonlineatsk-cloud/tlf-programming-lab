import { createContext, useContext, useEffect, useState } from 'react'
import { StoreProvider, useStore } from './state'
import { ensure, onStatus, shippedZip } from './rclient'
import { grade, missionOf } from './domain/lab'
import { Btn, Pill } from './views/ui'
import Home from './views/Home'
import Learn from './views/Learn'
import Programs from './views/Programs'
import Data from './views/Data'
import Qc from './views/Qc'
import Metadata from './views/Metadata'
import Missions from './views/Missions'
import Runs from './views/Runs'
import Submission from './views/Submission'
import Requests from './views/Requests'
import AiDraft from './views/AiDraft'
import Review from './views/Review'
import { cutKey } from './domain/cut'

export type View = 'home' | 'learn' | 'programs' | 'data' | 'runs' | 'qc' | 'metadata' | 'submission' | 'ir' | 'ai' | 'review' | 'missions'
interface Nav { view: View; arg?: string; go: (v: View, arg?: string) => void }
const NavCtx = createContext<Nav>({ view: 'home', go: () => {} })
export const useNav = () => useContext(NavCtx)

const VIEWS: { id: View; label: string; project?: boolean; glv?: boolean }[] = [
  { id: 'home', label: 'Home' }, { id: 'learn', label: 'Learn' }, { id: 'programs', label: 'Programs', project: true }, { id: 'data', label: 'Data', project: true },
  { id: 'runs', label: 'Runs & tracker', project: true }, { id: 'qc', label: 'Independent QC', project: true, glv: true }, { id: 'metadata', label: 'Results metadata', project: true, glv: true },
  { id: 'submission', label: 'Submission', project: true }, { id: 'ir', label: 'Agency requests', project: true, glv: true }, { id: 'ai', label: 'AI draft', project: true, glv: true },
  { id: 'review', label: 'Code review', project: true, glv: true }, { id: 'missions', label: 'Missions & certificate' },
]

function useR() {
  const { p } = useStore()
  const [s, setS] = useState({ phase: 'idle', text: 'R not started' })
  useEffect(() => onStatus(setS), [])
  const key = p ? `${p.id}|${p.handoffName ?? 'shipped'}|${cutKey(p.cut)}` : ''
  useEffect(() => {
    if (!p) return
    const zip = p.handoffZip ? async () => p.handoffZip! : shippedZip
    ensure(key, zip, p.cut).catch(() => {})
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return s
}

function Shell() {
  const { p, error, setError, saved } = useStore()
  const [nav, setNav] = useState<{ view: View; arg?: string }>({ view: 'home' })
  const go = (view: View, arg?: string) => { setNav({ view, arg }); window.scrollTo({ top: 0 }) }
  const r = useR()
  const glv = p?.study === 'GLV-12-301'
  const allowed = (v: { project?: boolean; glv?: boolean }) => (!v.project || !!p) && (!v.glv || glv)
  const view = allowed(VIEWS.find((v) => v.id === nav.view) ?? {}) ? nav.view : 'home'
  const ready = r.phase === 'ready'
  const k = `${view}|${nav.arg ?? ''}`
  const el = view === 'home' ? <Home key={k} /> : view === 'learn' ? <Learn key={k} /> : view === 'programs' ? <Programs key={k} ready={ready} /> : view === 'data' ? <Data key={k} ready={ready} />
    : view === 'runs' ? <Runs key={k} ready={ready} /> : view === 'qc' ? <Qc key={k} ready={ready} /> : view === 'metadata' ? <Metadata key={k} /> : view === 'submission' ? <Submission key={k} ready={ready} />
    : view === 'ir' ? <Requests key={k} ready={ready} /> : view === 'ai' ? <AiDraft key={k} ready={ready} /> : view === 'review' ? <Review key={k} ready={ready} /> : <Missions key={k} />
  return (
    <NavCtx.Provider value={{ view, arg: nav.arg, go }}>
      <div className="min-h-screen bg-lab-bg text-lab-text flex flex-col">
        <header className="border-b border-lab-line bg-lab-panel/60">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-mono text-sm text-lab-fda">TLF Programming Lab</h1>
              <p className="text-[11px] text-lab-text-muted">ADaM datasets, tables, listings and figures in R, from the SDTM hand-off · fictional study for training</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {p && <Pill tone={r.phase === 'ready' ? 'green' : r.phase === 'error' ? 'red' : 'amber'} className="max-w-md truncate"><span role="status" aria-live="polite">{r.text}</span></Pill>}
              {p && <span className="text-[11px] text-lab-text-muted font-mono">{p.name}{saved ? ` · saved ${saved}` : ''}</span>}
            </div>
          </div>
          <nav className="max-w-7xl mx-auto px-4 flex flex-wrap gap-1" aria-label="Main">
            {VIEWS.filter(allowed).map((v) => (
              <button key={v.id} onClick={() => go(v.id)} aria-current={view === v.id ? 'page' : undefined}
                className={`px-3 py-1.5 font-mono text-xs border-b-2 ${view === v.id ? 'border-lab-fda text-lab-fda' : 'border-transparent text-lab-text-muted hover:text-lab-text'}`}>{v.label}</button>
            ))}
          </nav>
        </header>
        {p?.mission && !p.mission.endedUtc && <MissionBar />}
        {error && <div role="alert" className="max-w-7xl mx-auto w-full px-4 pt-3"><div className="rounded border border-lab-red/60 bg-lab-red-soft px-3 py-2 text-sm text-lab-red flex justify-between gap-2"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss" className="px-1">✕</button></div></div>}
        <main className="max-w-7xl mx-auto w-full px-4 py-4 flex-1">{el}</main>
        <footer className="border-t border-lab-line text-[11px] text-lab-text-muted">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between gap-2">
            <span>Built by Khan Gulrez Shagufa Fazal Ahmed · Apache-2.0 · <a className="underline" href="https://github.com/randomthingsonlineatsk-cloud/tlf-programming-lab">source</a> · R runs in your browser through webR (R is GPL-2 or later)</span>
            <span>Training only. The study, participants and data are fictional; not a validated system. CDISC standards are named as published by CDISC.</span>
          </div>
        </footer>
      </div>
    </NavCtx.Provider>
  )
}

function MissionBar() {
  const { p } = useStore()
  const { go } = useNav()
  const m = missionOf(p!)!
  const g = grade(p!)!
  return (
    <div className="border-b border-lab-line bg-lab-fda-soft/40">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2 text-xs">
        <Pill tone="blue">{m.id} · {p!.mission!.level}</Pill>
        <span className="font-semibold">{m.title}</span>
        <span className="text-lab-text-muted">{g.results.filter((x) => x.ok).length} of {g.results.length} goals met{p!.mission!.level !== 'expert' ? ` · ${g.score}% now` : ''}</span>
        <Btn tone="grey" className="py-0.5" onClick={() => go('missions')}>Goals and submit</Btn>
      </div>
    </div>
  )
}

export default function App() { return <StoreProvider><Shell /></StoreProvider> }
