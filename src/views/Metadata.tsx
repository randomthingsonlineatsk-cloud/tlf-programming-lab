import { useStore } from '../state'
import { ARS, arsScore, arsJson } from '../domain/ars'
import { download } from '../domain/store'
import { Btn, Panel, Pill, Select } from './ui'

// Analysis results metadata: what each analysis is, recorded before the program is written.
export default function Metadata() {
  const { p, act } = useStore()
  const ended = !!p!.mission?.endedUtc
  const s = arsScore(p!.ars)
  const show = ended || p!.mission?.level === 'guided' || !p!.mission
  return (
    <div className="space-y-4">
      <Panel title="Analysis results metadata" sub="CDISC's Analysis Results Standard (ARS, published April 2024) describes each analysis as data: the analysis set, the dataset and variable, the selection of records, the grouping and the method. Written before programming, it makes every number in a table traceable, and lets results be regenerated as analysis results data (ARD)." right={<Pill tone={s.right === s.total ? 'green' : 'grey'}>{show ? `${s.right} of ${s.total} right` : `${s.answered} of ${s.total} answered`}</Pill>}>
        <div className="flex gap-2"><Btn tone="grey" onClick={() => download('analysis-results-metadata.json', JSON.stringify(arsJson(p!.ars), null, 2))}>Export as JSON</Btn></div>
        {!show && <p className="text-[11px] text-lab-text-muted">In a mission at standard or expert level, the answers are shown after you submit.</p>}
      </Panel>
      {ARS.map((a) => (
        <Panel key={a.id} title={`${a.id} · ${a.display}`} sub={a.analysis}>
          <div className="grid md:grid-cols-2 gap-3">
            {a.fields.map((f) => {
              const k = `${a.id}.${f.id}`
              const v = p!.ars[k] ?? ''
              return (
                <label key={f.id} className="text-sm space-y-1">
                  <span className="text-xs text-lab-text-muted">{f.label}</span>
                  <Select aria-label={`${a.id} ${f.label}`} disabled={ended} value={v} onChange={(e) => act((x) => { x.ars[k] = e.target.value })} options={[{ value: '', label: 'Choose…' }, ...f.options.map((o) => ({ value: o, label: o }))]} />
                  {show && v && <span className={`block text-xs ${v === f.answer ? 'text-lab-cdsco' : 'text-lab-red'}`}>{v === f.answer ? 'Right.' : 'Not this one.'} {v === f.answer || ended ? f.why : ''}</span>}
                </label>
              )
            })}
          </div>
        </Panel>
      ))}
    </div>
  )
}
